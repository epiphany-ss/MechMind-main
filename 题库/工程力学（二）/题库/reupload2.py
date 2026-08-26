# -*- coding: utf-8 -*-
"""读取 题库/upload2/q*.json（转录修正后的20题），删除旧老题库题，重新上传"""
import base64
import glob
import json
import re
import urllib.request

BASE = 'http://localhost:8090'


def post(path, payload):
    req = urllib.request.Request(BASE + path,
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read().decode('utf-8'))


def delete(qid):
    req = urllib.request.Request(BASE + '/api/delete?id=' + qid, method='DELETE')
    return json.loads(urllib.request.urlopen(req, timeout=60).read().decode('utf-8'))


def embed_figures(content, figures):
    # content 里已含 <img src="[[FIGn]]">，这里只替换占位符为 data URI
    for i, f in enumerate(figures):
        try:
            with open(f, 'rb') as fh:
                b64 = base64.b64encode(fh.read()).decode()
            content = content.replace(f'[[FIG{i}]]', f'data:image/png;base64,{b64}')
        except Exception:
            content = content.replace(f'[[FIG{i}]]', '')
    content = re.sub(r'\[\[FIG\d+\]\]', '', content)
    return content


def main():
    # 1) 删除旧的20题（来源=老题库）
    d = json.loads(urllib.request.urlopen(BASE + '/api/list').read().decode('utf-8'))
    old = [q['id'] for q in d['questions'] if q.get('source') == '老题库']
    for qid in old:
        r = delete(qid)
        print('删除:', qid, r.get('ok'))
    print(f'已删除旧老题库 {len(old)} 题')

    # 2) 上传转录修正的20题
    files = sorted(glob.glob('题库/upload2/q*.json'), key=lambda x: int(re.search(r'q(\d+)', x).group(1)))
    ok = fail = 0
    for f in files:
        q = json.load(open(f, encoding='utf-8'))
        content = embed_figures(q.get('content', ''), q.get('figures', []))
        answer = q.get('answer', '')
        explanation = q.get('explanation', '')
        payload = {
            'overview': q.get('overview', ''),
            'subject': '理论力学',
            'category': q.get('category', '静力学'),
            'knowledge_points': q.get('knowledge_points', []),
            'question_type': q.get('question_type', '计算题'),
            'source': '老题库',
            'difficulty': q.get('difficulty', 'medium'),
            'content': content,
            'answer': answer,
            'explanation': explanation,
        }
        try:
            r = post('/api/upload', payload)
            if r.get('ok'):
                ok += 1
                print(f'[{f}] {r["id"]} ok')
            else:
                fail += 1
                print(f'[{f}] 失败: {r.get("message")}')
        except Exception as e:
            fail += 1
            print(f'[{f}] 异常: {str(e)[:80]}')
    print(f'完成: 成功{ok}, 失败{fail}')


if __name__ == '__main__':
    main()
