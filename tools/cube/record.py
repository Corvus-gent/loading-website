# Deterministic launch clip (9:16, ~25 s) driven only by real page interactions.
#   python3 tools/cube/record.py http://localhost:8770 tools/cube/evidence
#   -> clip.webm, then ffmpeg -> cube-launch-1080x1920.mp4
import sys, asyncio, glob, os, shutil
from playwright.async_api import async_playwright
BASE, OUT = sys.argv[1].rstrip('/'), sys.argv[2]
SMOOTH = "id => document.getElementById(id).scrollIntoView({behavior:'smooth', block:'start'})"

async def main():
    tmp = os.path.join(OUT, '_video'); shutil.rmtree(tmp, ignore_errors=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        ctx = await b.new_context(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1,
                                  record_video_dir=tmp, record_video_size={'width': 1080, 'height': 1920})
        pg = await ctx.new_page()
        await pg.goto(BASE + '/cube/?lang=en', wait_until='load')
        await pg.add_style_tag(content='html{zoom:2}')            # 540-css-px mobile layout, rendered crisp at 1080×1920
        await pg.wait_for_function("/snapshot/.test(document.getElementById('e-meta').textContent)")
        await pg.evaluate("document.getElementById('proof').scrollIntoView({block:'start'})")
        await pg.wait_for_timeout(1200)                                   # 0–1.2 s  first frame: two lanes, scripts visible
        await pg.click('#compare'); await pg.wait_for_timeout(3000)       # 1.2–4.2  R L R′ vs L animate
        await pg.evaluate("window.scrollBy({top: 300, behavior:'smooth'})"); await pg.wait_for_timeout(2600)   # 4.2–6.8 verdict: 3 vs 1, distance 1, same signature
        await pg.evaluate(SMOOTH, 'experiment'); await pg.wait_for_timeout(1300)
        await pg.evaluate("window.scrollBy({top: 300, behavior:'smooth'})"); await pg.wait_for_timeout(2600)   # 8–10.6 2-step histograms + exact ticks
        await pg.click('.hist >> nth=0 >> .bin >> nth=0'); await pg.wait_for_timeout(1800)                      # 10.6–12.4 inspect a solved sample
        await pg.evaluate(SMOOTH, 'experiment'); await pg.wait_for_timeout(900)
        await pg.select_option('#e-steps', '8'); await pg.wait_for_timeout(500)
        await pg.click('#e-run'); await pg.wait_for_function("/live|in je browser/.test(document.getElementById('e-meta').textContent)")
        await pg.evaluate("window.scrollBy({top: 300, behavior:'smooth'})"); await pg.wait_for_timeout(3000)   # 13.8–17 8 steps: ≥5 bins, live run metadata
        await pg.evaluate(SMOOTH, 'proof'); await pg.wait_for_timeout(900)
        await pg.click('#p-tree'); await pg.wait_for_timeout(1200)                                              # tree: R L R′ ≡ L
        await pg.evaluate("document.querySelector('#root .tree-node:last-child').scrollIntoView({behavior:'smooth', block:'center'})"); await pg.wait_for_timeout(3200)
        await pg.evaluate(SMOOTH, 'graph'); await pg.wait_for_timeout(2400)                                       # bounded graph budget + convergences
        await ctx.close(); await b.close()
    src = glob.glob(os.path.join(tmp, '*.webm'))[0]
    shutil.move(src, os.path.join(OUT, 'clip.webm')); shutil.rmtree(tmp, ignore_errors=True)
asyncio.run(main())
