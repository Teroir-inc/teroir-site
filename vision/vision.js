// teroir.com/vision: one request's journey through the Teroir world (scripts/vision_world.py draws the world).
// Scroll (or tap Next) moves the request along #route: a neon packet in the agent world, a pencil job card once it
// crosses .BOS, a neon check mark on its way back up. The camera follows it. Hotspots open short cards.
// ?tour=1 plays the whole journey on its own (for the reel): steady pace, no scrollbar, end state held.
// Reduced motion: no camera, no timeline; the page shows the stops as stills (CSS), and this script only wires cards.
(() => {
  const qs = new URLSearchParams(location.search);
  const TOUR = qs.get('tour') === '1';
  if (qs.get('lines') === '0') document.documentElement.classList.add('vw-nolines');   // for a voice-over recording
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches && !TOUR;
  const $ = s => document.querySelector(s);

  // ---- the cards behind the hotspots (each ≤40 words; copy review owns these)
  const sheet = $('#vw-sheet'), sheetH = $('#vw-sheet-h'), sheetP = $('#vw-sheet-p');
  const open = btn => { sheetH.textContent = btn.dataset.title; sheetP.textContent = btn.dataset.text; sheet.hidden = false; sheet.querySelector('button').focus(); };
  document.querySelectorAll('.vw-hot').forEach(b => b.addEventListener('click', () => open(b)));
  $('#vw-sheet-x').addEventListener('click', () => { sheet.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') sheet.hidden = true; });
  if (still) return;

  const world = $('#vw-world'), view = $('#vw-view'), req = $('#vw-req'), cap = $('#vw-cap'), track = $('#vw-track'), bos = $('#vw-bos');
  const route = document.getElementById('vw-route');
  const L = route.getTotalLength();
  const WW = 800, WH = 2600;
  // the stops: where on the route (0-1), the request's state there, the line on screen (≤8 words)
  const STOPS = JSON.parse(document.getElementById('vw-stops').textContent);
  // the request's state by route position: packet until .BOS, job card until the records, then a check mark
  const stateAt = f => (f < STOPS[1].at + .012 ? 'packet' : f < STOPS[STOPS.length - 2].at + .01 ? 'card' : 'check');

  let scale = 1;
  function layout() {
    const vw = view.clientWidth;
    scale = vw < 700 ? Math.max(vw / WW, .95) : Math.min(vw / WW, 1.25);  // phones: close to 1:1, the camera pans
    world.style.width = WW * scale + 'px'; world.style.height = WH * scale + 'px';
    world.style.setProperty('--s', scale);
  }
  function place(f) {
    const pt = route.getPointAtLength(Math.max(0, Math.min(1, f)) * L);
    const vw = view.clientWidth, vh = view.clientHeight;
    req.style.transform = `translate(${pt.x * scale}px, ${pt.y * scale}px)`;
    req.dataset.state = stateAt(f);
    // the camera: between stops it eases from one stop's subject to the next, so each subject sits fully in frame;
    // it stays in the middle band of the screen (the reel's safe area is the middle 60%)
    let k = 0; while (k < STOPS.length - 2 && f > STOPS[k + 1].at) k++;
    const a = STOPS[k], b = STOPS[k + 1], u = Math.max(0, Math.min(1, (f - a.at) / ((b.at - a.at) || 1)));
    const sm = u * u * (3 - 2 * u);
    const cx = a.fx + (b.fx - a.fx) * sm, cy = a.fy + (b.fy - a.fy) * sm;
    const tx = Math.min(0, Math.max(vw - WW * scale, vw / 2 - cx * scale));
    const ty = Math.min(0, Math.max(vh - WH * scale, vh * .42 - cy * scale));
    world.style.transform = `translate(${tx}px, ${ty}px)`;
    // .BOS stays readable: the chip rides the boundary line but is pinned inside the screen
    const by = ty + 1000 * scale;
    bos.style.transform = `translate(16px, ${Math.max(10, by - 40)}px)`; bos.style.opacity = by > 30 && by < vh - 30 ? 1 : 0;
    // the story's states: fixed at the house, the record cards once the job reaches the records
    view.classList.toggle('vw-fixed', f >= STOPS[5].at - .005);
    view.classList.toggle('vw-recorded', f >= STOPS[6].at - .02);
    // the caption: the nearest stop
    let near = STOPS[0];   // the caption: the stop nearest the request
    for (const s of STOPS) if (Math.abs(f - s.at) < Math.abs(f - near.at)) near = s;
    if (cap.dataset.at !== String(near.at)) { cap.dataset.at = near.at; cap.textContent = near.line; cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in'); }
    document.querySelectorAll('.vw-dots i').forEach((d, i) => d.classList.toggle('on', STOPS[i] === near));
  }

  layout(); place(0);
  addEventListener('resize', () => { layout(); place(progress()); });

  // ---- scroll drives it: the track is tall, the view is sticky inside it
  const progress = () => {
    const r = track.getBoundingClientRect(), span = track.offsetHeight - innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  };
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(progress()); }); }, { passive: true });

  // ---- Next / Back: jump to the next stop (smooth scroll to it)
  const toStop = i => {
    const s = STOPS[Math.max(0, Math.min(STOPS.length - 1, i))];
    const span = track.offsetHeight - innerHeight;
    scrollTo({ top: track.offsetTop + s.at * span, behavior: 'smooth' });
  };
  const cur = () => { const f = progress(); let i = 0; STOPS.forEach((s, k) => { if (f >= s.at - .02) i = k; }); return i; };
  $('#vw-next').addEventListener('click', () => toStop(cur() + 1));
  $('#vw-back').addEventListener('click', () => toStop(cur() - 1));

  // ---- tour mode: the journey plays on its own. Each stop holds 4.5 s, moves take 3.5 s (about 62 s); the end state holds.
  if (TOUR) {
    document.documentElement.classList.add('vw-tour');
    const HOLD = 4500, MOVE = 3500;   // about 62 s in all, then the end panel holds
    const keys = [];
    let t = 1500;
    STOPS.forEach((s, i) => { if (i) { keys.push([t, STOPS[i - 1].at, s.at]); t += MOVE; } t += HOLD; });
    const total = t;
    const t0 = performance.now();
    const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    (function tick(now) {
      const e = now - t0;
      let f = 0;
      for (const [start, a, b] of keys) { if (e >= start + MOVE) f = b; else if (e >= start) { f = a + (b - a) * ease((e - start) / MOVE); break; } else break; }
      place(f);
      if (e < total) requestAnimationFrame(tick);
      else { document.documentElement.classList.add('vw-tour-end'); setTimeout(() => $('#vw-end').scrollIntoView(), 50); }
    })(t0);
  }
})();
