import json
from playwright.sync_api import sync_playwright
U={"id":"u_001","student_id":"202501040104","name":"孙晞凯","role":"admin"}
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge")
    for w in [1512,1280,1024,900,768,600,420]:
        c=b.new_context(viewport={"width":w,"height":950})
        c.add_init_script("localStorage.setItem('current_user', %s)"%json.dumps(json.dumps(U,ensure_ascii=False)))
        c.route("**://**", lambda r: r.abort() if "localhost" not in r.request.url else r.continue_())
        pg=c.new_page(); bad=[]; pg.on("pageerror", lambda e: bad.append(str(e)))
        pg.goto("http://localhost:8080/index.html", wait_until="domcontentloaded"); pg.wait_for_timeout(1400)
        r = pg.evaluate("""()=>{
          const bs=[...document.querySelectorAll('.knowledge-branch')].map(e=>{const b=e.getBoundingClientRect();
            return {x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height),
                    t:e.querySelector('h5').textContent.trim()};});
          const hs=[...document.querySelectorAll('.knowledge-branch h5')].map(e=>Math.round(e.getBoundingClientRect().top));
          const ts=[...document.querySelectorAll('.knowledge-branch .branch-topics')].map(e=>Math.round(e.getBoundingClientRect().bottom));
          return {bs,hs,ts,ov:document.documentElement.scrollWidth>document.documentElement.clientWidth};}""")
        cols = sorted(set(x['x'] for x in r['bs'])); rows = sorted(set(x['y'] for x in r['bs']))
        widths = sorted(set(x['w'] for x in r['bs'])); heights = sorted(set(x['h'] for x in r['bs']))
        grid = "2列" if len(cols)==2 else ("1列" if len(cols)==1 else "%d列"%len(cols))
        print("%4dpx  %s 列×%d 行 | 卡宽%s 卡高%s | 标题 y=%s | 标签底 y=%s | 溢出=%s %s" % (
            w, grid, len(rows), widths, heights, r['hs'], r['ts'], r['ov'], ("异常:"+str(bad[:2])) if bad else ""))
        if w==1512:
            y=pg.evaluate("()=>Math.round(document.querySelector('.knowledge-branches').getBoundingClientRect().top)")
            pg.screenshot(path="_kb.png", clip={"x":0,"y":max(0,y-140),"width":1512,"height":560})
        c.close()
    b.close()
