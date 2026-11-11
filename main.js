(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // nav border once scrolled
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // count-up for metrics (final values are already in the HTML)
  const fmt = n => n.toLocaleString('en-US');
  const countUp = el => {
    const end = +el.dataset.count, suffix = el.dataset.suffix || '';
    if (reduce) return;
    const t0 = performance.now(), dur = 1400;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(end * e)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // reveal on scroll
  const reveals = $$('.reveal');
  if (!('IntersectionObserver' in window) || reduce) {
    reveals.forEach(el => el.classList.add('in'));
    $$('.stack').forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('in');
        if (el.matches('.metrics')) $$('[data-count]', el).forEach(countUp);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((el, i) => {
      // stagger siblings that enter together
      el.style.transitionDelay = `${(i % 4) * 60}ms`;
      io.observe(el);
    });
  }

  // live ledger
  const rows = $('#ledger-rows');
  const events = [
    ['Chore photo graded', 'Living room · House 21', 'Pass', 'ok'],
    ['Ticket from a member\'s text', 'Broken blind · House 6', 'Auto', ''],
    ['Reminder sent', 'Room 3 · chore due Saturday', 'Sent', ''],
    ['Chore photo graded', 'Bathroom · House 17', 'Pass', 'ok'],
    ['Damage spotted in chore photo', 'Kitchen · House 11 → ticket', 'Flagged', 'warn'],
    ['Fine assessed', 'From the photo records', 'Evidence', ''],
    ['Maintenance ticket closed', 'House 15', 'Done', 'ok'],
    ['Chore photo graded', 'Kitchen · House 8', 'Retake', 'warn'],
    ['Ratings watch', 'New review logged · House 19', 'Logged', ''],
    ['Reminder sent', 'Room 12 · photo still missing', 'Sent', ''],
  ];
  if (rows && !reduce) {
    let i = 0, clock = new Date();
    clock.setHours(9, 41, 2, 0);
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      if (document.hidden) return;
      clock = new Date(clock.getTime() + (9 + Math.floor(Math.random() * 14)) * 1000);
      const [title, sub, chip, tone] = events[i++ % events.length];
      const li = document.createElement('li');
      li.className = 'row enter';
      li.innerHTML = `<time>${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}</time>`
        + `<span class="ev"><b></b><span></span></span><span class="chip ${tone}"></span>`;
      $('b', li).textContent = title;
      $('.ev span', li).textContent = sub;
      $('.chip', li).textContent = chip;
      rows.prepend(li);
      while (rows.children.length > 7) rows.lastElementChild.remove();
    };
    setInterval(tick, 2600);
  }

  // demo player
  const video = $('#demo-video'), btn = $('#play-btn');
  if (video && btn) {
    btn.addEventListener('click', () => {
      video.controls = true;
      video.closest('.player').classList.add('playing');
      video.play().catch(() => {});
    });
    video.addEventListener('ended', () => {
      video.closest('.player').classList.remove('playing');
      video.controls = false;
      video.load();
    });
  }
  // waitlist: posts JSON to /api/waitlist; without JS the form posts normally and the function redirects back
  const wl = $('#wl-form');
  if (wl) {
    const msg = $('#wl-msg'), btn = $('button[type=submit]', wl);
    const applyLink = $('#wl-apply');
    const okText = () => { const k = (wl.elements.namedItem('interest') || {}).value;
      return (k && wl.dataset['ok' + k[0].toUpperCase() + k.slice(1)]) || "You're on the list. We'll be in touch when a spot opens."; };
    const qs = new URLSearchParams(location.search), src = $('#wl-src');
    if (src) src.value = (qs.get('src') || qs.get('utm_source') || (document.referrer && !document.referrer.includes(location.host) ? new URL(document.referrer).hostname : '')).slice(0, 60);
    const pick = () => wl.querySelectorAll('.wl-call').forEach(el => { el.hidden = (wl.elements.namedItem('interest') || {}).value === 'newsletter'; });
    const want = wl.querySelector(`input[name=interest][value="${(qs.get('for') || '').replace(/[^a-z]/g, '')}"]`);
    if (want) want.checked = true;
    wl.addEventListener('change', pick); pick();
    // after a call request, open the booking calendar with the person's details filled in
    const cal = $('#cal');
    function showCalendar() {
      const k = (wl.elements.namedItem('interest') || {}).value;
      if (!cal || (k !== 'business' && k !== 'coaching')) return;
      const q = new URLSearchParams({ name: wl.elements.namedItem('name').value, email: wl.email.value,
        a1: wl.elements.namedItem('note').value, hide_gdpr_banner: '1' });
      const url = cal.dataset.cal + '?' + q;
      $('#cal-link').href = url;
      if (/(^|\.)teroir\.com$|\.vercel\.app$|^localhost$/.test(location.hostname)) {
        const f = document.createElement('iframe');
        f.title = 'Book a time with Wyatt'; f.loading = 'lazy';
        f.src = url + '&embed_type=Inline&embed_domain=' + location.hostname;
        $('#cal-frame').replaceChildren(f);
      }
      cal.hidden = false;
    }
    function showApplicationLink(name = '', email = '') {
      if (!applyLink) return;
      applyLink.href = '/apply?' + new URLSearchParams({name, email});
      applyLink.hidden = false;
    }
    $('#wl-t').value = String(Date.now());
    if (new URLSearchParams(location.search).get('joined') === '1') {
      wl.classList.add('done'); msg.className = 'wl-msg ok';
      msg.textContent = okText(); showCalendar();
      showApplicationLink(wl.elements.namedItem('name').value, wl.email.value);
    }
    wl.addEventListener('submit', async ev => {
      ev.preventDefault();
      const email = wl.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.className = 'wl-msg err'; msg.textContent = 'Please enter a valid email address.'; wl.email.focus(); return;
      }
      btn.disabled = true; msg.className = 'wl-msg'; msg.textContent = 'Sending…';
      try {
        const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(wl))) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw new Error(d.error || 'failed');
        wl.classList.add('done'); msg.className = 'wl-msg ok';
        msg.textContent = okText(); showCalendar();
        showApplicationLink(wl.elements.namedItem('name').value, wl.email.value);
      } catch (e) {
        btn.disabled = false; msg.className = 'wl-msg err';
        msg.textContent = 'That did not go through. Please try again, or email hortonwyatt@outlook.com.';
      }
    });
  }
})();
