# -*- coding: utf-8 -*-
"""把 题库/upload/ch*.json 的题目批量上传到服务器，并删除旧题"""
import base64
import glob
import json
import re
import sys
import time
import urllib.request

BASE = 'http://localhost:8090'
FIG_BASE = '题库/'


def post(path, payload, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(BASE + path,
                data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                headers={'Content-Type': 'application/json'})
            return json.loads(urllib.request.urlopen(req, timeout=120).read().decode('utf-8'))
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(2)


def embed_figures(content, figures):
    figures = figures or []
    for i, f in enumerate(figures, 1):
        path = f if f.startswith(('题库', 'qdata')) else (FIG_BASE + f)
        try:
            with open(path, 'rb') as fh:
                b64 = base64.b64encode(fh.read()).decode()
            content = content.replace(f'[[FIG{i}]]', f'<img src="data:image/png;base64,{b64}" alt="附图" style="max-width:100%">')
        except Exception:
            content = content.replace(f'[[FIG{i}]]', '')
    content = re.sub(r'\[\[FIG\d+\]\]', '', content)
    return content


def main():
    files = sorted(glob.glob('题库/upload/ch*.json'))
    if not files:
        print('没有 ch*.json 文件')
        return
    total_ok = 0
    total_fail = 0
    for f in files:
        data = json.load(open(f, encoding='utf-8'))
        cat = data.get('category', '')
        questions = data.get('questions', [])
        print(f'== {f}: {len(questions)} 题 ==')
        for q in questions:
            content = embed_figures(q.get('content', ''), q.get('figures', []))
            payload = {
                'overview': q.get('overview', ''),
                'subject': '理论力学',
                'category': cat,
                'knowledge_points': q.get('knowledge_points', []),
                'question_type': q.get('question_type', '解答题'),
                'difficulty': q.get('difficulty', 'medium'),
                'content': content,
                'answer': q.get('answer', ''),
                'explanation': q.get('explanation', ''),
            }
            try:
                r = post('/api/upload', payload)
                if r.get('ok'):
                    total_ok += 1
                else:
                    total_fail += 1
                    print('  失败:', r.get('message'), '|', payload['overview'][:30])
            except Exception as e:
                total_fail += 1
                print('  异常:', e, '|', payload['overview'][:30])
    print(f'\n上传完成: 成功{total_ok}, 失败{total_fail}')
    return total_ok, total_fail


def delete_old(ids):
    for qid in ids:
        try:
            req = urllib.request.Request(BASE + '/api/delete?id=' + qid, method='DELETE')
            json.loads(urllib.request.urlopen(req, timeout=60).read().decode('utf-8'))
            print('已删除旧题:', qid)
        except Exception as e:
            print('删除失败', qid, e)


if __name__ == '__main__':
    if '--delete-old' in sys.argv:
        delete_old(['q_001', 'q_002', 'q_003', 'q_004', 'q_005', 'q_006'])
    else:
        main()
