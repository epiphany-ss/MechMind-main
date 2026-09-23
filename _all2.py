import json
from playwright.sync_api import sync_playwright
U={"id":"u_001","student_id":"202501040104","name":"孙晞凯","role":"admin"}
NAMES=json.load(open('_n.json',encoding='utf-8'))
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge")
    for page in ["index.html","forum.html","search.html","account.html"]:
        c=b.new_context(viewport={"width":1512,"height":950})
        c.add_init_script("localStorage.setItem('current_user', %s)"%json.dumps(json.dumps(U,ensure_ascii=False)))
        c.route("**://**", lambda r: r.abort() if "localhost" not in r.request.url else r.continue_())
        pg=c.new_page(); bad=[]; pg.on("pageerror", lambda e: bad.append(str(e)))
        pg.goto("http://localhost:8080/"+page, wait_until="networkidle", timeout=60000); pg.wait_for_timeout(1500)
        txt=pg.evaluate("()=>document.body.innerText")
        leaked=[n for n in NAMES if n in txt]
        # 详情页也看一遍（forum）
        extra=""
        if page=="forum.html":
            pg.eval_on_selector_all(".forum-post-item","items=>{let x=null,m=-1;for(const it of items){const n=parseInt(it.querySelector('.reply-count').textContent)||0;if(n>m){m=n;x=it;}}x&&x.click();}")
            pg.wait_for_timeout(1500)
            t2=pg.evaluate("()=>document.body.innerText")
            leaked += [n for n in NAMES if n in t2]
            extra=" | 含详情页"
        print("%-13s 泄漏讨论作者名: %s%s %s" % (page, (sorted(set(leaked))[:3] if leaked else "无 ✅"), extra, ("JS异常"+str(bad[:1])) if bad else ""))
        if page=="index.html":
            pg.evaluate("window.scrollTo(0,0)")
            y=pg.evaluate("()=>Math.round(document.querySelector('.forum-preview-grid').getBoundingClientRect().top)")
            pg.evaluate(f"window.scrollTo(0,{max(0,y-120)})"); pg.wait_for_timeout(500)
            pg.screenshot(path="_fp.png", clip={"x":100,"y":60,"width":1330,"height":420}, timeout=20000)
        c.close()
    b.close()
