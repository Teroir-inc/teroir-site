// wyattworldwide.com passes on the visitor's device. A pass is the signed link from the email (?k=...); it is kept in
// localStorage so the doors stay open on return visits. The server decides what a pass opens (/api/district);
// reading the token here only lights the right gates on the map.
(() => {
  const KEY = 'ww-passes';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(Boolean); } catch { return []; } };
  const save = list => { try { localStorage.setItem(KEY, JSON.stringify([...new Set(list)].slice(-6))); } catch {} };
  const qs = new URLSearchParams(location.search);
  const fresh = qs.get('k');
  let passes = load();
  if (fresh) { passes = [fresh, ...passes.filter(p => p !== fresh)]; save(passes); qs.delete('k');
    history.replaceState(null, '', location.pathname + (qs.toString() ? `?${qs}` : '') + location.hash); }
  const held = passes.map(p => { try { const o = JSON.parse(atob(p.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); return o.x > Date.now() && /^district:/.test(o.d) ? o.d.slice(9) : null; } catch { return null; } }).filter(Boolean);
  const opens = (h, want) => h === want || h === 'rooftop-hq' || want === 'free-street';
  const has = want => held.some(h => opens(h, want));

  // the map: light every gate this device holds a pass for
  document.querySelectorAll('.gate[data-id]').forEach(g => {
    if (g.classList.contains('gate--soon') || !has(g.dataset.id)) return;
    g.classList.replace('gate--locked', 'gate--open');
    const st = g.querySelector('.gate-status'); if (st) st.textContent = 'open';
    g.href = `/d/${g.dataset.id}`;
  });

  document.querySelectorAll('.pnl[data-id]').forEach(g => {
    if (g.classList.contains('is-soon') || !has(g.dataset.id) || g.dataset.id === 'vip') return;
    g.classList.add('is-open'); const st = g.querySelector('.status'); if (st) st.textContent = 'open · your pass';
  });

  // a district page: ask the server what this device's passes open
  const box = document.getElementById('district');
  if (!box) return;
  const id = box.dataset.id, $ = s => box.querySelector(s);
  fetch(`/api/district?d=${encodeURIComponent(id)}&k=${encodeURIComponent(passes.join(','))}`).then(r => r.json()).then(j => {
    if (!j.ok) throw 0;
    const gate = document.querySelector('.gate[data-id]');
    if (!j.open) {
      $('.d-locked').hidden = false;
      const d = j.district, st = gate && gate.querySelector('.gate-status');
      if (st) st.textContent = d.id === 'free-street' ? 'opens with your free day pass' : `opens with ${d.kind === 'all-access pass' ? 'the' : 'an'} ${d.kind} · $${Math.round(d.price / 100)}`;
      return;
    }
    if (gate) { gate.classList.replace('gate--locked', 'gate--open'); gate.querySelector('.gate-status').textContent = 'open'; }
    $('.d-open').hidden = false;
    $('.d-who').textContent = j.email;
    const ul = $('.d-files');
    for (const g of j.guides) { const li = document.createElement('li'); const a = document.createElement('a'); a.href = g.url; a.textContent = g.title; li.append(a); ul.append(li); }
    $('.d-files-wrap').hidden = !j.guides.length;
    const lv = $('.d-lessons');
    for (const l of j.lessons || []) {
      const f = document.createElement('figure'); f.className = 'lesson';
      const fr = document.createElement('iframe'); fr.loading = 'lazy'; fr.title = l.title; fr.allow = 'encrypted-media; picture-in-picture'; fr.allowFullscreen = true;
      fr.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(l.youtube)}`;
      const c = document.createElement('figcaption'); c.textContent = l.title; f.append(fr, c); lv.append(f);
    }
    const rl = $('.d-reads');
    for (const l of j.reads || []) {
      const a = document.createElement('a'); a.className = 'btn-ghost'; a.href = `?l=${encodeURIComponent(l.slug)}`;
      const b = document.createElement('b'); b.textContent = l.title; const sp = document.createElement('span'); sp.className = 'muted'; sp.textContent = 'read →';
      a.append(b, sp); rl.append(a);
    }
    $('.d-lessons-wrap').hidden = !((j.lessons || []).length || (j.reads || []).length);
    const want = new URLSearchParams(location.search).get('l');
    if (want && (j.reads || []).some(l => l.slug === want)) {
      fetch(`/api/lesson?d=${encodeURIComponent(id)}&s=${encodeURIComponent(want)}&k=${encodeURIComponent(passes.join(','))}`).then(r => r.json()).then(x => {
        if (!x.ok) throw 0;
        const art = $('.d-read'); art.hidden = false;
        art.querySelector('h1').textContent = x.title;
        art.querySelector('.post-body').innerHTML = x.html; // rendered and escaped at build time; no raw HTML from authors
        art.scrollIntoView({ block: 'start' });
      }).catch(() => { $('.d-error').hidden = false; });
    }
  }).catch(() => { $('.d-error').hidden = false; const st = document.querySelector('.gate[data-id] .gate-status'); if (st) st.textContent = 'pass check unavailable'; });
})();

// a locked district page: buy its pass (Stripe Checkout; the email typed here is the one the pass is locked to)
(() => {
  const f = document.getElementById('d-buy');
  if (!f) return;
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = f.querySelector('.msg'), btn = f.querySelector('button'), email = f.elements.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    btn.disabled = true; msg.textContent = '';
    const src = (new URLSearchParams(location.search).get('src') || 'district').replace(/[^\w.\-]/g, '').slice(0, 60);
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: f.elements.item.value, email, src }) });
      const j = await r.json();
      if (j.url) { location.href = j.url; return; }
    } catch {}
    msg.textContent = 'Checkout is not available right now. Please try again in a minute.'; btn.disabled = false;
  });
})();
