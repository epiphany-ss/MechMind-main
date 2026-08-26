# -*- coding: utf-8 -*-
"""生成 老题库 q6-q10 转录 JSON（upload2/q6.json ~ q10.json）"""
import json, os

OUT = '题库/upload2'
os.makedirs(OUT, exist_ok=True)

# 公共字段
CAT = '静力学'
KP = ['平面力系']
QTYPE = '计算题'

q6 = {
    'overview': '求液压式汽车起重机支撑腿A、B的约束力及最大起重',
    'category': CAT,
    'question_type': QTYPE,
    'knowledge_points': KP,
    'difficulty': 'medium',
    'content': ('<p>如图所示，液压式汽车起重机全部固定部分（包括汽车自重）总重为 '
                '$P_1 = 60\\ \\mathrm{kN}$，旋转部分总重为 $P_2 = 20\\ \\mathrm{kN}$，'
                '$a = 1.4\\ \\mathrm{m}$，$b = 0.4\\ \\mathrm{m}$，'
                '$l_1 = 1.85\\ \\mathrm{m}$，$l_2 = 1.4\\ \\mathrm{m}$。求：'
                '（1）当 $l = 3\\ \\mathrm{m}$、起吊重为 $P = 50\\ \\mathrm{kN}$ 时，'
                '支撑腿 A、B 所受地面的约束力；'
                '（2）当 $l = 5\\ \\mathrm{m}$ 时，为了保证起重机不致翻倒，问最大起重为多大？</p>'
                '<img src="[[FIG0]]">'),
    'answer': ('<p>（1）当 $l=3\\ \\mathrm{m}$、$P=50\\ \\mathrm{kN}$ 时：'
               '$F_A=33.2\\ \\mathrm{kN}$，$F_B=96.8\\ \\mathrm{kN}$。<br>'
               '（2）当 $l=5\\ \\mathrm{m}$ 时，为保证起重机不致翻倒的最大起重：'
               '$P_{\\max}=52.2\\ \\mathrm{kN}$。<br>'
               '（数值以原图为准）</p>'
               '<img src="[[FIG2]]">'),
    'explanation': ('<p>解：取整个起重机为研究对象，受力如图所示。</p>'
                    '<p><b>（1）求当 $l=3\\ \\mathrm{m}$、$P=50\\ \\mathrm{kN}$ 时的约束力 $F_A$、$F_B$。</b></p>'
                    '<p>$\sum M_A=0$：</p>'
                    '<p>$$-P_1(l_1-a)-P_2(l_1+b)-P(l_1+l)+F_B(l_1+l_2)=0$$</p>'
                    '<p>$$F_B=\\frac{P_1(l_1-a)+P_2(l_1+b)+P(l_1+l)}{l_1+l_2}'
                    '=\\frac{60\\times0.45+20\\times2.25+50\\times4.85}{3.25}'
                    '=96.8\\ \\mathrm{kN}$$</p>'
                    '<p>$\sum F_y=0$，$F_A+F_B-P_1-P_2-P=0$，故</p>'
                    '<p>$$F_A=P_1+P_2+P-F_B=60+20+50-96.8=33.2\\ \\mathrm{kN}$$</p>'
                    '<p><b>（2）求当 $l=5\\ \\mathrm{m}$ 时，保证起重机不翻倒的最大起重 $P_{\\max}$。</b></p>'
                    '<p>起重机不翻倒的临界状态为 $F_A=0$，$\sum M_B=0$：</p>'
                    '<p>$$P_1(a+l_2)+P_2(l_2-b)-P_{\\max}(l-l_2)=0$$</p>'
                    '<p>$$P_{\\max}=\\frac{P_1(a+l_2)+P_2(l_2-b)}{l-l_2}'
                    '=\\frac{60\\times2.8+20\\times1.0}{3.6}=52.2\\ \\mathrm{kN}$$</p>'
                    '<img src="[[FIG1]]">'),
    'figures': ['题库/qbank2_figs/q6_0.jpeg',
                '题库/qbank2_figs/q6_1.png',
                '题库/qbank2_figs/q6_2.png'],
}

