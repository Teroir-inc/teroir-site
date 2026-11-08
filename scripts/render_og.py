"""Render og.png from scripts/og.html. Needs Playwright (python -m pip install playwright)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CHROME = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=str(CHROME) if CHROME.exists() else None)
    page = browser.new_page(viewport={'width': 1200, 'height': 630})
    page.goto((ROOT / 'scripts' / 'og.html').as_uri())
    page.evaluate('document.fonts.ready')
    page.screenshot(path=str(ROOT / 'og.png'))
    browser.close()
print('og.png written')
