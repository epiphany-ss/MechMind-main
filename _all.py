import json, re
from playwright.sync_api import sync_playwright
U={"id":"u_001","student_id":"202501040104","name":"孙晞凯","role":"admin"}
# 讨论区作者名池（123 个）
NAMES = json.load(open('_n.json',encoding='utf-8'))
PAGES = ["index.html","forum.html","search.html","account.html"]
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge")
    for page in PAGES:
        c=b.new_context(viewport={"width":1512,"height":950})
        c.add_init_script("localStorage.setItem('current_user', %s)"%json.dumps(json.dumps(U,ensure_ascii=False)))
        c.route("**://**", lambda r: r.abort() if "localhost" not in r.request.url else r.continue_())
        pg=c.new_page(); bad=[]; pg.on("pageerror", lambda e: bad.append(str(e)))
        pg.goto("http://localhost:8080/"+page, wait_until="networkidle", timeout=60000); pg.wait_for_timeout(1500)
        txt = pg.evaluate("()=>document.body.innerText")
        leaked=[n for n in NAMES if n in txt]
        # 首页「问题探讨预览」那块单独看
        extra=""
        if page=="index.html":
            extra = " | 预览区作者名span数=%d 头像数=%d" % (
                pg.eval_on_selector_all(".fp-meta span:first-child","e=>e.filter(x=>x.textContent.includes('👤')).length"),
                pg.eval_on_selector_all(".fp-avatar","e=>e.length"))
        print("%-13s 泄漏讨论作者名: %-8s%s %s" % (page, (leaked[:3] if leaked else "无 ✅"), extra, ("JS异常:"+str(bad[:1])) if bad else ""))
        if page=="index.html":
            pg.evaluate("document.querySelector('.forum-preview-grid').scrollIntoView({block:'center'})"); pg.wait_for_timeout(500)
            box=pg.evaluate("()=>{const r=document.querySelector('.forum-preview-grid').getBoundingClientRect();return {x:Math.max(0,r.x-20),y:Math.max(0,r.y-20),width:Math.min(1512,r.width+40),height:Math.min(800,r.height+40)};}")
            pg.screenshot(path="_fp.png", clip=box, timeout=20000)
        c.close()
    b.close()

# 刷新按钮是否只在讨论区
import subprocess
print()
for f in ["index.html","search.html","account.html","weaknesses.html","hall.html","ai_qa.html","knowledge_framework.html","personal_knowledge.html","mindmap.html","mechanism.html","hall.html","learning_notes.html"]:
    s=open(f,encoding='utf-8').read()
    if 'forumRefreshBtn' in s: print("⚠️ %s 里也有刷新按钮"%f)
print("刷新按钮只在 forum.html ✅（上面没输出就是没有）")
