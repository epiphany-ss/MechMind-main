# -*- coding: utf-8 -*-
"""填充干净示例数据（用原始字符串写 LaTeX，避免转义污染）"""
import base64
import json
import urllib.request
import wave
import io
import struct
import zlib


def post(path, payload):
    req = urllib.request.Request(
        'http://localhost:8090' + path,
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))


def delete(path):
    req = urllib.request.Request('http://localhost:8090' + path, method='DELETE')
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))


# ---------------- 生成一张简单示意图 PNG（蓝底白色三角形） ----------------
def make_triangle_png(w=240, h=180):
    """手绘一个带三角形的 PNG（zlib 构造），蓝底白框三角形 + 红色箭头线"""
    def chunk(tag, data):
        c = tag + data
        return (struct.pack('>I', len(data)) + c
                + struct.pack('>I', zlib.crc32(c) & 0xffffffff))
    # 像素数组（简单两色：背景浅蓝 0xE8F0FE，三角形内白色，轮廓深蓝）
    px = bytearray()
    for y in range(h):
        row = bytearray(b'\x00')  # filter type 0
        for x in range(w):
            # 三角形区域判断
            base = int(h * 0.85)
            # 左上(40,h-20) 右上(w-40,h-20) 顶(120,30)
            inside = False
            x1, y1 = 40, base - 20
            x2, y2 = w - 40, base - 20
            x3, y3 = 120, 30
            d1 = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1)
            d2 = (x3 - x2) * (y - y2) - (x - x2) * (y3 - y2)
            d3 = (x1 - x3) * (y - y3) - (x - x3) * (y1 - y3)
            neg = d1 < 0 or d2 < 0 or d3 < 0
            pos = d1 > 0 or d2 > 0 or d3 > 0
            if not (neg and pos):
                inside = True
            if inside:
                row += bytes((0x2C, 0x7A, 0xE8))  # 深蓝
            else:
                row += bytes((0xE8, 0xF0, 0xFE))  # 浅蓝
        px += row
    raw = b'\x08' + (w * h * 3).to_bytes(4, 'big')  # 未压缩，颜色类型 2 (RGB)
    # 其实直接打包成 zlib 即可
    idat = zlib.compress(bytes(px))
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', idat)
           + chunk(b'IEND', b''))
    return png


# ---------------- 生成 1 秒静音 WAV ----------------
def make_silence_wav(seconds=1):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b'\x00\x00' * (8000 * seconds))
    return buf.getvalue()


def data_uri(mime, raw):
    return 'data:' + mime + ';base64,' + base64.b64encode(raw).decode()


# ---------------- 先清理全部旧题 ----------------
lst = post('/api/list', None) if False else json.loads(
    urllib.request.urlopen('http://localhost:8090/api/list').read().decode('utf-8'))
for q in lst.get('questions', []):
    delete('/api/delete?id=' + q['id'])

png = make_triangle_png()
wav = make_silence_wav()

