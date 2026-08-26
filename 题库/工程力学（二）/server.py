#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工程力学题库系统 - 后端服务器

数据全部存储在本地 qdata/ 文件夹：
  qdata/index.json         题目索引（列表页摘要）
  qdata/tags.json          三级分类标签（学科 / 知识大类 / 知识点）
  qdata/q_XXX/data.json    单题完整数据
  qdata/q_XXX/*            题目所包含的图片 / 音频 / 视频文件

前端上传时，题目、答案、解析中的图片/音频/视频以 data URI 形式内嵌在 HTML 里，
本服务器负责把 data URI 抽取出来保存为独立文件，并把 HTML 中的 src 替换为相对文件名。
"""

import asyncio
import base64
import html as html_mod
import itertools
import json
import re
import shutil
import ssl
import tempfile
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import urllib.request

try:
    import edge_tts
except ImportError:
    edge_tts = None

# 连接 LLM 用宽松 SSL 上下文（兼容自签证书/本地 vLLM、Ollama 等）
_LLM_SSL_CTX = ssl.create_default_context()
_LLM_SSL_CTX.check_hostname = False
_LLM_SSL_CTX.verify_mode = ssl.CERT_NONE

# ============ 路径与常量 ============
ROOT = Path(__file__).resolve().parent
QDATA = ROOT / 'qdata'
INDEX_PATH = QDATA / 'index.json'
TAGS_PATH = QDATA / 'tags.json'
DATA_JS = ROOT / 'js' / 'data.js'   # 纯本地(file://)打开时离线使用的数据导出
PORT = 8090

DEFAULT_QUESTION_TYPES = ['判断题', '选择题', '填空题', '解答题', '证明题', '计算题']
DEFAULT_TAGS = {'subjects': [], 'question_types': DEFAULT_QUESTION_TYPES}
MAX_BODY = 512 * 1024 * 1024  # 单次上传上限 512MB（本地存储，留足余量）

# MIME -> 扩展名
MIME_EXT = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
    'image/gif': '.gif', 'image/webp': '.webp', 'image/bmp': '.bmp',
    'image/svg+xml': '.svg', 'image/x-icon': '.ico',
    'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav',
    'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'audio/webm': '.webm',
    'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv',
    'video/quicktime': '.mov', 'video/x-matroska': '.mkv',
    'application/pdf': '.pdf',
}

EXT_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject', '.otf': 'font/otf',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
    '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
    '.pdf': 'application/pdf',
}


def load_json(path, default):
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def gen_data_js():
    """把 qdata 中全部题目与标签导出为 js/data.js。

    用户在纯本地（双击 HTML 以 file:// 打开）时，浏览器无法 fetch 访问后端，
    通过 <script src="js/data.js"> 载入这份导出数据即可离线使用。
    """
    try:
        index_data = load_json(INDEX_PATH, {'questions': []})
        questions = []
        for entry in index_data.get('questions', []):
            data = load_json(QDATA / entry.get('id', '') / 'data.json', {})
            if data:
                questions.append(data)
        tags = load_json(TAGS_PATH, DEFAULT_TAGS)
        payload = {
            'questions': questions,
            'tags': tags,
            'tts_prompt': load_tts_prompt(),
            'generated': datetime.now().strftime('%Y-%m-%d %H:%M'),
        }
        js = ('// 由 server.py 自动从 qdata/ 导出，用于纯本地(file://)打开时离线使用。\n'
              '// 请勿手动编辑；服务器每次写入题目/标签后会自动重新生成。\n'
              'window.QBANK_SEED = ' + json.dumps(payload, ensure_ascii=False) + ';\n')
        DATA_JS.parent.mkdir(parents=True, exist_ok=True)
        DATA_JS.write_text(js, encoding='utf-8')
        print(f'[OK] 已导出 js/data.js（{len(questions)} 道题）')
    except Exception as e:
        print('[warn] js/data.js 导出失败:', e)


def get_max_id(questions):
    n = 0
    for q in questions:
        m = re.match(r'q_(\d{3,})', q.get('id', ''))
        if m:
            n = max(n, int(m.group(1)))
    return n


def decode_data_uri(data_uri):
    """把 data URI 解码为 (mime, bytes)，失败返回 (None, None)"""
    m = re.match(r'data:([^;,]+)(;[^,]*)?,(.*)', data_uri, re.S)
    if not m:
        return None, None
    mime = m.group(1).strip().lower()
    params = m.group(2) or ''
    payload = m.group(3)
    try:
        if ';base64' in params.lower():
            raw = base64.b64decode(payload)
        else:
            raw = unquote(payload).encode('utf-8')
    except Exception:
        return None, None
    return mime, raw


def process_html_media(html, folder, prefix, prefix_url='', start=0):
    """抽取 HTML 中所有 src="data:..." 的媒体，保存为文件并替换为可访问的相对路径。

    prefix_url 用于给替换后的 src 补上前缀（如 'qdata/q_001/'），
    使 HTML 在站点根目录的页面上能正确解析到媒体文件。
    返回 (new_html, media_list)
    """
    media = []
    counter = itertools.count(start)

    def repl(m):
        uri = m.group(1)
        mime, raw = decode_data_uri(uri)
        ext = MIME_EXT.get(mime or '', '')
        if not ext or raw is None:
            return m.group(0)  # 无法识别的媒体，原样保留
        fname = f'{prefix}_{next(counter)}{ext}'
        (folder / fname).write_bytes(raw)
        media.append(fname)
        return f'src="{prefix_url}{fname}"'

    if not html:
        return html, media
    new_html = re.sub(r'src=["\'](data:[^"\']+)["\']', repl, html)
    return new_html, media


def collect_referenced_media(*htmls):
    """收集 HTML 中引用的所有媒体文件名（取路径最后一段，兼容裸文件名与 qdata/qid/fname）"""
    refs = set()
    for h in htmls:
        if not h:
            continue
        for m in re.finditer(r'src=["\']([^"\']+)["\']', h):
            src = m.group(1)
            if (not src or src.startswith('data:') or '://' in src
                    or src.startswith('#')):
                continue
            name = src.rsplit('/', 1)[-1]
            if name:
                refs.add(name)
    return refs


def cleanup_orphan_media(folder, refs):
    """删除题目文件夹中不再被引用的媒体文件（保留 data.json）"""
    if not folder.exists():
        return
    for f in folder.iterdir():
        if f.is_file() and f.name != 'data.json':
            if f.name not in refs:
                try:
                    f.unlink()
                except Exception:
                    pass


# ============================================================
#   自动讲解系统（TTS）
#   - 解析文字 → 讲解词：HTML 去标签、LaTeX 公式总结成短句（不照读）
#   - edge-tts 合成 mp3 并存储到 qdata/q_XXX/
#   音色为原神角色风格（用微软神经网络音色+音调/语速近似）
# ============================================================

VOICES = [
    {'id': 'yujie',   'label': '御姐音 · 克洛林德', 'voice': 'zh-CN-XiaoxiaoNeural', 'pitch': '-12Hz', 'rate': '-5%'},
    {'id': 'teacher', 'label': '老师音 · 大慈树王', 'voice': 'zh-CN-XiaoxiaoNeural', 'pitch': '-3Hz',  'rate': '-12%'},
    {'id': 'loli',    'label': '萝莉音 · 希格雯',   'voice': 'zh-CN-XiaoyiNeural',   'pitch': '+45Hz', 'rate': '+20%'},
    {'id': 'uncle',   'label': '大叔音 · 法尔加',   'voice': 'zh-CN-YunjianNeural',  'pitch': '-30Hz', 'rate': '-8%'},
    {'id': 'girl',    'label': '少女音 · 宵宫',     'voice': 'zh-CN-XiaoyiNeural',   'pitch': '+12Hz', 'rate': '+8%'},
    {'id': 'boy',     'label': '少男音 · 重云',     'voice': 'zh-CN-YunxiNeural',    'pitch': '+10Hz', 'rate': '+10%'},
]

VOICE_IDS = [v['id'] for v in VOICES]


def get_voice(vid):
    for v in VOICES:
        if v['id'] == vid:
            return v
    return VOICES[4]  # 默认少女音·宵宫


# ---------- 公式 → 一句话总结（≤20 字，不照读公式） ----------
# 规则来源于可编辑配置文件 qdata/tts_prompt.json 的「公式规则」字段，
# 匹配为通配子串（* 匹配任意字符），命中任一即用该总结。

TTS_PROMPT_PATH = QDATA / 'tts_prompt.json'

# 配置缺失/损坏时的默认规则（与 tts_prompt.json 保持一致）
DEFAULT_TTS_RULES = [
    {'匹配': ['\\frac{\\pi^2 EI', 'F_{cr}', 'F_cr'], '总结': '细长压杆的欧拉临界压力公式'},
    {'匹配': ['\\mathbf{a}_c', 'a_c=', '\\boldsymbol{\\omega}'], '总结': '科氏加速度等于两倍角速度叉乘相对速度'},
    {'匹配': ['EI*w', 'w*M(', '\\frac{d^2w'], '总结': '由挠曲线微分方程积分求解'},
    {'匹配': ['\\frac{d}{dt}*m\\mathbf{v}', '\\frac{d}{dt}*mv'], '总结': '动量对时间求导等于合外力'},
    {'匹配': ['\\int*F', 'mv*mv_0', '\\frac{1}{2}kt^2'], '总结': '由动量定理，冲量等于动量的改变量'},
    {'匹配': ['\\sum F'], '总结': '沿该方向合力为零'},
    {'匹配': ['F=\\frac{P}{2\\sin'], '总结': '杆内力等于荷载除以两倍正弦夹角'},
    {'匹配': ['F=kt'], '总结': '力随时间线性增大'},
    {'匹配': ['\\frac{PL^3}{3EI}'], '总结': '自由端挠度为三倍EI分之PL立方'},
    {'匹配': ['\\frac{PL^2}{2EI}'], '总结': '自由端转角为二倍EI分之PL平方'},
    {'匹配': ['\\frac{kt^2}{2m}'], '总结': '速度等于二m分之kt平方'},
    {'匹配': ['\\frac{Px^2}{6EI}'], '总结': '积分两次得到挠曲线方程'},
    {'匹配': ['w_B', 'wB'], '总结': 'B端的挠度'},
    {'匹配': ['\\theta_B', '\\thetaB'], '总结': 'B端的转角'},
    {'匹配': ['v_0=0', 'v0=0'], '总结': '初速度为零'},
    {'匹配': ['M_O', '\\sum M'], '总结': '对O点求合力矩'},
    {'匹配': ['\\omega*\\approx'], '总结': '角速度近似为所给数值'},
    {'匹配': ['\\sigma=\\frac{N}{A}'], '总结': '正应力等于轴力除以截面积'},
    {'匹配': ['\\tau=\\frac{T}{W'], '总结': '切应力等于扭矩除以抗扭系数'},
    {'匹配': ['\\frac{d^2}{dt^2}', '\\ddot'], '总结': '对时间求二阶导数'},
    {'匹配': ['\\frac{d}{dt}', '\\dot'], '总结': '对时间求一阶导数'},
    {'匹配': ['\\int'], '总结': '对该物理量求积分'},
    {'匹配': ['\\sum'], '总结': '对各分量求和'},
    {'匹配': ['\\oint'], '总结': '沿闭合回路积分'},
    {'匹配': ['\\sqrt'], '总结': '取平方根'},
    {'匹配': ['\\frac'], '总结': '由分式计算相应物理量'},
]

DEFAULT_TTS_PROMPT = {
    '总结要求': '把块级公式总结成一句不超过20字的中文物理语言，直接输出总结内容，不解释，不读公式本身。',
    '行内公式': '照着念，转成可读的字母数字，不总结。',
    '讲解要求': '你是一名富有经验的大学理论力学老师。请根据下面的【解析内容】，生成一段适合语音朗读的优质中文讲解词。要求：自然口语化、条理清晰；先点明知识点与解题思路再分步讲解；公式用通俗中文说明物理意义，不照读符号；控制在300字以内；直接输出讲解词本身。',
    'llm': {'enabled': False, 'base_url': 'https://api.mimo.com/v1', 'api_key': '', 'model': 'MiMo'},
    '公式规则': DEFAULT_TTS_RULES,
}


def load_prompts_md():
    """读取 qdata/ai_prompts.md 中的 AI 提示词（按 ## 标题分节）"""
    md_path = QDATA / 'ai_prompts.md'
    if not md_path.exists():
        return {}
    try:
        content = md_path.read_text(encoding='utf-8')
    except Exception:
        return {}
    sections = re.split(r'^##\s+(.+?)\s*$', content, flags=re.M)
    result = {}
    for i in range(1, len(sections), 2):
        title = sections[i].strip()
        body = sections[i + 1].strip() if i + 1 < len(sections) else ''
        if title and body:
            result[title] = body
    return result


def load_tts_prompt():
    """实时读取配置（修改即生效）。提示词优先取 qdata/ai_prompts.md，
    其次 tts_prompt.json，最后内置默认；llm 与公式规则取 tts_prompt.json。"""
    cfg = load_json(TTS_PROMPT_PATH, {})
    out = dict(DEFAULT_TTS_PROMPT)
    # 提示词：ai_prompts.md 优先
    md_prompts = load_prompts_md()
    for k in ('讲解要求', '总结要求', '行内公式'):
        if md_prompts.get(k):
            out[k] = md_prompts[k]
        elif isinstance(cfg.get(k), str) and cfg[k].strip():
            out[k] = cfg[k].strip()
    if isinstance(cfg.get('llm'), dict):
        llm = dict(DEFAULT_TTS_PROMPT['llm'])
        llm.update(cfg['llm'])
        out['llm'] = llm
    if isinstance(cfg.get('公式规则'), list) and cfg['公式规则']:
        out['公式规则'] = cfg['公式规则']
    return out


def _norm(s):
    """归一化用于匹配：去空白、去反斜杠与花括号、统一分数命令（dfrac→frac）。
    反斜杠不参与匹配，可避免 JSON 转义（\frac→换页符）带来的困扰。"""
    s = re.sub(r'\s+', '', s or '')
    s = s.replace('\\dfrac', '\\frac').replace('\\tfrac', '\\frac').replace('\\cfrac', '\\frac')
    s = s.replace('\\', '').replace('{', '').replace('}', '')
    return s


def _sanitize_pattern(s):
    """把 JSON 转义产生的控制字符还原为 LaTeX 反斜杠形式（容忍用户误写单反斜杠）"""
    repl = {'\x0c': '\\f', '\x08': '\\b', '\n': '\\n', '\r': '\\r', '\t': '\\t'}
    for k, v in repl.items():
        s = s.replace(k, v)
    return s


def wildcard_match(pattern, text):
    """通配子串匹配：* 匹配任意字符序列"""
    parts = pattern.split('*')
    pos = 0
    for part in parts:
        if not part:
            continue
        idx = text.find(part, pos)
        if idx < 0:
            return False
        pos = idx + len(part)
    return True


# 希腊字母命令 → 可读音标
_GREEK_READ = {
    'alpha': 'alpha', 'beta': 'beta', 'gamma': 'gamma', 'delta': 'delta',
    'theta': 'theta', 'mu': 'mu', 'nu': 'nu', 'xi': 'xi', 'pi': 'pi',
    'rho': 'rho', 'sigma': 'sigma', 'tau': 'tau', 'phi': 'phi',
    'varphi': 'phi', 'omega': 'omega', 'varepsilon': 'epsilon',
    'epsilon': 'epsilon', 'lambda': 'lambda', 'psi': 'psi',
}


def _latex_readable(f):
    """去掉 LaTeX 命令与括号，得到可读的字母数字串"""
    s = f
    for cmd, word in _GREEK_READ.items():
        s = s.replace('\\' + cmd, word)
    s = re.sub(r'\\(?:[a-zA-Z]+|\{|\})', ' ', s)
    s = s.replace('_', '').replace('^', '').replace('\\', ' ')
    s = s.replace('{', ' ').replace('}', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def formula_to_speech(latex):
    f = (latex or '').strip()
    if not f:
        return ''
    nf = _norm(f)
    # 复合公式 → 按配置规则总结
    cfg = load_tts_prompt()
    for rule in cfg.get('公式规则', []):
        pats = rule.get('匹配') or []
        if isinstance(pats, str):
            pats = [pats]
        for p in pats:
            if wildcard_match(_norm(_sanitize_pattern(p)), nf):
                return rule.get('总结') or ''
    # 简单符号（如 omega、theta、F）→ 读作字母
    readable = _latex_readable(f)
    if readable and len(readable) <= 6 and not re.search(r'[=<>+\-*/^]', readable):
        return readable
    return '按该公式计算所求物理量'


