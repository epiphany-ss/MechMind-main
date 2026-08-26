# -*- coding: utf-8 -*-
"""读取 qbank2_questions.json，构建上传 payload 并批量上传（来源=老题库）"""
import base64
import json
import re
import time
import urllib.request

BASE = 'http://localhost:8090'

# 章节 → (category, knowledge_points)
CH_MAP = {
    1: ('静力学', ['静力学公理', '受力分析']),
    2: ('静力学', ['平面力系', '力与力偶']),
    3: ('静力学', ['平面力系']),
    4: ('静力学', ['空间力系']),
    5: ('静力学', ['摩擦']),
    6: ('静力学', ['静力学公理', '受力分析']),
    7: ('运动学', ['点的运动学']),
    8: ('运动学', ['刚体平动', '刚体定轴转动']),
    9: ('运动学', ['点的合成运动', '科氏加速度']),
    10: ('运动学', ['刚体平面运动', '速度瞬心']),
    11: ('动力学', ['质点动力学']),
    12: ('动力学', ['动量定理']),
    13: ('动力学', ['动量矩定理', '转动惯量']),
    14: ('动力学', ['动能定理']),
    15: ('分析力学', ['虚位移原理', '虚功']),
}

DIFF_MAP = {'简': 'easy', '中': 'medium', '困': 'hard'}


def post(path, payload):
    req = urllib.request.Request(BASE + path,
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read().decode('utf-8'))


def img_tag(path, alt='图'):
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    return f'<img src="data:image/png;base64,{b64}" alt="{alt}" style="max-width:100%">'


def clean_text(text):
    # 去掉题号+难度前缀，如 "1简单." "2中等 ." "5困难."
    text = re.sub(r'^\d{1,3}[，\s,]*[简中困][难等单]?\.?\s*', '', text.strip())
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def get_difficulty(text):
    m = re.match(r'^\d{1,3}[，\s,]*([简中困])', text)
    return DIFF_MAP.get(m.group(1) if m else '', 'medium')


def main():
    data = json.load(open('题库/qbank2_questions.json', encoding='utf-8'))
    questions = data['questions']
    ok = fail = 0
    for qi, q in enumerate(questions):
        ch = (q.get('chapter') or {}).get('num') or 1
        cat, kps = CH_MAP.get(ch, ('静力学', ['受力分析']))
        text = clean_text(q['text'])
        diff = get_difficulty(q['text'])
        qtype = '解答题' if '受力图' in text else '计算题'
        overview = text[:28] if text else f'第{ch}章题目'

        # 组装图片
        figs = q['classified']['figs']
        ans_imgs = q['classified']['answer']
        exp_imgs = q['classified']['explain']

        content = '<p>' + text + '</p>'
        for f in figs:
            content += img_tag(f['file'])

        # 答案：答案图；没有则提示见附图
        if ans_imgs:
            answer = '<p><b>答案：</b></p>' + ''.join(img_tag(a['file'], '答案') for a in ans_imgs)
        else:
            answer = '<p>（答案见本题附图）</p>'

        # 解析：解答图；没有则提示
        if exp_imgs:
            explanation = '<p><b>解析：</b></p>' + ''.join(img_tag(e['file'], '解析') for e in exp_imgs)
        else:
            explanation = '<p>（解析见本题附图）</p>'

        payload = {
            'overview': overview,
            'subject': '理论力学',
            'category': cat,
            'knowledge_points': kps,
            'question_type': qtype,
            'source': '老题库',
            'difficulty': diff,
            'content': content,
            'answer': answer,
            'explanation': explanation,
        }
        try:
            r = post('/api/upload', payload)
            if r.get('ok'):
                ok += 1
                print(f'[{qi+1}] {r["id"]} {qtype} {diff} {overview[:18]}')
            else:
                fail += 1
                print(f'[{qi+1}] 失败: {r.get("message")} {overview[:20]}')
        except Exception as e:
            fail += 1
            print(f'[{qi+1}] 异常: {str(e)[:80]} {overview[:20]}')
    print(f'完成: 成功{ok}, 失败{fail}')


if __name__ == '__main__':
    main()
