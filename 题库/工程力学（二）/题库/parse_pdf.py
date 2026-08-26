# -*- coding: utf-8 -*-
"""权威解析器：结构用整页文本逐行解析；附图用页面块按位置关联到题目
输出: 题库/questions_parsed.json
"""
import fitz
import json
import re
import os

PDF = '题库/2022理论力学习题集 2023版.pdf'
OUT = '题库/questions_parsed.json'
FIG_DIR = '题库/figures'
ANS_PAGE = 126

KNOWN_SEC = {'是非题', '选择题', '填空题', '计算题', '作图题', '解答题', '证明题', '判断题'}

doc = fitz.open(PDF)


# ---------- 1) 整页文本结构解析 ----------
def parse_structure():
    text = open('题库/exercises_text.txt', encoding='utf-8').read()
    pages = re.split(r'<<<<<<<<<< PAGE (\d+) >>>>>>>>>>', text)
    # pages: ['', '1', content, '2', content, ...]
    chapters = []       # 按出现顺序
    cur_ch = None
    cur_sec = None
    cur_q = None
    sec_title_re = re.compile(r'^[一二三四五六七八九十]+、\s*(.+)$')

    page_of_line = 0
    body_pages = []
    # 逐页
    for i in range(1, len(pages), 2):
        pno = int(pages[i])
        if pno < 3 or pno >= ANS_PAGE + 1:
            continue
        content = pages[i + 1]
        for line in content.split('\n'):
            s = line.strip()
            if not s:
                continue
            # 页眉/页脚页码
            if re.fullmatch(r'\d{1,3}', s) and len(s) <= 3:
                continue
            # 篇标题
            if re.match(r'^第[一二三]篇', s):
                continue
            # 章标题
            m = re.match(r'^第\s*(\d{1,2})\s*章\s*(.+)$', s)
            if m and len(m.group(2)) < 12:
                if cur_q is not None and cur_sec is not None:
                    cur_sec['items'].append(cur_q)
                if cur_ch is not None:
                    chapters.append(cur_ch)
                cur_ch = {'ch': int(m.group(1)), 'name': m.group(2).strip(), 'sections': []}
                cur_sec = None
                cur_q = None
                continue
            # 节标题
            m = sec_title_re.match(s)
            if m:
                name = re.sub(r'[^一-鿿]', '', m.group(1))
                if name in KNOWN_SEC:
                    if cur_q is not None and cur_sec is not None:
                        cur_sec['items'].append(cur_q)
                    cur_sec = {'type': name, 'items': []}
                    cur_ch['sections'].append(cur_sec)
                    cur_q = None
                    continue
            # 新题号
            m = re.match(r'^(\d{1,3})、', s)
            if m and cur_ch is not None and cur_sec is not None:
                if cur_q is not None:
                    cur_sec['items'].append(cur_q)
                cur_q = {'num': int(m.group(1)), 'text': [s], 'page': pno}
                continue
            # 接续
            if cur_q is not None:
                cur_q['text'].append(s)

    if cur_q is not None and cur_sec is not None:
        cur_sec['items'].append(cur_q)
    if cur_ch is not None:
        chapters.append(cur_ch)

    # 合并文本、清空空白，加全局索引
    total = 0
    for ch in chapters:
        for sec in ch['sections']:
            for q in sec['items']:
                q['text'] = ' '.join(q['text']).strip()
                q['idx'] = total
                q['figs'] = []
                total += 1
    return chapters, total


# ---------- 2) 附图：按页面块位置关联到题目 ----------
def cluster_rects(rects):
    rects = sorted(rects, key=lambda r: (r.y0, r.x0))
    clusters = []
    for r in rects:
        placed = False
        for c in clusters:
            if abs(c.y1 - r.y0) < 40 and c.x0 - 50 < r.x0 < c.x1 + 50:
                c |= r
                placed = True
                break
        if not placed:
            clusters.append(fitz.Rect(r))
    return clusters


def build_index(chapters):
    """page_start_questions: page -> [idx,...]（该页起始的题目全局索引，按顺序）"""
    page_map = {}
    for ch in chapters:
        for sec in ch['sections']:
            for q in sec['items']:
                page_map.setdefault(q['page'], []).append(q['idx'])
    return page_map


def associate_figures(chapters):
    os.makedirs(FIG_DIR, exist_ok=True)

    all_qs = [q for ch in chapters for sec in ch['sections'] for q in sec['items']]  # 已按 idx 有序
    q_by_idx = {q['idx']: q for q in all_qs}
    qnum_re = re.compile(r'^(\d{1,3})、')
    q_fig_rects = {}  # idx -> [(page, Rect)]

    # 全局题目指针：从上一页携带
    gptr = 0  # 当前题目在 all_qs 中的位置

    for pno in range(2, ANS_PAGE):
        page = doc[pno]
        blocks = sorted(page.get_text('blocks'), key=lambda b: (b[1], b[0]))
        rects = [d['rect'] for d in page.get_drawings() if d['rect'].width > 4 and d['rect'].height > 4]
        fig_clusters = cluster_rects(rects)

        # 先记录本页题号块位置序列（用于把图关联到正确题目）
        qnum_ys = []  # [(y, all_qs_idx)]
        for b in blocks:
            t = b[4].strip()
            if not t:
                continue
            fl = t.split('\n')[0].strip()
            m = qnum_re.match(fl)
            if m and gptr + 1 < len(all_qs):
                # 上一题收尾，进入下一题
                gptr += 1
                qnum_ys.append((b[1], gptr))
            else:
                qnum_ys.append((b[1], gptr))

        if not fig_clusters:
            continue

        for fc in fig_clusters:
            if fc.width < 18 or fc.height < 14:
                continue
            cy = (fc.y0 + fc.y1) / 2
            best_idx = None
            for y, qidx in qnum_ys:
                if y <= cy + 5:
                    best_idx = qidx
                else:
                    break
            if best_idx is None and qnum_ys:
                best_idx = qnum_ys[0][1]
            if best_idx is None or q_by_idx.get(best_idx) is None:
                continue
            q_fig_rects.setdefault(best_idx, []).append((pno, fitz.Rect(fc)))

    # 渲染：每题的图区域合并为一张整图
    fig_count = 0
    for idx, rects in q_fig_rects.items():
        q = q_by_idx[idx]
        by_page = {}
        for pno, r in rects:
            by_page.setdefault(pno, []).append(r)
        for pno, rs in by_page.items():
            union = fitz.Rect(rs[0])
            for r in rs[1:]:
                union |= r
            pad = 8
            page = doc[pno]
            clip = fitz.Rect(max(0, union.x0 - pad), max(0, union.y0 - pad),
                             min(page.rect.width, union.x1 + pad), min(page.rect.height, union.y1 + pad))
            if clip.width < 12 or clip.height < 12:
                continue
            fname = f'ch{pno+1}_idx{idx}_{len(q["figs"])}.png'
            pix = page.get_pixmap(clip=clip, dpi=120)
            if pix.width > 25 and pix.height > 25:
                pix.save(os.path.join(FIG_DIR, fname))
                q['figs'].append(fname)
                fig_count += 1

    return fig_count


def main():
    chapters, total = parse_structure()
    fig_count = associate_figures(chapters)
    result = {'total': total, 'chapters': chapters}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'解析完成: 章节{len(chapters)}, 总题{total}, 附图{fig_count}')


if __name__ == '__main__':
    main()
