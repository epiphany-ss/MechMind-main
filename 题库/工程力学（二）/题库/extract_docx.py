# -*- coding: utf-8 -*-
"""从 题库1_3.pdf（docx转换）解析题目：文本 + 图片 + OCR 分类（解答图/答案图/附图）
输出: 题库/qbank2_questions.json  (前 N 题)
"""
import fitz
import re
import json
import easyocr
import io
import os

PDF = '题库/题库1_3.pdf'
OUT = '题库/qbank2_questions.json'
FIG_DIR = '题库/qbank2_figs'
MAX_Q = 20   # 先处理前20题

reader = None


def get_reader():
    global reader
    if reader is None:
        reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)
    return reader


def classify_image(png_bytes):
    """OCR 图片，返回 (类型, 文本)。类型: answer/explain/fig/unknown"""
    try:
        r = get_reader()
        res = r.readtext(png_bytes)
        text = ' '.join(x[1] for x in res)
        if not text.strip():
            return 'fig', ''
        # 解答图：含"解"开头或"研究对象/解得/求解/代入"
        if text.strip().startswith('解') or ('解得' in text) or ('研究对象' in text) or ('求解' in text):
            return 'explain', text
        # 答案图：短文本含数字/等号（结果）
        stripped = text.replace(' ', '')
        if len(stripped) <= 60 and re.search(r'[=＝]', text) and re.search(r'[0-9０-９]', text):
            return 'answer', text
        return 'fig', text
    except Exception:
        return 'unknown', ''


def is_question_text(t):
    t = t.strip()
    # 题号格式: "1简单." "2中等 ." "5-13 简单" "14-12 中等" "3中等." "8，简单."
    return bool(re.match(r'^\d{1,3}[，\s,]*[简单中困]', t) or re.match(r'^\d{1,2}-\d{1,2}\s*[简单中困]', t))


def main():
    doc = fitz.open(PDF)
    os.makedirs(FIG_DIR, exist_ok=True)

    questions = []      # 最终题目
    cur = None          # 当前正在组装的题目
    cur_ch = None       # 当前章节

    for pno in range(len(doc)):
        page = doc[pno]
        text = page.get_text().strip()
        # 去页码
        text = re.sub(r'^\s*\d{1,3}\s*$', '', text)
        # 章节标题：记录并去掉标题行，继续处理同页题目
        if re.match(r'^第\s*\d+\s*章', text):
            m = re.match(r'^第\s*(\d+)\s*章\s*(.+)', text)
            if m:
                cur_ch = {'num': int(m.group(1)), 'name': m.group(2).strip()}
            text = re.sub(r'^第\s*\d+\s*章[^\n]*\n?', '', text).strip()
            if not text:
                continue

        # 题目开始？
        first_line = text.split('\n')[0].strip() if text else ''
        is_new = is_question_text(first_line) if first_line else False

        # 图片
        imgs = []
        seen = set()
        for im in page.get_images(full=True):
            xref = im[0]
            if xref in seen:
                continue
            seen.add(xref)
            d = doc.extract_image(xref)
            imgs.append({'data': d['image'], 'ext': d['ext'], 'w': d['width'], 'h': d['height']})

        if is_new or cur is None:
            if cur is not None:
                questions.append(cur)
            if len(questions) >= MAX_Q:
                break
            cur = {'page': pno + 1, 'text': text, 'imgs': imgs, 'chapter': cur_ch}
        else:
            # 延续页：把文字和图并入上一题
            if cur is not None:
                cur['text'] += ' ' + text
                cur['imgs'].extend(imgs)

    if cur is not None and len(questions) < MAX_Q:
        questions.append(cur)

    # OCR 分类每题图片
    for qi, q in enumerate(questions):
        classified = {'figs': [], 'answer': [], 'explain': []}
        for im in q['imgs']:
            try:
                typ, txt = classify_image(im['data'])
            except Exception:
                typ, txt = 'unknown', ''
            im['type'] = typ
            im['text'] = txt[:80]
            if typ == 'answer':
                classified['answer'].append(im)
            elif typ == 'explain':
                classified['explain'].append(im)
            elif typ == 'fig':
                classified['figs'].append(im)
            else:
                # unknown → 默认附图
                classified['figs'].append(im)
        q['classified'] = classified
        # 保存图文件，JSON 只保留路径与元信息
        for i, im in enumerate(q['imgs']):
            fn = f'{FIG_DIR}/q{qi+1}_{i}.{im["ext"]}'
            with open(fn, 'wb') as f:
                f.write(im['data'])
            im['file'] = fn
            del im['data']

    result = {'total': len(questions), 'questions': questions}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'解析完成: {len(questions)} 题')
    for qi, q in enumerate(questions):
        c = q['classified']
        print(f'第{qi+1}题: 附图{len(c["figs"])} 答案图{len(c["answer"])} 解答图{len(c["explain"])} | {q["text"][:30]}')


if __name__ == '__main__':
    main()