q7 = {
    'overview': '求行动式起重机平衡锤的最小重力P2及最大距离x',
    'category': CAT,
    'question_type': QTYPE,
    'knowledge_points': KP,
    'difficulty': 'medium',
    'content': ('<p>如图所示，行动式起重机不计平衡锤的重为 $P = 500\\ \\mathrm{kN}$，'
                '其重心在离右轨 $1.5\\ \\mathrm{m}$ 处。起重机的起重力为 '
                '$P_1 = 250\\ \\mathrm{kN}$，突臂伸出离右轨 $10\\ \\mathrm{m}$。'
                '跑车本身重力略去不计，欲使跑车满载时起重机均不致翻倒，求平衡锤的最小重力 '
                '$P_2$ 以及平衡锤到左轨的最大距离 $x$。</p>'
                '<img src="[[FIG0]]">'),
    'answer': ('<p>$P_2=333\\ \\mathrm{kN}$，$x_{\\max}=6.75\\ \\mathrm{m}$。</p>'
               '<img src="[[FIG2]]">'),
    'explanation': ('<p>解：取整个起重机为研究对象，受力如图所示。</p>'
                    '<p><b>（1）起重机满载时不向右倾倒</b>，临界状态为 $F_A=0$，$\sum M_B=0$：</p>'
                    '<p>$$P_2(x+3)-P\\times1.5-P_1\\times10=0$$</p>'
                    '<p>$$P_2(x+3)=500\\times1.5+250\\times10=3250$$</p>'
                    '<p><b>（2）起重机空载时向左不倾倒</b>，临界状态为 $F_B=0$，$\sum M_A=0$：</p>'
                    '<p>$$P_2x-P\\times4.5=0\\qquad\\Rightarrow\\qquad P_2x=500\\times4.5=2250$$</p>'
                    '<p>式（1）、（2）联立，解得：</p>'
                    '<p>$$P_2=333\\ \\mathrm{kN},\\qquad x=x_{\\max}=6.75\\ \\mathrm{m}$$</p>'
                    '<img src="[[FIG1]]">'),
    'figures': ['题库/qbank2_figs/q7_0.jpeg',
                '题库/qbank2_figs/q7_1.png',
                '题库/qbank2_figs/q7_2.png'],
}

q8 = {
    'overview': '求飞机起落架A、B两处的约束力',
    'category': CAT,
    'question_type': QTYPE,
    'knowledge_points': KP,
    'difficulty': 'medium',
    'content': ('<p>飞机起落架，尺寸如图所示，A、B、C 均为铰链，杆 OA 垂直于 AB 连线。'
                '当飞机等速直线滑行时，地面作用于轮上的铅直正压力 $F_N = 30\\ \\mathrm{kN}$，'
                '水平摩擦力和各杆自重都比较小，可略去不计。求 A、B 两处的约束力。</p>'
                '<img src="[[FIG0]]">'),
    'answer': ('<p>$F_B=22.4\\ \\mathrm{kN}$（拉）。<br>'
               '$F_{Ax}=-4.67\\ \\mathrm{kN}$，$F_{Ay}=-47.7\\ \\mathrm{kN}$'
               '（负号表示与图示假设方向相反）。</p>'
               '<img src="[[FIG2]]">'),
    'explanation': ('<p>解：如图，杆 BC 为二力杆，$F_B$ 沿 BC。</p>'
                    '<p>$\sum M_A=0$：</p>'
                    '<p>$$-F_N\\sin15^\\circ\\times1.2+F_B\\times'
                    '\\frac{0.6}{\\sqrt{0.4^2+0.6^2}}\\times0.5=0$$</p>'
                    '<p>$$F_B=\\frac{F_N\\sin15^\\circ\\times1.2\\times'
                    '\\sqrt{0.4^2+0.6^2}}{0.6\\times0.5}=22.4\\ \\mathrm{kN}\\quad(\\text{拉})$$</p>'
                    '<p>$\sum F_x=0$：</p>'
                    '<p>$$F_{Ax}-F_N\\sin15^\\circ+F_B\\times'
                    '\\frac{0.4}{\\sqrt{0.4^2+0.6^2}}=0\\quad\\Rightarrow\\quad '
                    'F_{Ax}=-4.67\\ \\mathrm{kN}$$</p>'
                    '<p>$\sum F_y=0$：</p>'
                    '<p>$$F_{Ay}+F_N\\cos15^\\circ+F_B\\times'
                    '\\frac{0.6}{\\sqrt{0.4^2+0.6^2}}=0\\quad\\Rightarrow\\quad '
                    'F_{Ay}=-47.7\\ \\mathrm{kN}$$</p>'
                    '<img src="[[FIG1]]"><img src="[[FIG3]]">'),
    'figures': ['题库/qbank2_figs/q8_2.png',
                '题库/qbank2_figs/q8_0.png',
                '题库/qbank2_figs/q8_1.png',
                '题库/qbank2_figs/q8_4.jpeg'],
}

q9 = {
    'overview': '求滑道连杆机构力偶矩M与角θ的关系',
    'category': CAT,
    'question_type': QTYPE,
    'knowledge_points': KP,
    'difficulty': 'easy',
    'content': ('<p>图所示滑道连杆机构，在滑道连杆上作用着水平力 $F$。已知 $OA = r$，'
                '滑道倾角为 $\\beta$，机构重力和各处摩擦均不计。求当机构平衡时，'
                '作用在曲柄 OA 上的力偶矩 $M$ 与角 $\\theta$ 之间的关系。</p>'
                '<img src="[[FIG0]]">'),
    'answer': ('<p>$$M=Fr\\cdot\\frac{\\cos(\\beta-\\theta)}{\\sin\\beta}$$</p>'
               '<img src="[[FIG2]]">'),
    'explanation': ('<p>解：</p>'
                    '<p><b>（1）滑道连杆受力分析</b></p>'
                    '<p>$\sum F_x=0$：$F_N\\sin\\beta-F=0$，故</p>'
                    '<p>$$F_N=\\frac{F}{\\sin\\beta}$$</p>'
                    '<p><b>（2）曲柄 OA 及滑块 A 受力分析</b></p>'
                    '<p>$\sum M_O=0$：$-M+F_N\\,r\\cos(\\beta-\\theta)=0$，故</p>'
                    '<p>$$M=F_N\\,r\\cos(\\beta-\\theta)$$</p>'
                    '<p>将式（1）代入式（2），得</p>'
                    '<p>$$M=Fr\\cdot\\frac{\\cos(\\beta-\\theta)}{\\sin\\beta}$$</p>'
                    '<img src="[[FIG1]]">'),
    'figures': ['题库/qbank2_figs/q9_0.jpeg',
                '题库/qbank2_figs/q9_1.png',
                '题库/qbank2_figs/q9_2.png'],
}

