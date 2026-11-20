// realm.js: the WyattWorldWide worldscape (Wyatt 11-20). Puts the right part of the pencil beach sketch behind each
// section (ww/scene/*.svg, drawn by scripts/ww_scenes.py) and loads each one only when it comes near the screen.
// The home hero's shoreline is set in CSS, so it shows at once. No motion: the scenes scroll with the page.
(() => {
  const path = location.pathname.replace(/^\/ww/, '').replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
  const $ = s => document.querySelector(s);
  const D = { '/d/free-street': 'shore', '/d/the-lab': 'hut', '/d/rooftop-hq': 'tower' };
  const plan = path === '/' ? [[$('.ring'), 'walk']]
    : path.startsWith('/free') ? [[$('#get'), 'hut'], [$('#share'), 'dunes'], [$('#buy'), 'stall']]
    : path.startsWith('/blog') ? [[$('main'), 'tower']]
    : path.startsWith('/d/') ? [[$('main'), D[path] || 'dunes']]
    : [[$('main'), 'dunes']];
  const items = plan.filter(([el]) => el);
  const show = el => { el.dataset.scene = el.dataset.wantScene; };
  items.forEach(([el, name]) => { el.dataset.wantScene = name; el.classList.add('scene'); });
  if (!('IntersectionObserver' in window)) { items.forEach(([el]) => show(el)); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '900px 0px' });
  items.forEach(([el]) => io.observe(el));
})();
