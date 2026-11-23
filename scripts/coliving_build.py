#!/usr/bin/env python3
"""teroir.com/coliving/<city>: one landing page per sales-push market (orchestration/plans/sales-push-2026-11.md),
for co-living and PadSplit operators. Each page: the More Doors, Same Team offer, the first project's result (FACTS),
a book-a-call email link and an optional "keep me posted" email field (the same list as before, tagged with the city;
the /founding page is retired and founding is call-only now, Wyatt 11-20).
No prices. The city is named only as who the page is for; the results always say Houston and DFW, where they happened.
Pages stay noindex (meta here + X-Robots-Tag in vercel.json) until copy review passes.

    python3 scripts/coliving_build.py      # writes coliving/*.html
"""
from pathlib import Path
import html
import urllib.parse

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'coliving'
e = html.escape

CITIES = [
    # slug, name in copy, how the result line reads there
    ('atlanta', 'Atlanta', 'away'),
    ('charlotte', 'Charlotte', 'away'),
    ('houston-dfw', 'Houston and DFW', 'home'),
    ('salt-lake', 'Salt Lake', 'away'),
]


def page(slug, city, where):
    title = f'More doors, same team, for {city} co-living operators — Teroir'
    desc = (f'For co-living and PadSplit hosts in {city}. One team grew from 11 to 29 properties with no new hires '
            'while running on HouKee, housekeeping for co-living houses.')
    result = ('HouKee, housekeeping for co-living houses, ran their 218 rooms right here in Houston and DFW.' if where == 'home'
              else 'HouKee, housekeeping for co-living houses, ran their 218 rooms in Houston and DFW.')
    mail = 'mailto:wyatt@teroir.com?' + urllib.parse.urlencode({'subject': f'More Doors, Same Team: a call ({city})'}, quote_via=urllib.parse.quote)
    src = f'coliving-{slug}'
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F6F4EE">
<meta name="color-scheme" content="light">
<link rel="canonical" href="https://teroir.com/coliving/{slug}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Teroir">
<meta property="og:url" content="https://teroir.com/coliving/{slug}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="https://teroir.com/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/favicon.png" type="image/png" sizes="32x32">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/pages.css">
<script>document.documentElement.classList.add('js')</script>
<script src="/main.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="nav pg-nav" id="top">
  <div class="wrap nav-in">
    <a class="brand" href="/" aria-label="Teroir — home"><img src="/brand/logo.svg" alt="Teroir" width="97" height="30">
    </a>
    <nav class="links pg" aria-label="Pages"><a href="/property-management">Case study</a><a href="/talk">Talk to us</a></nav>
    <a class="btn btn-sm btn-ghost" href="/" >Home</a>
  </div>
</header>

<main id="main">

<section class="section cta-sec" id="join" aria-labelledby="cv-h">
  <div class="wrap">
    <div class="cta">
      <div class="cta-glow" aria-hidden="true"></div>
      <span class="cta-k">More Doors, Same Team · for {e(city)} co-living operators</span>
      <h1 id="cv-h">Run more doors with the team you have.</h1>
      <p class="cta-lead">One co-living team grew from 11 to 29 properties with no new hires. {e(result)} That was May to October 2026. HouKee is built for PadSplit hosts.</p>

      <div class="cta-grid">
        <div><span class="cta-k">Properties, same team</span><p><b class="cv-big">11 → 29</b> 2.6x, with no new hires</p></div>
        <div><span class="cta-k">Weekly chores, same team</span><p><b class="cv-big">2.8x</b> 53 to 147 chores a week</p></div>
        <div><span class="cta-k">Member messages each week</span><p><b class="cv-big">8x</b> about 60 to about 500, sent automatically</p></div>
      </div>

      <p class="cta-lead">Chores, tenant texts, maintenance requests and fines sit in one place. 900+ tickets were tracked and handled there.</p>

      <div class="cta-grid">
        <div><span class="cta-k">The offer</span><p>More Doors, Same Team: HouKee set up for your houses, so your team can run more doors.</p></div>
      </div>

      <div class="cv-act">
        <a class="btn btn-primary" href="{e(mail)}">Email Wyatt to book a 15-minute call <span aria-hidden="true">→</span></a>
        <p class="tk-note">You'll get 2 or 3 times back by email.</p>
      </div>

      <form class="wl cv-keep" id="cv-keep" action="/api/waitlist?list=founding&amp;mode=updates" method="post">
        <label class="wl-f"><span>Not ready to talk? Keep me posted. <i>(optional)</i></span>
          <span class="cv-row"><input name="email" type="email" required autocomplete="email" maxlength="200" placeholder="you@example.com"><button class="btn btn-sm btn-ghost" type="submit">Keep me posted</button></span></label>
        <label class="wl-hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
        <input type="hidden" name="mode" value="updates"><input type="hidden" name="src" value="{src}"><input type="hidden" name="t" id="cv-t">
        <p class="wl-msg" id="cv-msg" role="status" aria-live="polite"></p>
        <p class="rec-note">We'll only email you about HouKee. Reply any time to leave the list.</p>
      </form>
      <script>
      (() => {{ const f = document.getElementById('cv-keep'), m = document.getElementById('cv-msg');
        document.getElementById('cv-t').value = String(Date.now());
        f.addEventListener('submit', async e => {{ e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; m.textContent = 'Sending…';
          try {{ const r = await fetch(f.action, {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(Object.fromEntries(new FormData(f))) }});
            const j = await r.json().catch(() => ({{}}));
            m.textContent = j.ok ? "Thanks. You're on the list." : j.error === 'email' || j.error === 'disposable' ? 'Please check your email address.' : 'Something went wrong. Please email wyatt@teroir.com.';
            if (j.ok) f.querySelector('input[type=email]').value = '';
          }} catch {{ m.textContent = 'Something went wrong. Please email wyatt@teroir.com.'; }}
          b.disabled = false; }}); }})();
      </script>
      <p class="rec-note">These numbers come from one team in Houston and DFW, May to October 2026. They are not typical results. Yours may differ. <a href="/property-management">See the case study</a>.</p>
    </div>
  </div>
</section>

</main>

<footer class="foot">
  <div class="wrap foot-in">
    <a class="brand" href="#top" aria-label="Back to top"><img src="/brand/logo.svg" alt="Teroir" width="84" height="26" loading="lazy">
    </a>
    <p>© 2026 Teroir</p>
    <nav class="foot-links" aria-label="Pages"><a href="/">Home</a><a href="/property-management">Property management</a><a href="/talk">Talk to us</a></nav>
    <p><a href="mailto:wyatt@teroir.com?subject=Teroir">wyatt@teroir.com</a></p>
  </div>
</footer>
</body>
</html>
'''


def main():
    OUT.mkdir(exist_ok=True)
    for slug, city, where in CITIES:
        (OUT / f'{slug}.html').write_text(page(slug, city, where))
        print(f'wrote coliving/{slug}.html')


if __name__ == '__main__':
    main()
