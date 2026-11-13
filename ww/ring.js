// wyattworldwide.com hub: a ring of holographic panels you swipe through (CSS 3D, no WebGL).
// Without JS the panels are a plain stacked list; with reduced motion they are a flat swipe row.
// Swipe or drag to turn, arrows and keyboard too; tap the front panel to enter, tap a side panel to bring it front.
(() => {
  const root = document.querySelector('.ring');
  if (!root) return;
  const track = root.querySelector('.ring-track');
  const items = [...track.children];
  const n = items.length;
  const flat = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dots = document.querySelector('.ring-dots');
  const label = document.querySelector('.ring-now');
  root.classList.add(flat ? 'ring-flat' : 'ring-on');
  if (flat) return; // the flat row uses native scroll-snap

  const step = 360 / n;
  const stageEl = root.querySelector('.ring-stage');
  let cur = 0, drag = 0, startX = null, startY = null, moved = false, w = 280;
  const want = (location.hash.match(/^#p-(.+)$/) || [])[1];
  if (want) { const i = items.findIndex(el => el.id === `p-${want}`); if (i >= 0) cur = i; }

  // dots
  items.forEach((el, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', `Show ${el.dataset.name}`);
    b.addEventListener('click', () => go(i)); dots.append(b);
  });

  function layout() {
    w = items[0].offsetWidth || 280;
    const r = Math.round((w / 2) / Math.tan(Math.PI / n)) + 24;
    root.style.setProperty('--r', `${r}px`);
    stageEl.style.height = `${Math.max(...items.map(el => el.offsetHeight)) + 16}px`; // the stage fits the tallest panel
    render();
  }
  function render() {
    const turn = -cur * step + drag;
    track.style.transform = `translateZ(calc(var(--r) * -1)) rotateY(${turn}deg)`;
    items.forEach((el, i) => {
      el.style.transform = `rotateY(${i * step}deg) translateZ(var(--r))`;
      let d = Math.abs(((i - cur + n / 2) % n + n) % n - n / 2);   // ring distance from the front
      d = Math.min(d, n - d);
      el.classList.toggle('front', d === 0);
      el.style.opacity = d === 0 ? 1 : d === 1 ? 0.45 : d === 2 ? 0.15 : 0;
      el.style.pointerEvents = d <= 1 ? 'auto' : 'none';
      el.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      el.querySelectorAll('a,button').forEach(a => { a.tabIndex = d === 0 ? 0 : -1; });
    });
    [...dots.children].forEach((b, i) => b.classList.toggle('on', i === cur));
    if (label) label.textContent = `${String(cur + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}  ${items[cur].dataset.name}`;
  }
  function go(i) { cur = ((i % n) + n) % n; drag = 0; render(); history.replaceState(null, '', `#p-${items[cur].id.slice(2)}`); }

  root.querySelector('.ring-prev').addEventListener('click', () => go(cur - 1));
  root.querySelector('.ring-next').addEventListener('click', () => go(cur + 1));
  // arrow keys work from a fresh load (not only when the ring has focus), but never while typing
  document.addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); } });

  // swipe / drag: follow the finger, snap on release; vertical moves still scroll the page
  const stage = stageEl;
  stage.addEventListener('pointerdown', e => { startX = e.clientX; startY = e.clientY; moved = false; });
  stage.addEventListener('pointermove', e => {
    if (startX === null) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.abs(dx) < 8) return;
    if (!moved && Math.abs(dy) > Math.abs(dx)) { startX = null; return; }
    moved = true; root.classList.add('dragging');
    drag = (dx / w) * step; render();
  });
  const end = e => {
    if (startX === null) return;
    root.classList.remove('dragging');
    const dx = (e.clientX ?? startX) - startX; startX = null;
    if (moved) { const k = Math.round(-dx / (w * 0.75)); go(cur + (k || (Math.abs(dx) > 40 ? (dx < 0 ? 1 : -1) : 0))); }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  // a tap on a side panel brings it to the front instead of following its link; a drag never clicks
  items.forEach((el, i) => el.addEventListener('click', e => {
    if (moved) { e.preventDefault(); moved = false; return; }
    if (i !== cur) { e.preventDefault(); go(i); }
  }, true));

  addEventListener('resize', layout);
  layout();
  requestAnimationFrame(() => root.classList.add('ready'));
})();
