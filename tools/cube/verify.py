# python3 tools/cube/verify.py http://localhost:8770 tools/cube/evidence
# Browser verification for /cube. Writes screenshots + evidence.json with measured values.
import sys, json, asyncio, re, time
from playwright.async_api import async_playwright

BASE, OUT = sys.argv[1].rstrip('/'), sys.argv[2]
ev = {'checks': {}, 'measurements': {}, 'errors': []}
def check(name, ok, detail=None):
    ev['checks'][name] = {'ok': bool(ok), 'detail': detail}
    print(('PASS ' if ok else 'FAIL ') + name, '' if detail is None else detail)

async def bins_from_hist(pg):
    return await pg.eval_on_selector_all('.hist', "hs => hs.map(h => [...h.querySelectorAll('.bin .n')].map(n => Number(n.textContent.split('·')[0].replace(/[^0-9]/g,''))))")
async def bins_from_table(pg):
    return await pg.eval_on_selector_all('#e-table tbody tr', "rs => rs.filter(r => r.cells[0].textContent !== 'Σ').map(r => [Number(r.cells[1].textContent.replace(/[^0-9]/g,'')), Number(r.cells[(r.cells.length-1)/2+1].textContent.replace(/[^0-9]/g,''))])")
async def wait_meta(pg, pattern, timeout=60000):
    await pg.wait_for_function(f"() => /{pattern}/.test(document.getElementById('e-meta').textContent)", timeout=timeout)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        # ---------- desktop ----------
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: ev['errors'].append(str(e)))
        await pg.goto(BASE + '/the6cube/lab/?lang=en', wait_until='load')
        await wait_meta(pg, 'snapshot')
        await pg.screenshot(path=f'{OUT}/desktop-first-frame.png')
        await pg.click('#compare'); await pg.wait_for_timeout(1350)
        await pg.screenshot(path=f'{OUT}/desktop-proof-mid.png')
        await pg.wait_for_function("document.getElementById('lanes').classList.contains('united')", timeout=8000)
        v = await pg.evaluate("({d: document.getElementById('v-dist').textContent, s: document.getElementById('v-sig').textContent, a: document.getElementById('sum-a').textContent, b: document.getElementById('sum-b').textContent})")
        check('proof: lanes unite, exact distance 1, same signature', v['d'] == '1' and v['a'].split('#')[1] == v['b'].split('#')[1], v)
        await pg.locator('#proof').screenshot(path=f'{OUT}/desktop-proof-done.png')
        await pg.fill('#p-scrub', '150'); await pg.dispatch_event('#p-scrub', 'input')
        united_mid = await pg.evaluate("document.getElementById('lanes').classList.contains('united')")
        check('proof: scrubbing back un-commits the endpoint', not united_mid)
        await pg.click('#p-step'); await pg.wait_for_timeout(1200)
        check('proof: step advances to the next committed turn', (await pg.input_value('#p-scrub')) == '200')
        # experiment: snapshot vs node oracle vs live
        hist, table = await bins_from_hist(pg), await bins_from_table(pg)
        check('experiment: histogram and table agree (snapshot)', [list(x) for x in zip(*table)] == hist, {'hist': hist})
        check('experiment: snapshot equals node oracle (2 steps, seed 1729, n 10000)', hist == [[559,1101,8340,0,0,0],[0,0,10000,0,0,0]], hist)
        await pg.click('#e-run'); await wait_meta(pg, 'live')
        hist_live = await bins_from_hist(pg)
        check('experiment: live worker run reproduces the snapshot exactly', hist_live == hist, hist_live)
        ev['measurements']['desktop_2step_meta'] = await pg.text_content('#e-meta')
        exact_marks = await pg.eval_on_selector_all('.bin .exact', 'es => es.length')
        check('experiment: exact probability overlay present for 2 steps', exact_marks == 12, exact_marks)
        await pg.select_option('#e-steps', '8'); await wait_meta(pg, 'snapshot')
        await pg.click('#e-run'); await wait_meta(pg, 'live')
        h8 = await bins_from_hist(pg); ev['measurements']['desktop_8step_meta'] = await pg.text_content('#e-meta')
        check('experiment: 8-step outside-radius counts visible', h8[0][5] > 0 and h8[1][5] > 0, h8)
        await pg.locator('#experiment').screenshot(path=f'{OUT}/desktop-experiment-8.png')
        # rerun + cancel
        await pg.select_option('#e-n', '20000'); await pg.click('#e-run'); await pg.wait_for_timeout(60); await pg.click('#e-cancel')
        meta = await pg.text_content('#e-meta'); kept = await bins_from_hist(pg)
        check('experiment: cancel stops the run and keeps the last complete result', ('Cancel' in meta) and kept == h8, meta)
        await pg.click('#e-run'); await wait_meta(pg, 'live')
        h20 = await bins_from_hist(pg)
        check('experiment: run after cancel completes; every trial in exactly one bin', all(sum(r) == 20000 for r in h20), [sum(r) for r in h20])
        # inspect -> simulator -> back
        await pg.select_option('#e-n', '10000'); await pg.select_option('#e-steps', '2'); await wait_meta(pg, 'snapshot')
        await pg.click('.hist >> nth=0 >> .bin >> nth=0')
        insp = await pg.text_content('#inspect')
        await pg.click('#inspect button'); await pg.wait_for_timeout(400)
        facts = await pg.text_content('#facts'); back = await pg.get_attribute('#backlink', 'href')
        check('inspect: representative d=0 sample opens in the simulator with exact distance 0 and a way back', 'exact 0' in facts and back == '#experiment', {'inspect': insp, 'facts': facts})
        await pg.locator('#simulator').screenshot(path=f'{OUT}/desktop-simulator-from-experiment.png')
        # simulator: keyboard trajectory, labels, reset during playback, four views, tree
        await pg.click('#reset')
        for k in ['r', 'l', 'Shift+R']: await pg.keyboard.press(k); await pg.wait_for_timeout(450)
        facts = await pg.text_content('#facts')
        check('keyboard: R L R′ via keys → history 3, shortest distance exact 1', 'history3' in facts.replace(' ', '') and 'exact 1' in facts, facts)
        await pg.click('#scramble'); await pg.wait_for_timeout(300); await pg.click('#auto'); await pg.wait_for_timeout(500); await pg.click('#reset'); await pg.wait_for_timeout(900)
        st = await pg.text_content('#status')
        check('reset during history playback leaves a solved, idle simulator', 'Solved' in st, st)
        views = []
        for _ in range(4): await pg.click('#view'); views.append(await pg.text_content('#view'))
        check('four views cycle', views == ['View 2/4', 'View 3/4', 'View 4/4', 'View 1/4'], views)
        await pg.click('#p-tree'); await pg.wait_for_timeout(500)
        notes = await pg.eval_on_selector_all('#root small.conv', 'xs => xs.map(x => x.textContent)')
        check('tree: R L R′ branch is annotated as the same state as L', '≡ L' in notes, notes)
        graph = await pg.text_content('#graph')
        check('tree: bounded graph labelled with budget and dedup counts', '342' in graph and '261' in graph and '81' in graph, graph[:160])
        await pg.locator('#boom').screenshot(path=f'{OUT}/desktop-tree.png')
        await ctx.close()

        # ---------- share link + back navigation, invalid query ----------
        ctx = await b.new_context(viewport={'width': 1280, 'height': 860}); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: ev['errors'].append(str(e)))
        await pg.goto(BASE + '/the6cube/lab/?exp=scramble&steps=4&seed=42&n=1000&v=cube-lab/1&lang=en#experiment', wait_until='load')
        await wait_meta(pg, 'live'); h = await bins_from_hist(pg)
        check('share link: parameters applied and run live (4 steps, seed 42, n 1000)', all(sum(r) == 1000 for r in h) and (await pg.input_value('#e-seed')) == '42', h)
        await pg.click('.hist >> nth=1 >> .bin >> nth=4'); await pg.click('#inspect button'); await pg.wait_for_timeout(300)
        h_sim = await pg.evaluate('location.hash')
        await pg.go_back(); await pg.wait_for_timeout(400)
        h_back = await pg.evaluate('location.hash'); in_view = await pg.evaluate("Math.abs(document.getElementById('experiment').getBoundingClientRect().top) < 40")
        check('share link → open in simulator → browser Back returns to the experiment URL and section', h_sim == '#simulator' and h_back == '#experiment' and 'seed=42' in pg.url and in_view, {'url': pg.url, 'sim_hash': h_sim})
        await pg.click('.hist >> nth=0 >> .bin >> nth=2'); await pg.click('#inspect button'); await pg.wait_for_timeout(300)
        await pg.click('#backlink'); await pg.wait_for_timeout(400)
        check('in-page back link behaves like browser Back', (await pg.evaluate('location.hash')) == '#experiment', pg.url)
        await pg.goto(BASE + '/the6cube/lab/?exp=scramble&steps=99&seed=-5&n=abc&lang=en', wait_until='load')
        await wait_meta(pg, 'snapshot|live')
        vals = [await pg.input_value('#e-steps'), await pg.input_value('#e-seed'), await pg.input_value('#e-n')]
        check('invalid query falls back to validated defaults', vals == ['2', '1729', '10000'], vals)
        await ctx.close()

        # ---------- reduced motion ----------
        ctx = await b.new_context(viewport={'width': 1280, 'height': 860}, reduced_motion='reduce'); pg = await ctx.new_page()
        await pg.goto(BASE + '/the6cube/lab/?lang=en', wait_until='load'); await pg.click('#compare'); await pg.wait_for_timeout(50)
        check('reduced motion: proof resolves immediately', await pg.evaluate("document.getElementById('lanes').classList.contains('united')"))
        await ctx.close()

        # ---------- narrow mobile 390 + low-power emulation ----------
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: ev['errors'].append(str(e)))
        cdp = await ctx.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        t0 = time.time(); await pg.goto(BASE + '/the6cube/lab/?lang=nl', wait_until='load')
        nav = await pg.evaluate("(() => { const n = performance.getEntriesByType('navigation')[0]; return {domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd)} })()")
        await wait_meta(pg, 'snapshot'); nav['snapshot_visible_ms'] = round((time.time() - t0) * 1000)
        ev['measurements']['mobile_4x_cpu_first_load'] = nav
        await pg.screenshot(path=f'{OUT}/mobile-first-frame.png')
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        check('390px: no horizontal overflow', sw <= 390, sw)
        await pg.tap('#compare'); await pg.wait_for_timeout(3300)
        await pg.locator('#proof').screenshot(path=f'{OUT}/mobile-proof-done.png')
        check('390px: proof completes', await pg.evaluate("document.getElementById('lanes').classList.contains('united')"))
        # responsiveness while the worker runs: measure main-thread frame gaps
        await pg.evaluate("window.__gaps=[];(function f(t){if(window.__last)window.__gaps.push(t-window.__last);window.__last=t;if(window.__gaps.length<400)requestAnimationFrame(f)})(performance.now())")
        await pg.select_option('#e-steps', '8'); await wait_meta(pg, 'snapshot')
        await pg.tap('#e-run'); await wait_meta(pg, 'live', 120000)
        gaps = await pg.evaluate('window.__gaps');
        ev['measurements']['mobile_4x_cpu_8step_run'] = {'meta': await pg.text_content('#e-meta'), 'max_frame_gap_ms_during_run': round(max(gaps)), 'frames_sampled': len(gaps)}
        await pg.tap('#e-run'); await wait_meta(pg, 'live', 120000)
        ev['measurements']['mobile_4x_cpu_8step_warm_run'] = await pg.text_content('#e-meta')
        await pg.locator('#experiment').screenshot(path=f'{OUT}/mobile-experiment.png')
        ev['measurements']['environment'] = {'browser': 'Google Chrome (headless) via Playwright', 'device': 'emulated 390×844 @2x, touch, CPU throttled 4× (CDP)', 'host': 'Linux container', 'runs': 1}
        await ctx.close(); await b.close()
    ev['errors'] = sorted(set(ev['errors']))
    check('no page errors across all sessions', not ev['errors'], ev['errors'])
    json.dump(ev, open(f'{OUT}/evidence.json', 'w'), indent=1, ensure_ascii=False)
    print(json.dumps(ev['measurements'], indent=1, ensure_ascii=False))
asyncio.run(main())
