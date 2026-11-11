#!/usr/bin/env python3
"""Usage: python3 scripts/check_links.py

Emulate Vercel (cleanUrls + vercel.json redirects + .vercelignore) and check every internal link, asset and #anchor."""
import json, re, sys
from pathlib import Path
from urllib.parse import urlsplit
R = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent; v = json.loads((R/'vercel.json').read_text())
ignore = [l.strip().rstrip('/') for l in (R/'.vercelignore').read_text().splitlines() if l.strip()]
redir = {r['source']: r['destination'] for r in v['redirects']}
def served(rel):
    return not any(rel == i or rel.startswith(i + '/') for i in ignore)
def resolve(path, hops=0):
    """Return (file, final_fragment) Vercel would serve for a path, or None for a 404."""
    if path in redir and hops < 5:
        d = urlsplit(redir[path]); return resolve(d.path, hops + 1) + ((d.fragment,) if d.fragment else ())
    rel = path.lstrip('/')
    if rel.endswith('.html'): return None  # cleanUrls: /x.html redirects to /x; a link should never use .html
    cand = 'index.html' if rel == '' else (rel + '.html' if (R/(rel + '.html')).exists() else rel)
    return (cand,) if (R/cand).is_file() and served(cand) else None
ids = lambda f: set(re.findall(r'\bid="([^"]+)"', (R/f).read_text()))
pages = [p.name for p in R.glob('*.html') if served(p.name)]
bad = checked = 0
probe_ok = resolve('/talk') == ('talk.html',) and resolve('/nope') is None and resolve('/demo') == ('property-management.html', 'demo')
print('instrument control:', 'ok' if probe_ok else 'BROKEN'); bad += not probe_ok
for page in sorted(pages):
    txt = (R/page).read_text()
    for ref in sorted(set(re.findall(r'(?:href|src|poster)="([^"]+)"', txt))):
        if re.match(r'(https?:|mailto:|tel:|sms:|data:)', ref): continue
        checked += 1
        u = urlsplit(ref)
        if not u.path:  # same-page #anchor
            ok = u.fragment in ids(page); target = page
        else:
            path = u.path if u.path.startswith('/') else '/' + u.path
            res = resolve(path); target = res[0] if res else None
            frag = u.fragment or (res[1] if res and len(res) > 1 else '')
            ok = bool(res) and (not frag or not target.endswith('.html') or frag in ids(target))
        if not ok: bad += 1; print(f'BROKEN {page}: {ref} -> {target}')
for src in redir:
    if src.lower().strip('/') and not resolve(src): bad += 1; print('BROKEN redirect', src)
print(f'{len(pages)} pages, {checked} links/assets, {len(redir)} redirects: {bad} broken'); sys.exit(1 if bad else 0)
