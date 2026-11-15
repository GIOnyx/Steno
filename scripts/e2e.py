import os, sys
from playwright.sync_api import sync_playwright
A='/home/claude/tsn/'
OUT=A+'app/web/scripts/shots/'; os.makedirs(OUT, exist_ok=True)
SUMMARY = """5. Civil Case no/s. 958 and 964
Case Title: Crisanto Unabia, Sps. Ciriaco and Marie Navarro, Sps. Arcadio and Susana Lapinid, Sps. Jose and Rodelyn Navarro and Concepcion N. Cabradilla -versus- Sps. Guilermo Jimmy and Alma Ata and Jessica M. Lomongo (vice versa)
FOR: Recovery of Possession and other relief and Quieting of Title, Nullity of Extra-Judicial Settlement, etc.
Plaintiff's Counsel: Atty. Nathaniel Clarus / Atty. Joselito M. Alo
Defendant's Counsel: Atty. Joselito M. Alo / Atty. Nathaniel Clarus
Status: Defendants/Plaintiff's 4th witness cross-examination (Jessica Lomongo) Atty. Alo"""
base = sys.argv[1] if len(sys.argv)>1 else 'http://localhost:3123'
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':1360,'height':900}, accept_downloads=True); pg = ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e))); pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' else None)
    pg.goto(base+'/tsn'); pg.wait_for_selector('#paste, textarea')
    pg.fill('textarea[placeholder^="Civil Case"]', SUMMARY); pg.click('button:has-text("Fill in the form")')
    pg.fill('input[type=date]', '2026-10-13'); pg.fill('input[placeholder="Jessica M. Lomongo"]', 'Jessica M. Lomongo')
    pg.screenshot(path=OUT+'tsn-1.png', full_page=True)
    pg.click('.footbar >> text=Continue'); pg.set_input_files('input[type=file][accept=".docx,.txt"]', A+'samples/rec.docx'); pg.wait_for_selector('.blk.edge-s')
    print('range:', pg.inner_text('.rangebar .span').replace('\n',' '))
    pg.screenshot(path=OUT+'tsn-2.png')
    pg.click('.footbar >> text=Continue'); print('suggestions:', pg.locator('table.names tbody tr').count())
    for name in ['Crescento','Allo','Alon','Garos','Lumomo']:
        pg.locator('tr', has=pg.locator('td.heard', has_text=name)).first.locator('input[type=checkbox]').check()
    for f,t in [('Jonathan Jones','Nathaniel Clarus'),('Dr. Nialo','Atty. Alo')]:
        pg.fill('input[placeholder="Heard as"]', f); pg.fill('input[placeholder="Change to"]', t); pg.click('button:has-text("Add replacement")')
    pg.screenshot(path=OUT+'tsn-3.png', full_page=True)
    pg.click('.footbar >> text=Continue'); pg.wait_for_selector('.sheet .row')
    print('rows:', pg.locator('.sheet .row').count(), '|', pg.inner_text('.badge'))
    pg.locator('.u').nth(4).click(); pg.keyboard.press('c'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('1'); pg.keyboard.press('m')
    print('after keys:', pg.locator('.sheet .row').count(), '|', pg.inner_text('.badge'))
    pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z'); print('after undo:', pg.locator('.sheet .row').count())
    pg.locator('.u').nth(6).click(); pg.keyboard.press('e'); pg.wait_for_selector('textarea[aria-label="Edit the words"]'); pg.keyboard.press('Home')
    for _ in range(12): pg.keyboard.press('ArrowRight')
    pg.keyboard.press('Control+Enter'); print('after split:', pg.locator('.u').count(), '|', pg.inner_text('.badge')); pg.keyboard.press('Control+z'); print('undo split:', pg.inner_text('.badge'))
    pg.locator('.u').nth(40).click(); pg.keyboard.press('h'); print('heads:', pg.locator('.row.head').count()); pg.keyboard.press('Delete'); print('heads after del:', pg.locator('.row.head').count())
    pg.locator('.row .lab').nth(5).click(); pg.wait_for_selector('.menu'); pg.screenshot(path=OUT+'tsn-4.png'); pg.keyboard.press('Escape')
    pg.fill('input[placeholder="PROS. EJEM"]', 'pros. ejem'); pg.click('aside button.btn.small:has-text("Add")'); print('extra:', pg.locator('.keys button', has_text='PROS. EJEM').count())
    pg.click('.footbar >> text=Continue'); pg.screenshot(path=OUT+'tsn-5.png')
    with pg.expect_download() as d: pg.click('button:has-text("Save the Word file")')
    dl=d.value; os.makedirs(A+'out',exist_ok=True); path=A+'out/'+dl.suggested_filename; dl.save_as(path); print('docx:', dl.suggested_filename, os.path.getsize(path))
    pg.wait_for_timeout(900); pg.reload(); pg.wait_for_selector('text=Continue that transcript'); print('resume offered')
    # Gregg tab
    pg.click('nav >> text=Gregg shorthand'); pg.wait_for_selector('.pad'); pg.wait_for_selector('text=Dictionary loaded', timeout=30000)
    pg.set_input_files('.gwrap input[type=file]', A+'samples/10.14.26.docx'); pg.wait_for_selector('.gsrc strong:has-text("10.14.26")')
    pg.wait_for_timeout(800)
    print('gregg words:', pg.inner_text('.gsrc .meta'), '| legend:', pg.inner_text('.legend').replace('\n',' '))
    pg.screenshot(path=OUT+'gregg-1.png'); pg.evaluate("window.scrollTo(0, 900)"); pg.screenshot(path=OUT+'gregg-2.png')
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.screenshot(path=OUT+'gregg-3.png')
    with pg.expect_download(timeout=60000) as d: pg.click('.gbar >> text=Save the PDF')
    dl=d.value; path=A+'out/'+dl.suggested_filename; dl.save_as(path); print('pdf:', dl.suggested_filename, os.path.getsize(path))
    pg.select_option('.gbar select >> nth=0', 'simplified'); pg.wait_for_timeout(400); print('simplified legend:', pg.inner_text('.legend').replace('\n',' '))
    pg.set_viewport_size({'width':420,'height':800}); pg.wait_for_timeout(300); print('h-scroll 420:', pg.evaluate('document.documentElement.scrollWidth > innerWidth'))
    pg.screenshot(path=OUT+'gregg-m.png')
    print('errors:', errs[:5])
    b.close()
