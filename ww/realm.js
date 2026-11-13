// realm.js: the neon grid space behind every wyattworldwide.com page.
// 2D canvas, no libraries. The camera glides forward; scrolling and taps push it faster.
// prefers-reduced-motion: one still frame, no animation.
(() => {
  const c = document.createElement('canvas');
  c.className = 'realm'; c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  document.body.classList.add('realm-on');
  const ctx = c.getContext('2d', { alpha: false });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const col = (v, d) => (css.getPropertyValue(v).trim() || d);
  const CYAN = col('--cyan', '#00E5FF'), MAGENTA = col('--magenta', '#FF2BD6'), NIGHT = col('--night', '#07021A');

  let w = 0, h = 0, dpr = 1;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) draw(0);
  }

  const BASE = 0.35;               // idle forward speed (grid cells per second)
  let z = 0, speed = BASE, push = 0, lastY = scrollY, pitch = 0, last = 0, drawn = 0;
  addEventListener('scroll', () => { push = Math.min(push + Math.abs(scrollY - lastY) * 0.02, 5); lastY = scrollY; }, { passive: true });
  addEventListener('pointerdown', () => { push = Math.min(push + 1.5, 5); }, { passive: true });

  // light cycles: streaks that run along the floor lanes
  const cycles = [
    { lane: -3, z: 6, v: 2.2, color: CYAN },
    { lane: 4, z: 14, v: 3.1, color: MAGENTA },
    { lane: -7, z: 22, v: 1.6, color: CYAN },
  ];

  const FAR = 40, LANES = 14;
  function draw(t) {
    const scrollMax = Math.max(1, document.documentElement.scrollHeight - h);
    const target = (scrollY / scrollMax) * 0.06;  // the camera tips down as you go deeper
    pitch += (target - pitch) * 0.1;
    const win = document.querySelector('.window');
    const base = win ? Math.min(h * 0.6, win.offsetTop + win.offsetHeight) : h * 0.38;   // the hub opens a window onto the sun
    const hy = base - pitch * h, cx = w / 2, f = (h - hy) * 1.1;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, NIGHT); sky.addColorStop(1, '#0B0524');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hy + 1);
    // the sun, sitting on the horizon, slits in its lower half
    const r = win ? Math.min(w * 0.3, win.offsetHeight * 0.8) : Math.min(w * 0.3, 150), sy = hy - r * 0.15;
    const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r * 0.2);
    sg.addColorStop(0, '#FFD23F'); sg.addColorStop(0.55, MAGENTA); sg.addColorStop(1, '#8C1EFF');
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hy); ctx.clip();
    ctx.globalAlpha = 0.85; ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = NIGHT;
    for (let k = 0; k < 5; k++) { const yy = hy - r * 0.52 + k * r * 0.11, hh = 1.5 + k * 1.4; ctx.fillRect(cx - r, yy, r * 2, hh); }
    ctx.restore();
    // floor
    const fl = ctx.createLinearGradient(0, hy, 0, h);
    fl.addColorStop(0, '#12052A'); fl.addColorStop(1, NIGHT);
    ctx.fillStyle = fl; ctx.fillRect(0, hy, w, h - hy);
    // horizon glow
    const hg = ctx.createRadialGradient(cx, hy, 0, cx, hy, w * 0.8);
    hg.addColorStop(0, 'rgba(255,43,214,.22)'); hg.addColorStop(1, 'rgba(255,43,214,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);

    const py = zz => hy + f / zz;                  // floor point at depth zz -> screen y
    const px = (x, zz) => cx + (x * f * 0.9) / zz; // lane x at depth zz -> screen x

    // depth lines (move toward you)
    for (let i = 0; i < FAR; i++) {
      const zz = i + 1 - z;
      if (zz < 0.35) continue;
      const y = py(zz);
      if (y > h + 2) continue;
      const a = Math.min(1, 1.6 / zz) * 0.9;
      line(0, y, w, y, a, CYAN);
    }
    // lanes (run to the vanishing point)
    for (let l = -LANES; l <= LANES; l++) {
      const zn = 0.35, x0 = px(l, zn), y0 = py(zn);
      line(cx + (x0 - cx) * 0.02, hy, x0, y0, 0.75, CYAN);
    }
    // horizon line
    line(0, hy, w, hy, 0.6, MAGENTA, 2);

    // light cycles with trails
    for (const cy of cycles) {
      const head = cy.z, tail = cy.z + 3.5;
      if (head > 0.5) {
        const x1 = px(cy.lane, head), y1 = py(head), x2 = px(cy.lane, tail), y2 = py(tail);
        line(x2, y2, x1, y1, 0.95, cy.color, 3);
      }
    }
  }

  function line(x1, y1, x2, y2, a, color, width = 1) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = a * 0.18; ctx.lineWidth = width * 5; // glow pass (cheaper than shadowBlur)
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = a; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    push *= Math.pow(0.12, dt);                    // pushes fade in about a second
    speed = BASE + push;
    z = (z + speed * dt) % 1;
    for (const cy of cycles) { cy.z -= (cy.v + speed) * dt; if (cy.z < -4) cy.z = FAR * (0.4 + Math.random() * 0.5); }
    if (push > 0.05 || t - drawn > 31) { draw(t); drawn = t; }   // idle: about 30 fps; pushed: every frame
    if (!document.hidden) requestAnimationFrame(frame); else last = 0;
  }

  size();
  addEventListener('resize', size);
  if (!reduce) {
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestAnimationFrame(frame); });
  }
})();
