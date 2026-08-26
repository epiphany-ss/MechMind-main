# -*- coding: utf-8 -*-
"""语音讲解（TTS）工具库 —— 由新题库站点 server.py 的自动讲解系统移植而来。

- edge-tts 合成中文讲解音频（微软在线语音服务，需联网）
- 解析 HTML → 讲解词：文字保留、块级公式总结成短句、行内公式照念
- 6 种预设音色（原神角色风格，用微软神经语音 + 音调/语速近似）
"""
import asyncio
import html as html_mod
import json
import re
import ssl
import tempfile
import time
import urllib.request
from datetime import datetime
from pathlib import Path

try:
    import edge_tts
except ImportError:
    edge_tts = None

ROOT = Path(__file__).resolve().parent
QDATA = ROOT / 'qdata'
INDEX_PATH = QDATA / 'index.json'
DATA_JS = ROOT / 'js' / 'data.js'
TTS_PROMPT_PATH = QDATA / 'tts_prompt.json'
TAGS_PATH = QDATA / 'tags.json'

# 连接 LLM 用宽松 SSL 上下文（兼容自签证书/本地 vLLM、Ollama 等）
_LLM_SSL_CTX = ssl.create_default_context()
_LLM_SSL_CTX.check_hostname = False
_LLM_SSL_CTX.verify_mode = ssl.CERT_NONE

DEFAULT_QUESTION_TYPES = ['判断题', '选择题', '填空题', '解答题', '证明题', '计算题']
DEFAULT_TAGS = {'subjects': [], 'question_types': DEFAULT_QUESTION_TYPES}

# ==================== 音色 ====================
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


# ==================== 讲解提示词配置 ====================
# 配置缺失/损坏时的默认规则（与 tts_prompt.json 一致）
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


# ==================== 讲解词生成 ====================
def _norm(s):
    """归一化用于匹配：去空白、去反斜杠与花括号、统一分数命令（dfrac→frac）。"""
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
    cfg = load_tts_prompt()
    for rule in cfg.get('公式规则', []):
        pats = rule.get('匹配') or []
        if isinstance(pats, str):
            pats = [pats]
        for p in pats:
            if wildcard_match(_norm(_sanitize_pattern(p)), nf):
                return rule.get('总结') or ''
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


def explanation_to_speech(html):
    """解析 HTML → 讲解词：文字保留、$$块级公式$$总结、$行内公式$照念"""
    text = strip_html_to_text(html)
    parts = []
    pos = 0
    for m in re.finditer(r'\$\$(.+?)\$\$|\$(.+?)\$', text, re.S):
        parts.append(text[pos:m.start()])
        if m.group(1) is not None:
            parts.append(formula_to_speech(m.group(1).strip()))
        else:
            parts.append(inline_to_speech(m.group(2).strip()))
        pos = m.end()
    parts.append(text[pos:])
    result = ' '.join(p for p in parts if p).strip()
    result = re.sub(r'\s+', ' ', result)
    return result


def llm_narrate(html, context=''):
    """调用大模型（OpenAI 兼容接口，如 mimo）把解析内容整体生成高质量讲解词。
    返回讲解词文本；未启用/无 key/调用失败返回 None。"""
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
        content = re.sub(r'^```[^\n]*\n|```$', '', content, flags=re.S).strip()
        content = re.sub(r'\s+', ' ', content)
        return content or None
    except Exception as e:
        print('[LLM] 讲解词生成失败，回退规则:', e)
        return None


def build_speak_text(html, context=''):
    """生成讲解词，返回 (讲解词, 是否AI生成)。"""
    cfg = load_tts_prompt().get('llm') or {}
    if cfg.get('enabled'):
        ai = llm_narrate(html, context)
        if ai:
            return ai, True
    return explanation_to_speech(html), False


# ==================== edge-tts 合成 ====================
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


def gen_data_js():
    """把 qdata 中全部题目与标签导出为 js/data.js（离线种子数据）。"""
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


# ==================== 供 server.py 调用的高层接口 ====================
def tts_preview(explanation, voice='girl', overview=''):
    """试听讲解。成功返回 (200, mp3字节)；失败返回 (状态码, JSON错误字典)。"""
    speak, _ai = build_speak_text(explanation, context=overview)
    if not speak:
        return 400, {'ok': False, 'message': '解析中没有可朗读的文字'}
    tmp = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False).name
    try:
        if not tts_generate(speak, voice, tmp):
            return 500, {'ok': False, 'message': '语音合成失败（edge-tts 需要联网，请确认网络可用）'}
        return 200, Path(tmp).read_bytes()
    finally:
        try:
            Path(tmp).unlink()
        except Exception:
            pass


def narrate_question(qid, voice='girl'):
    """生成并存储讲解音频到 qdata/q_XXX/，写入 data.json 的 narration 字段。
    成功返回 (200, {'ok':True,'id':...,'narration':{...}})；失败返回 (状态码, JSON错误字典)。"""
    if not re.match(r'^q_\d+$', qid):
        return 400, {'ok': False, 'message': '需要有效的题目 ID'}
    folder = QDATA / qid
    qpath = folder / 'data.json'
    if not qpath.exists():
        return 404, {'ok': False, 'message': '题目不存在'}
    q = load_json(qpath, {})
    html_content = q.get('explanation', '')
    if not (html_content or '').strip():
        return 400, {'ok': False, 'message': '该题没有解析内容'}
    # 重新生成时先删除旧讲解音频
    old_path = (q.get('narration') or {}).get('path')
    if old_path:
        try:
            (folder / old_path.rsplit('/', 1)[-1]).unlink()
        except Exception:
            pass
    v = get_voice(voice)
    speak, ai_used = build_speak_text(html_content, context=q.get('overview', ''))
    if not speak:
        return 400, {'ok': False, 'message': '解析中没有可朗读的文字'}
    fname = f'narration_{int(time.time())}.mp3'
    out = folder / fname
    if not tts_generate(speak, voice, out):
        return 500, {'ok': False, 'message': '语音合成失败（edge-tts 需要联网，请确认网络可用）'}
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
    return 200, {'ok': True, 'id': qid, 'narration': q['narration']}


def delete_narration(qid):
    """删除题目的讲解音频。成功返回 (200, JSON)；失败返回 (状态码, JSON错误字典)。"""
    if not re.match(r'^q_\d+$', qid):
        return 400, {'ok': False, 'message': '需要有效的题目 ID'}
    qpath = QDATA / qid / 'data.json'
    if not qpath.exists():
        return 404, {'ok': False, 'message': '题目不存在'}
    q = load_json(qpath, {})
    n = q.get('narration')
    if not n:
        return 400, {'ok': False, 'message': '该题没有讲解音频'}
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
    return 200, {'ok': True, 'message': '讲解音频已删除'}
