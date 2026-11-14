import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).parent
FPS, DURATION = 30, 28
OUT = pathlib.Path(sys.argv[1])
STILLS = [float(x) for x in sys.argv[2:]]

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto((ROOT / 'scene.html').as_uri())
    pg.evaluate('window.ready')
    if STILLS:
        for t in STILLS:
            pg.evaluate(f'render({t})')
            pg.screenshot(path=str(OUT / f'still_{t:05.2f}.png'))
    else:
        for f in range(FPS * DURATION):
            pg.evaluate(f'render({f / FPS})')
            pg.screenshot(path=str(OUT / f'f{f:04d}.jpg'), type='jpeg', quality=92)
    b.close()
