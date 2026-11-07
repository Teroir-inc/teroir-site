(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // run a loop only while its figure is on screen and the tab is visible
  const whenSeen = (el, start) => {
    if (!('IntersectionObserver' in window)) return start();
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); }
    }, { threshold: 0.2 });
    io.observe(el);
  };
  const idle = () => new Promise(r => {
    if (!document.hidden) return r();
    const on = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); r(); } };
    document.addEventListener('visibilitychange', on);
  });

  // /network — the ecosystem: deals light up between businesses, both records grow
  const eco = $('#eco');
  if (eco) {
    const biz = $$('.biz', eco);
    const pos = biz.map(g => g.dataset.xy.split(',').map(Number));
    const line = (a, b) => $(`line[data-p="${Math.min(a, b)}-${Math.max(a, b)}"]`, eco);
    const label = $('.deal-l', eco), lt = $('text', label), lr = $('rect', label);
    const msg = $('.msg', eco);
    const deals = [[0, 1, 'repair'], [2, 3, 'reorder'], [5, 0, 'cleaning'], [4, 2, 'bookkeeping'], [5, 2, 'deep clean'], [4, 3, 'bookkeeping']];
    const fill = i => {
      const pills = $$('.rec rect', biz[i]);
      const n = pills.filter(p => p.classList.contains('f')).length;
      if (n >= pills.length) pills.forEach((p, k) => p.classList.toggle('f', k === 0));
      else pills[n].classList.add('f');
    };
    const say = (text, x, y) => {
      lt.textContent = text;
      const w = text.length * 6.1 + 16;
      lr.setAttribute('x', x - w / 2); lr.setAttribute('width', w);
      lr.setAttribute('y', y - 10); lt.setAttribute('x', x); lt.setAttribute('y', y + 3.5);
      label.classList.add('on');
    };
    const fly = (a, b, ms) => msg.animate(
      [{ transform: `translate(${a[0]}px,${a[1]}px)`, opacity: 1 }, { transform: `translate(${b[0]}px,${b[1]}px)`, opacity: 1 }],
      { duration: ms, easing: 'ease-in-out', fill: 'forwards' }).finished;
    if (!reduce && msg.animate) whenSeen(eco, async () => {
      for (let k = 0; ; k = (k + 1) % deals.length) {
        await idle();
        const [a, b, what] = deals[k], l = line(a, b), A = pos[a], B = pos[b];
        const mx = 200, my = 228; // under the centre mark, clear of every card
        l.classList.add('on'); biz[a].classList.add('on'); biz[b].classList.add('on');
        say(`${what} · posted`, mx, my);
        await fly(A, B, 1000);
        say(`${what} · claimed`, mx, my);
        await fly(B, A, 1000);
        msg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
        say('signed by both', mx, my);
        fill(a); fill(b);
        await wait(1300);
        label.classList.remove('on'); l.classList.remove('on');
        biz[a].classList.remove('on'); biz[b].classList.remove('on');
        await wait(350);
      }
    });
  }

  // /network — one repair job, step by step
  const board = $('#board');
  if (board) {
    const btns = $$('.jsteps button');
    const ctl = $('#js-pause');
    const n = btns.length;
    let step = reduce ? n : 1, timer = null, paused = reduce;
    const show = s => {
      step = s;
      for (let i = 1; i <= n; i++) {
        board.classList.toggle('s' + i, i <= s);
        board.classList.toggle('now-' + i, i === s);
      }
      btns.forEach((b, i) => { if (i + 1 === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    };
    const tick = () => { if (!document.hidden) show(step % n + 1); };
    const play = () => { clearInterval(timer); timer = setInterval(tick, 3200); paused = false; if (ctl) ctl.textContent = 'Pause'; };
    const stop = () => { clearInterval(timer); timer = null; paused = true; if (ctl) ctl.textContent = 'Play'; };
    btns.forEach((b, i) => b.addEventListener('click', () => { stop(); show(i + 1); }));
    if (ctl) ctl.addEventListener('click', () => (paused ? play() : stop()));
    show(step);
    if (!reduce) whenSeen(board, play); else if (ctl) ctl.textContent = 'Play';
  }

  // /network — the café reorder, and any other simple step strip
  $$('[data-cycle]').forEach(list => {
    const items = $$('li', list);
    let k = 0;
    items[0].classList.add('on');
    if (reduce) return;
    whenSeen(list, () => setInterval(() => {
      if (document.hidden) return;
      items[k].classList.remove('on');
      items[k = (k + 1) % items.length].classList.add('on');
    }, 2000));
  });

  // /os — one act travels down the layers
  const os = $('#os-fig');
  if (os) {
    const bands = $$('.band[data-b]', os);
    const st = b => $('.st', $(`.band[data-b="${b}"]`, os));
    const actName = $('#os-act-name');
    const acts = [
      { name: 'Send a member a chore reminder', res: { rules: ['Allowed', 'ok'], agent: ['Asks to send', ''], gate: ['Allowed', 'ok'], human: ['Not needed', 'off'], record: ['Remembered', 'ok'], receipt: ['Not needed', 'off'], pack: ['Chore rules', ''] } },
      { name: 'Book a repair above the cap', res: { rules: ['Above the cap', 'ask'], agent: ['Asks to book', ''], gate: ['Needs a person', 'ask'], human: ['Approved, one tap', 'ok'], record: ['Remembered', 'ok'], receipt: ['Both sides signed', 'ok'], pack: ['Repair job type', ''] } },
      { name: "Share a member's phone number", res: { rules: ['Not allowed', 'stop'], agent: ['Asks to share', ''], gate: ['Stopped', 'stop'], human: ['Never reached', 'off'], record: ['Refusal remembered', 'ok'], receipt: ['Nothing sent', 'off'], pack: ['Privacy rules', ''] } },
    ];
    const order = ['rules', 'agent', 'gate', 'human', 'record', 'receipt', 'pack'];
    const set = (b, [text, tone]) => { const el = st(b); if (!el) return; el.textContent = text; el.className = 'st ' + tone; };
    const clear = () => { bands.forEach(b => b.classList.remove('on')); order.forEach(b => set(b, ['Waiting', 'off'])); };
    const showAll = act => { actName.textContent = act.name; order.forEach(b => set(b, act.res[b])); };
    if (reduce) showAll(acts[1]);
    else whenSeen(os, async () => {
      for (let k = 0; ; k = (k + 1) % acts.length) {
        await idle();
        const act = acts[k];
        clear(); actName.textContent = act.name;
        await wait(500);
        for (const b of order) {
          const band = $(`.band[data-b="${b}"]`, os);
          bands.forEach(x => x.classList.remove('on'));
          band.classList.add('on');
          set(b, act.res[b]);
          await wait(b === 'gate' || b === 'human' ? 1300 : 850);
        }
        bands.forEach(x => x.classList.remove('on'));
        await wait(2200);
      }
    });
  }
})();
