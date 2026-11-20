// realm.js: the WyattWorldWide worldscape (Wyatt 11-20). Puts the right part of the beach world behind each section
// (ww/scene/*.svg, drawn by scripts/ww_scenes.py) and loads each one only when it comes near the screen.
// Scroll story: the top of a page is the most digital, and going down goes deeper into the real, sketched world
// (shore 1.0 > hut .7 > stall .5 > tower .35 > dunes .15). The home hero's shore is set in CSS so it shows at once.
(() => {
  const path = location.pathname.replace(/^\/ww/, '').replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
  const $ = s => document.querySelector(s);
  const D = { '/d/free-street': 'shore', '/d/the-lab': 'hut', '/d/rooftop-hq': 'tower' };
  const plan = path === '/' ? [[$('.ring'), 'walk']]
    : path.startsWith('/free') ? [[$('#get'), 'hut'], [$('#buy'), 'stall']]
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