questions = [
    # ---- 1. 理论力学 / 运动学 / 科氏加速度（含图片 + 块级公式）----
    {
        'overview': '北半球自由落体的科氏加速度偏东问题',
        'subject': '理论力学', 'category': '运动学',
        'knowledge_points': ['科氏加速度', '点的合成运动'],
        'difficulty': 'medium',
        'content': (
            '<p>在北纬 $\\varphi$ 处自高度 $h$ 自由释放一质点，'
            '不计空气阻力。试写出地球自转引起的<b>科氏加速度</b>的大小，并判断方向。</p>'
            '<p>示意图：</p><img src="' + data_uri('image/png', png)
            + '" alt="自由落体科氏加速度示意" style="max-width:100%">'
        ),
        'answer': '<p>$a_c = 2\\,\\omega\\,v\\,\\sin\\varphi$，方向指向<b>东</b>。</p>',
        'explanation': (
            '<p>科氏加速度的计算公式为</p>'
            '<p>$$\\mathbf{a}_c = 2\\,\\boldsymbol{\\omega} \\times \\mathbf{v}_r$$</p>'
            '<p>式中 $\\boldsymbol{\\omega}$ 为地球自转角速度，'
            ' $v_r$ 为相对速度。地球自转角速度 $\\omega \\approx 7.29\\times 10^{-5}\\,\\text{rad/s}$，'
            '在纬度 $\\varphi$ 处科氏加速度指向东，落体因此产生向东的偏移。</p>'
            '<p>配语音讲解：</p>'
            '<audio controls src="' + data_uri('audio/wav', wav) + '"></audio>'
        ),
    },
    # ---- 2. 材料力学 / 基本变形 / 弯曲变形 ----
    {
        'overview': '悬臂梁自由端受集中力——挠度计算（叠加法）',
        'subject': '材料力学', 'category': '基本变形',
        'knowledge_points': ['弯曲变形', '弯曲内力'],
        'difficulty': 'hard',
        'content': (
            '<p>悬臂梁长 $L$，抗弯刚度 $EI$ 为常数，自由端 $B$ 受向下集中力 $P$。'
            '求自由端 $B$ 的挠度与转角。</p>'
            '<p><img src="' + data_uri('image/png', png)
            + '" alt="悬臂梁受力图" style="max-width:100%"></p>'
        ),
        'answer': (
            '<p>挠度：$w_B = \\dfrac{PL^3}{3EI}\\;\\downarrow$</p>'
            '<p>转角：$\\theta_B = \\dfrac{PL^2}{2EI}$</p>'
        ),
        'explanation': (
            '<p>由弯矩方程 $M(x) = -P(L - x)$，代入挠曲线微分方程</p>'
            '<p>$$EI\\,w\'\' = M(x) = -P(L - x)$$</p>'
            '<p>积分两次并代入边界条件 $w(0)=0,\\;w\'(0)=0$：</p>'
            '<p>$$w(x) = \\frac{Px^2}{6EI}(3L - x)$$</p>'
            '<p>令 $x = L$ 即得 $w_B = \\dfrac{PL^3}{3EI}$。</p>'
        ),
    },
    # ---- 3. 理论力学 / 静力学 / 受力分析 ----
    {
        'overview': '平面汇交力系平衡——节点受力分析与求反力',
        'subject': '理论力学', 'category': '静力学',
        'knowledge_points': ['受力分析', '平面力系'],
        'difficulty': 'easy',
        'content': (
            '<p>平面桁架节点 $A$ 受竖直荷载 $P$，两杆夹角 $\\theta$，'
            '求两杆内力。</p>'
            '<p><img src="' + data_uri('image/png', png)
            + '" alt="节点受力图" style="max-width:100%"></p>'
        ),
        'answer': '<p>两杆均受压：$F = \\dfrac{P}{2\\sin\\theta}$</p>',
        'explanation': (
            '<p>以节点 $A$ 为研究对象，建立平衡方程：</p>'
            '<p>$$\\sum F_x = 0,\\qquad \\sum F_y = 0$$</p>'
            '<p>由竖直方向平衡：$2F\\sin\\theta = P$，故 $F = \\dfrac{P}{2\\sin\\theta}$。</p>'
        ),
    },
    # ---- 4. 材料力学 / 压杆稳定 / 欧拉公式 ----
    {
        'overview': '细长压杆临界压力——欧拉公式四种约束情形',
        'subject': '材料力学', 'category': '压杆稳定',
        'knowledge_points': ['欧拉公式', '细长压杆临界力'],
        'difficulty': 'medium',
        'content': (
            '<p>两端铰支细长压杆，长度 $L$，抗弯刚度 $EI$。求其临界压力。</p>'
        ),
        'answer': '<p>$F_{cr} = \\dfrac{\\pi^2 EI}{L^2}$（两端铰支）</p>',
        'explanation': (
            '<p>欧拉临界压力公式：</p>'
            '<p>$$F_{cr} = \\frac{\\pi^2 EI}{(\\mu L)^2}$$</p>'
            '<p>其中 $\\mu$ 为长度因数：两端铰支 $\\mu=1$，一端固支一端自由 $\\mu=2$，'
            '一端固支一端铰支 $\\mu\\approx 0.7$，两端固支 $\\mu=0.5$。</p>'
        ),
    },
    # ---- 5. 理论力学 / 动力学 / 动量定理（答案含图片） ----
    {
        'overview': '沿光滑水平面的物块——动量定理积分形式',
        'subject': '理论力学', 'category': '动力学',
        'knowledge_points': ['动量定理', '质点动力学'],
        'difficulty': 'easy',
        'content': (
            '<p>质量 $m$ 的物块在随时间线性增大的水平力 $F = kt$ 作用下'
            '沿光滑水平面由静止开始运动，求 $t$ 时刻的速度。</p>'
        ),
        'answer': (
            '<p>$v = \\dfrac{kt^2}{2m}$</p>'
            '<p>受力图：</p><img src="' + data_uri('image/png', png)
            + '" alt="物块受力图" style="max-width:100%">'
        ),
        'explanation': (
            '<p>由动量定理的积分形式</p>'
            '<p>$$mv - mv_0 = \\int_0^t F\\,d\\tau = \\int_0^t k\\tau\\,d\\tau = \\frac{1}{2}kt^2$$</p>'
            '<p>初速度 $v_0 = 0$，故 $v = \\dfrac{kt^2}{2m}$。</p>'
        ),
    },
]

for q in questions:
    r = post('/api/upload', q)
    print('uploaded', r['id'], '|', q['overview'])

print('DONE')