_TAG_BLOCK = re.compile(r'<(audio|video|source|img|script|style)[^>]*>.*?</\1>', re.S | re.I)
_TAG_SELF = re.compile(r'<(audio|video|source|img)[^>]*/?>', re.I)
_TAG_ANY = re.compile(r'<[^>]+>')


def strip_html_to_text(html):
    s = _TAG_BLOCK.sub(' ', html or '')
    s = _TAG_SELF.sub(' ', s)
    s = _TAG_ANY.sub(' ', s)
    s = html_mod.unescape(s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def inline_to_speech(latex):
    """行内公式照着念：去掉 LaTeX 命令，读作可读字母数字"""
    return _latex_readable(latex or '')


def explanation_to_speech(html, block_summaries=None):
    """解析 HTML → 讲解词：
    - 文字原样保留
    - $$...$$ 块级公式 → 总结成一句话（≤20 字，不照读）；可传入 block_summaries（归一化公式→总结）覆盖
    - $...$ 行内公式 → 照着念（不总结）
    """
    text = strip_html_to_text(html)
    parts = []
    pos = 0
    for m in re.finditer(r'\$\$(.+?)\$\$|\$(.+?)\$', text, re.S):
        parts.append(text[pos:m.start()])
        if m.group(1) is not None:
            formula = m.group(1).strip()
            key = _norm(formula)
            if block_summaries and key in block_summaries:
                parts.append(block_summaries[key])
            else:
                parts.append(formula_to_speech(formula))
        else:
            parts.append(inline_to_speech(m.group(2).strip()))
        pos = m.end()
    parts.append(text[pos:])
    result = ' '.join(p for p in parts if p).strip()
    result = re.sub(r'\s+', ' ', result)
    return result


def extract_block_formulas(html):
    """取出解析中所有 $$...$$ 块级公式"""
    text = strip_html_to_text(html)
    return [m.group(1).strip() for m in re.finditer(r'\$\$(.+?)\$\$', text, re.S)]


def _extract_json_array(content):
    """从 LLM 返回文本中提取 JSON 数组（容忍 ```json 围栏与前后缀文字）"""
    m = re.search(r'\[\s*".*"\s*\]', content, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


async def llm_summarize_block_formulas(formulas, prompt_text):
    """调用 OpenAI 兼容大模型把块级公式总结成短句；失败返回 None"""
    cfg = load_tts_prompt().get('llm') or {}
    if not cfg.get('enabled') or not cfg.get('api_key'):
        return None
    if not formulas:
        return None
    body = {
        'model': cfg.get('model', 'deepseek-chat'),
        'messages': [
            {'role': 'system', 'content': prompt_text},
            {'role': 'user', 'content': '请把下面每条 LaTeX 公式总结成一句不超过20字的中文物理语言，严格按顺序输出 JSON 数组，只输出数组本身：\n'
                                       + '\n'.join(f'{i + 1}. {f}' for i, f in enumerate(formulas))},
        ],
        'temperature': 0.2,
    }
    url = (cfg.get('base_url') or 'https://api.deepseek.com/v1').rstrip('/') + '/chat/completions'
    req = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
                                 headers={'Content-Type': 'application/json',
                                          'Authorization': 'Bearer ' + cfg['api_key']})
    try:
        resp = urllib.request.urlopen(req, timeout=90)
        data = json.loads(resp.read().decode('utf-8'))
        content = data['choices'][0]['message']['content']
        arr = _extract_json_array(content)
        if arr is None or len(arr) < len(formulas):
            return None
        return {_norm(formulas[i]): (arr[i] or '').strip() for i in range(len(formulas))}
    except Exception as e:
        print('[LLM] 块级公式总结失败，回退规则:', e)
        return None


def llm_narrate(html, context=''):
    """调用大模型（OpenAI 兼容接口，如 mimo）把解析内容整体生成高质量讲解词。

    返回讲解词文本；未启用/无 key/调用失败返回 None。
    """
    cfg = load_tts_prompt().get('llm') or {}
    if not cfg.get('enabled') or not cfg.get('api_key'):
        return None
    if not cfg.get('base_url') or not cfg.get('model'):
        print('[LLM] 缺少 base_url 或 model，跳过 AI 讲解')
        return None
    text = strip_html_to_text(html)
    if not text.strip():
        return None
    prompt = load_tts_prompt().get('讲解要求', '')
    user_content = (context + '\n\n【解析内容】\n' + text) if context else ('【解析内容】\n' + text)
    body = {
        'model': cfg.get('model'),
        'messages': [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': user_content},
        ],
        'temperature': 0.4,
    }
    url = cfg.get('base_url', '').rstrip('/') + '/chat/completions'
    req = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
                                 headers={'Content-Type': 'application/json',
                                          'Authorization': 'Bearer ' + cfg['api_key']})
    try:
        resp = urllib.request.urlopen(req, timeout=120, context=_LLM_SSL_CTX)
        data = json.loads(resp.read().decode('utf-8'))
        content = data['choices'][0]['message']['content'].strip()
        # 清理 markdown 围栏与多余空白
        content = re.sub(r'^```[^\n]*\n|```$', '', content, flags=re.S).strip()
        content = re.sub(r'\s+', ' ', content)
        return content or None
    except Exception as e:
        print('[LLM] 讲解词生成失败，回退规则:', e)
        return None