q10 = {
    'overview': '求闸门启闭设备最小启门力偶矩M及轴O3约束力',
    'category': CAT,
    'question_type': QTYPE,
    'knowledge_points': KP,
    'difficulty': 'hard',
    'content': ('<p>图所示为 1 种闸门启闭设备的传动系统。已知各齿轮的半径分别为 '
                '$r_1$、$r_2$、$r_3$、$r_4$，鼓轮的半径为 $r$，闸门重力为 $P$，'
                '齿轮的压力角为 $\\theta$，不计各齿轮的自重，求最小的启门力偶矩 $M$ '
                '及轴 $O_3$ 的约束力。</p>'
                '<img src="[[FIG0]]">'),
    'answer': ('<p>最小的启门力偶矩：</p>'
               '<p>$$M=\\frac{Pr\\,r_1r_3}{r_2r_4}$$</p>'
               '<p>轴 $O_3$ 的约束力：</p>'
               '<p>$$F_{O_3x}=\\frac{Pr}{r_4}\\tan\\theta,\\qquad '
               'F_{O_3y}=P\\left(1-\\frac{r}{r_4}\\right)$$</p>'),
    'explanation': ('<p>解：</p>'
                    '<p><b>（1）轮 $O_3$（鼓轮与齿轮 $r_4$）受力如图所示</b></p>'
                    '<p>$\sum M_{O_3}=0$：$P\\cdot r-F_2\\cos\\theta\\cdot r_4=0$，故</p>'
                    '<p>$$F_2=\\frac{Pr}{r_4\\cos\\theta}$$</p>'
                    '<p>$\sum F_x=0$：$F_{O_3x}-F_2\\sin\\theta=0$，故</p>'
                    '<p>$$F_{O_3x}=F_2\\sin\\theta=\\frac{Pr}{r_4}\\tan\\theta$$</p>'
                    '<p>$\sum F_y=0$：$F_{O_3y}+F_2\\cos\\theta-P=0$，故</p>'
                    '<p>$$F_{O_3y}=P-F_2\\cos\\theta=P\\left(1-\\frac{r}{r_4}\\right)$$</p>'
                    '<p><b>（2）轮 $O_1$（齿轮 $r_1$）受力如图所示</b></p>'
                    '<p>$\sum M_{O_1}=0$：$-F_1\\cos\\theta\\cdot r_1+M=0$，故</p>'
                    '<p>$$M=F_1\\cos\\theta\\cdot r_1$$</p>'
                    '<p><b>（3）轮 $O_2$（齿轮 $r_2$、$r_3$）受力如图所示</b></p>'
                    '<p>$\sum M_{O_2}=0$：$F_1\\cos\\theta\\cdot r_2-F_2\\cos\\theta\\cdot r_3=0$，故</p>'
                    '<p>$$F_1r_2=F_2r_3$$</p>'
                    '<p><b>（4）将（1）、（2）、（3）式代入</b>，得</p>'
                    '<p>$$M=F_1\\cos\\theta\\cdot r_1=\\frac{F_2r_3}{r_2}\\cos\\theta\\cdot r_1'
                    '=\\frac{Pr}{r_4\\cos\\theta}\\cdot\\frac{r_3}{r_2}\\cos\\theta\\cdot r_1'
                    '=\\frac{Pr\\,r_1r_3}{r_2r_4}$$</p>'
                    '<img src="[[FIG1]]"><img src="[[FIG2]]">'),
    'figures': ['题库/qbank2_figs/q10_3.png',
                '题库/qbank2_figs/q10_0.png',
                '题库/qbank2_figs/q10_1.png'],
}

data = {'q6': q6, 'q7': q7, 'q8': q8, 'q9': q9, 'q10': q10}

for name, d in data.items():
    # overview 限 28 字
    assert len(d['overview']) <= 28, (name, len(d['overview']), d['overview'])
    path = os.path.join(OUT, name + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print('written', path)

# 校验所有 [[FIGn]] 都有对应 figures 元素
for name, d in data.items():
    import re
    used = set(re.findall(r'\[\[FIG(\d+)\]\]', d['content'] + d['answer'] + d['explanation']))
    for u in used:
        assert int(u) < len(d['figures']), (name, u, len(d['figures']))
print('all [[FIGn]] references valid')
