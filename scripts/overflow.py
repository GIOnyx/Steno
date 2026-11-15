from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':420,'height':800})
    for url in ['http://localhost:3123/gregg','http://localhost:3123/tsn']:
        pg.goto(url); pg.wait_for_timeout(1500)
        print(url, pg.evaluate("[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,6).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right))"))
    b.close()