def build_speak_text(html, context=''):
    """生成讲解词，返回 (讲解词, 是否AI生成)：
    - 启用 LLM 时，用大模型把解析整体转成高质量讲解词（自然流畅、讲解思路）；
    - 未启用或调用失败时，回退到规则引擎（块级公式总结 + 行内公式照念）。
    """
    cfg = load_tts_prompt().get('llm') or {}
    if cfg.get('enabled'):
        ai = llm_narrate(html, context)
        if ai:
            return ai, True
    return explanation_to_speech(html), False


# ---------- edge-tts 合成 ----------
async def _tts_save(text, voice, pitch, rate, out_path):
    tts = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
    await tts.save(out_path)


def tts_generate(text, voice_id, out_path):
    if edge_tts is None:
        print('[TTS] edge-tts 未安装')
        return False
    v = get_voice(voice_id)
    try:
        asyncio.run(_tts_save(text, v['voice'], v['pitch'], v['rate'], out_path))
        return True
    except Exception as e:
        print('[TTS] 合成失败:', e)
        return False


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        print(f"[{self.command}] {args[0]}")

    # ---------- CORS ----------
    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    # ---------- 工具 ----------
    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except ConnectionError:
            pass

    def read_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
        except ValueError:
            length = 0
        if length <= 0:
            return b''
        if length > MAX_BODY:
            self.send_json(413, {'ok': False, 'message': '上传数据过大（超过 512MB 上限）'})
            return None
        return self.rfile.read(length)

    def read_body_json(self):
        body = self.read_body()
        if body is None:
            return None
        try:
            return json.loads(body.decode('utf-8'))
        except Exception:
            self.send_json(400, {'ok': False, 'message': 'JSON 解析失败'})
            return None

    # ---------- 路由 ----------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.lstrip('/')
        qs = parse_qs(parsed.query)

        if path == 'api/list':
            self.api_list()
            return
        if path == 'api/question':
            self.api_question(qs)
            return
        if path == 'api/tags':
            self.send_json(200, {'ok': True, 'tags': load_json(TAGS_PATH, DEFAULT_TAGS)})
            return
        if path == 'api/voices':
            self.send_json(200, {'ok': True, 'voices': VOICES})
            return
        if path == 'api/tts-prompt':
            self.send_json(200, {'ok': True, 'prompt': load_tts_prompt()})
            return
        if path == 'api/ai-status':
            self.api_ai_status(qs)
            return

        # 静态文件
        if path == '' or path == '/':
            path = 'index.html'
        file_path = ROOT / path
        try:
            file_path.resolve().relative_to(ROOT.resolve())
        except ValueError:
            self.send_error(403, 'Forbidden')
            return

        if file_path.exists() and file_path.is_file():
            self.send_static(file_path)
        else:
            self.send_error(404, 'Not Found')

    def send_static(self, file_path):
        ctype = EXT_MIME.get(file_path.suffix.lower(), 'application/octet-stream')
        try:
            raw = file_path.read_bytes()
        except Exception:
            self.send_error(404, 'Not Found')
            return
        self.send_response(200)
        self.send_cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        try:
            self.wfile.write(raw)
        except ConnectionError:
            pass

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/api/upload':
            self.api_upload(create=True)
        elif path == '/api/update':
            self.api_upload(create=False)
        elif path == '/api/tags':
            self.api_add_tag()
        elif path == '/api/tts':
            self.api_tts_preview()
        elif path == '/api/narrate':
            self.api_narrate()
        else:
            self.send_json(404, {'ok': False, 'message': 'Not Found'})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        qs = parse_qs(parsed.query)
        if path == '/api/delete':
            self.api_delete(qs)
        elif path == '/api/narrate':
            self.api_narrate_delete(qs)
        else:
            self.send_json(404, {'ok': False, 'message': 'Not Found'})

    # ---------- 题目列表 ----------
    def api_list(self):
        index_data = load_json(INDEX_PATH, {'questions': []})
        questions = []
        for entry in index_data.get('questions', []):
            qid = entry.get('id', '')
            data = load_json(QDATA / qid / 'data.json', {})
            if not data:
                data = entry
            questions.append(data)
        # 按创建时间倒序
        questions.sort(key=lambda q: q.get('created', ''), reverse=True)
        self.send_json(200, {'ok': True, 'questions': questions})

    # ---------- 单题详情 ----------
    def api_question(self, qs):
        qid = (qs.get('id') or [''])[0].strip()
        if not qid:
            self.send_json(400, {'ok': False, 'message': '缺少题目 ID'})
            return
        data = load_json(QDATA / qid / 'data.json', None)
        if data is None:
            self.send_json(404, {'ok': False, 'message': '题目不存在'})
            return
        self.send_json(200, {'ok': True, 'question': data})

    # ---------- 上传 / 更新 ----------
    def api_upload(self, create):
        data = self.read_body_json()
        if data is None:
            return

        # 校验必填字段
        required = ['overview', 'subject', 'category', 'difficulty', 'content', 'answer', 'explanation']
        missing = [k for k in required if not str(data.get(k, '')).strip()]
        if missing:
            self.send_json(400, {'ok': False, 'message': f'缺少必填字段: {", ".join(missing)}'})
            return
        kps = data.get('knowledge_points') or []
        if not kps:
            self.send_json(400, {'ok': False, 'message': '请至少选择一个知识点（第三级标签）'})
            return

        index_data = load_json(INDEX_PATH, {'questions': []})
        questions = index_data.get('questions', [])

        # 确定 ID
        if create:
            new_id = f'q_{get_max_id(questions) + 1:03d}'
        else:
            new_id = str(data.get('id', '')).strip()
            if not re.match(r'^q_\d+$', new_id):
                self.send_json(400, {'ok': False, 'message': '更新时需要有效的题目 ID'})
                return
            exists = any(q.get('id') == new_id for q in questions)
            if not exists:
                self.send_json(404, {'ok': False, 'message': f'题目 {new_id} 不存在，无法更新'})
                return

        folder = QDATA / new_id
        folder.mkdir(parents=True, exist_ok=True)

        now = datetime.now().strftime('%Y-%m-%d %H:%M')

        # 抽取并保存媒体（src 补上 qdata/qid/ 前缀，保证前端可直接解析）
        media_url = f'qdata/{new_id}/'
        content, content_media = process_html_media(data.get('content', ''), folder, 'content_img', media_url)
        answer, answer_media = process_html_media(data.get('answer', ''), folder, 'answer_img', media_url, start=len(content_media))
        explanation, explanation_media = process_html_media(data.get('explanation', ''), folder, 'explain_media', media_url, start=len(content_media) + len(answer_media))

        old = load_json(folder / 'data.json', {}) if not create else {}

        # 若已存在的题目被更新，清理不再引用的旧媒体文件（保留讲解音频）
        if not create:
            refs = collect_referenced_media(content, answer, explanation)
            narration_path = (old.get('narration') or {}).get('path')
            if narration_path:
                refs.add(narration_path.rsplit('/', 1)[-1])
            cleanup_orphan_media(folder, refs)

        question_data = {
            'id': new_id,
            'overview': str(data.get('overview', '')).strip(),
            'subject': str(data.get('subject', '')).strip(),
            'category': str(data.get('category', '')).strip(),
            'knowledge_points': kps,
            'question_type': str(data.get('question_type', '') or old.get('question_type') or '解答题').strip(),
            'source': str(data.get('source', '') or old.get('source') or '练习册').strip(),
            'difficulty': str(data.get('difficulty', 'medium')).strip(),
            'content': content,
            'answer': answer,
            'explanation': explanation,
            'media': sorted(collect_referenced_media(content, answer, explanation)),
            'created': old.get('created') or now,
            'updated': now,
        }
        save_json(folder / 'data.json', question_data)

        # 更新索引
        entry = {
            'id': new_id,
            'overview': question_data['overview'],
            'subject': question_data['subject'],
            'category': question_data['category'],
            'knowledge_points': question_data['knowledge_points'],
            'question_type': question_data['question_type'],
            'difficulty': question_data['difficulty'],
            'created': question_data['created'],
            'updated': question_data['updated'],
            'has_media': len(question_data['media']) > 0,
        }
        if create:
            questions.append(entry)
        else:
            for i, q in enumerate(questions):
                if q.get('id') == new_id:
                    questions[i] = entry
                    break
        index_data['questions'] = questions
        save_json(INDEX_PATH, index_data)
        gen_data_js()

        print(f"[OK] {'创建' if create else '更新'}题目: {new_id} - {question_data['overview']}（{question_data['subject']} / {question_data['category']}）")
        self.send_json(200, {'ok': True, 'id': new_id})

    # ---------- 删除 ----------
    def api_delete(self, qs):
        qid = (qs.get('id') or [''])[0].strip()
        if not qid:
            self.send_json(400, {'ok': False, 'message': '缺少题目 ID'})
            return
        index_data = load_json(INDEX_PATH, {'questions': []})
        questions = index_data.get('questions', [])
        new_questions = [q for q in questions if q.get('id') != qid]
        if len(new_questions) == len(questions):
            self.send_json(404, {'ok': False, 'message': f'题目 {qid} 不存在'})
            return
        index_data['questions'] = new_questions
        save_json(INDEX_PATH, index_data)
        folder = QDATA / qid
        if folder.exists():
            shutil.rmtree(folder, ignore_errors=True)
        gen_data_js()
        print(f"[OK] 删除题目: {qid}")
        self.send_json(200, {'ok': True, 'message': f'题目 {qid} 已删除'})

    # ---------- 标签管理 ----------
    def api_add_tag(self):
        data = self.read_body_json()
        if data is None:
            return
        action = data.get('action', 'add')
        tags = load_json(TAGS_PATH, DEFAULT_TAGS)
        subjects = tags.get('subjects', [])

        if action == 'add_subject':
            name = str(data.get('name', '')).strip()
            if not name:
                self.send_json(400, {'ok': False, 'message': '学科名称不能为空'})
                return
            if any(s.get('name') == name for s in subjects):
                self.send_json(400, {'ok': False, 'message': f'学科「{name}」已存在'})
                return
            subjects.append({'name': name, 'categories': []})

        elif action == 'add_category':
            subject = str(data.get('subject', '')).strip()
            name = str(data.get('name', '')).strip()
            if not name:
                self.send_json(400, {'ok': False, 'message': '知识大类名称不能为空'})
                return
            s = next((x for x in subjects if x.get('name') == subject), None)
            if not s:
                self.send_json(400, {'ok': False, 'message': f'学科「{subject}」不存在'})
                return
            if any(c.get('name') == name for c in s.get('categories', [])):
                self.send_json(400, {'ok': False, 'message': f'知识大类「{name}」已存在'})
                return
            s.setdefault('categories', []).append({'name': name, 'knowledge_points': []})

        elif action == 'add_point':
            subject = str(data.get('subject', '')).strip()
            category = str(data.get('category', '')).strip()
            name = str(data.get('name', '')).strip()
            if not name:
                self.send_json(400, {'ok': False, 'message': '知识点名称不能为空'})
                return
            s = next((x for x in subjects if x.get('name') == subject), None)
            if not s:
                self.send_json(400, {'ok': False, 'message': f'学科「{subject}」不存在'})
                return
            c = next((x for x in s.get('categories', []) if x.get('name') == category), None)
            if not c:
                self.send_json(400, {'ok': False, 'message': f'知识大类「{category}」不存在'})
                return
            if name in c.get('knowledge_points', []):
                self.send_json(400, {'ok': False, 'message': f'知识点「{name}」已存在'})
                return
            c.setdefault('knowledge_points', []).append(name)

        elif action == 'add_question_type':
            name = str(data.get('name', '')).strip()
            if not name:
                self.send_json(400, {'ok': False, 'message': '题型名称不能为空'})
                return
            types = tags.setdefault('question_types', list(DEFAULT_QUESTION_TYPES))
            if name in types:
                self.send_json(400, {'ok': False, 'message': f'题型「{name}」已存在'})
                return
            types.append(name)

        else:
            self.send_json(400, {'ok': False, 'message': '未知操作'})
            return

        tags['subjects'] = subjects
        save_json(TAGS_PATH, tags)
        gen_data_js()
        print('[OK] 标签已更新')
        self.send_json(200, {'ok': True, 'tags': tags})

    # ---------- 自动讲解（TTS） ----------
    def api_ai_status(self, qs):
        """AI 讲解配置诊断：返回配置状态，并可选做一次实时测试调用"""
        cfg = load_tts_prompt().get('llm') or {}
        prompt = load_tts_prompt().get('讲解要求', '')
        key_masked = (cfg.get('api_key') or '')[:6] + '****' if cfg.get('api_key') else ''
        status = {
            'enabled': bool(cfg.get('enabled')),
            'config_complete': bool(cfg.get('api_key') and cfg.get('base_url') and cfg.get('model')),
            'base_url': cfg.get('base_url', ''),
            'model': cfg.get('model', ''),
            'api_key_masked': key_masked,
            'prompt_len': len(prompt),
        }
        # 实时测试
        test = qs.get('test', ['0'])[0] == '1'
        if test:
            test_ok, test_err = self._ai_test_call(cfg)
            status['test_ok'] = test_ok
            status['test_err'] = test_err
        self.send_json(200, {'ok': True, 'status': status})

    def _ai_test_call(self, cfg):
        """向配置的 LLM 端点发一次最小测试请求，返回 (是否成功, 错误信息)"""
        if not (cfg.get('api_key') and cfg.get('base_url') and cfg.get('model')):
            return False, '配置不完整（缺 base_url / api_key / model）'
        url = cfg['base_url'].rstrip('/') + '/chat/completions'
        body = {'model': cfg['model'], 'messages': [{'role': 'user', 'content': '你好'}], 'max_tokens': 5}
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'),
                headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg['api_key']})
            resp = urllib.request.urlopen(req, timeout=20, context=_LLM_SSL_CTX)
            if resp.status == 200:
                return True, ''
            return False, 'HTTP ' + str(resp.status)
        except urllib.error.HTTPError as e:
            return False, f'HTTP {e.code}: {e.read().decode("utf-8", "ignore")[:150]}'
        except Exception as e:
            return False, f'{type(e).__name__}: {str(e)[:150]}'

    def api_tts_preview(self):
        """试听：按解析内容合成语音，直接返回 mp3 字节"""
        data = self.read_body_json()
        if data is None:
            return
        html = data.get('explanation', '')
        if not (html or '').strip():
            self.send_json(400, {'ok': False, 'message': '解析内容为空'})
            return
        voice = data.get('voice', 'girl')
        speak, _ai = build_speak_text(html, context=data.get('overview', ''))
        if not speak:
            self.send_json(400, {'ok': False, 'message': '解析中没有可朗读的文字'})
            return
        tmp = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False).name
        try:
            if not tts_generate(speak, voice, tmp):
                self.send_json(500, {'ok': False, 'message': '语音合成失败（edge-tts 需要联网，请确认网络可用）'})
                return
            raw = Path(tmp).read_bytes()
            self.send_response(200)
            self.send_cors()
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            try:
                self.wfile.write(raw)
            except ConnectionError:
                pass
        finally:
            try:
                Path(tmp).unlink()
            except Exception:
                pass

    def api_narrate(self):
        """生成并存储讲解音频到 qdata/q_XXX/，写入 data.json 的 narration 字段"""
        data = self.read_body_json()
        if data is None:
            return
        qid = (data.get('id') or '').strip()
        if not re.match(r'^q_\d+$', qid):
            self.send_json(400, {'ok': False, 'message': '需要有效的题目 ID'})
            return
        folder = QDATA / qid
        qpath = folder / 'data.json'
        if not qpath.exists():
            self.send_json(404, {'ok': False, 'message': '题目不存在'})
            return
        q = load_json(qpath, {})
        html = q.get('explanation', '')
        if not (html or '').strip():
            self.send_json(400, {'ok': False, 'message': '该题没有解析内容'})
            return
        # 重新生成时先删除旧讲解音频
        old_path = (q.get('narration') or {}).get('path')
        if old_path:
            try:
                (folder / old_path.rsplit('/', 1)[-1]).unlink()
            except Exception:
                pass
        voice = (data.get('voice') or 'girl')
        v = get_voice(voice)
        speak, ai_used = build_speak_text(html, context=q.get('overview', ''))
        if not speak:
            self.send_json(400, {'ok': False, 'message': '解析中没有可朗读的文字'})
            return
        fname = f'narration_{int(time.time())}.mp3'
        out = folder / fname
        if not tts_generate(speak, voice, out):
            self.send_json(500, {'ok': False, 'message': '语音合成失败（edge-tts 需要联网，请确认网络可用）'})
            return
        q['narration'] = {
            'path': f'qdata/{qid}/{fname}',
            'voice': voice,
            'voice_label': v['label'],
            'created': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'speakable_text': speak,
            'ai_generated': ai_used,
        }
        save_json(qpath, q)
        gen_data_js()
        print(f'[OK] 讲解音频已生成: {qid} - {q["narration"]["voice_label"]}')
        self.send_json(200, {'ok': True, 'id': qid, 'narration': q['narration']})

    def api_narrate_delete(self, qs):
        """删除题目的讲解音频"""
        qid = (qs.get('id') or [''])[0].strip()
        if not re.match(r'^q_\d+$', qid):
            self.send_json(400, {'ok': False, 'message': '需要有效的题目 ID'})
            return
        qpath = QDATA / qid / 'data.json'
        if not qpath.exists():
            self.send_json(404, {'ok': False, 'message': '题目不存在'})
            return
        q = load_json(qpath, {})
        n = q.get('narration')
        if not n:
            self.send_json(400, {'ok': False, 'message': '该题没有讲解音频'})
            return
        path = n.get('path', '')
        if path:
            try:
                (QDATA / qid / path.rsplit('/', 1)[-1]).unlink()
            except Exception:
                pass
        q.pop('narration', None)
        save_json(qpath, q)
        gen_data_js()
        print(f'[OK] 讲解音频已删除: {qid}')
        self.send_json(200, {'ok': True, 'message': '讲解音频已删除'})

    # ---------- 关闭 ----------
    def finish(self):
        try:
            super().finish()
        except ConnectionError:
            pass


def main():
    print('=' * 58)
    print('  工程力学题库系统 - 后端服务器')
    print(f'  地址: http://localhost:{PORT}')
    print(f'  项目根目录: {ROOT}')
    print(f'  题库数据目录: {QDATA}')
    print('')
    print('  API 接口:')
    print('    GET    /api/list                 获取全部题目')
    print('    GET    /api/question?id=q_001    获取单题详情')
    print('    GET    /api/tags                 获取三级分类标签')
    print('    GET    /api/voices               获取讲解音色列表')
    print('    POST   /api/upload               上传新题')
    print('    POST   /api/update               更新题目')
    print('    DELETE /api/delete?id=q_001      删除题目')
    print('    POST   /api/tags                 新增标签(学科/大类/知识点)')
    print('    POST   /api/tts                  试听讲解（返回 mp3）')
    print('    POST   /api/narrate              生成并存储讲解音频')
    print('')
    print('  按 Ctrl+C 停止服务器')
    print('=' * 58)

    gen_data_js()
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')
        server.shutdown()


if __name__ == '__main__':
    main()
