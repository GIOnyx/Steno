from playwright.sync_api import sync_playwright
A='/home/claude/tsn/'
SUMMARY=open('scripts/e2e.py').read().split('"""')[1]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1360,'height':900})
    pg.on('pageerror', lambda e: print('PAGEERROR', e)); pg.on('console', lambda m: print('CONSOLE', m.type, m.text) if m.type in ('error','warning') else None)
    pg.goto('http://localhost:3123/tsn'); pg.wait_for_selector('textarea')
    pg.fill('textarea[placeholder^="Civil Case"]', SUMMARY); pg.click('text=Fill in the form')
    print('caseNo field:', pg.input_value('input[placeholder="958 and 964"]'))
    print('counsel names:', [pg.input_value(f'input[placeholder="Atty. Nathaniel Clarus"] >> nth={i}') for i in range(pg.locator('input[placeholder="Atty. Nathaniel Clarus"]').count())])
    pg.click('text=Continue'); pg.set_input_files('input[type=file][accept=".docx,.txt"]', A+'samples/rec.docx'); pg.wait_for_selector('.blk.edge-s')
    pg.click('text=Continue'); pg.wait_for_timeout(500)
    print(pg.inner_text('.page')[:600])
    b.close()
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1360,'height':900})
    pg.on('pageerror', lambda e: print('PAGEERROR', e)); pg.on('console', lambda m: print('CONSOLE', m.type, m.text))
    pg.goto('http://localhost:3123/tsn'); pg.wait_for_selector('textarea')
    pg.fill('textarea[placeholder^="Civil Case"]', SUMMARY); pg.click('text=Fill in the form')
    pg.click('.footbar >> text=Continue'); pg.wait_for_timeout(300); print('h1:', pg.inner_text('h1'))
    pg.set_input_files('input[type=file][accept=".docx,.txt"]', A+'samples/rec.docx'); pg.wait_for_selector('.blk.edge-s')
    print('continue buttons:', pg.locator('text=Continue').count(), [pg.locator('text=Continue').nth(i).evaluate('e=>e.outerHTML.slice(0,80)') for i in range(pg.locator('text=Continue').count())])
    print('disabled?', pg.locator('.footbar button.primary').get_attribute('disabled'))
    pg.click('.footbar >> text=Continue'); pg.wait_for_timeout(500); print('h1 after:', pg.inner_text('h1'))
    b.close()
