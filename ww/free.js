// teroir.com/free: claim one free guide by email, buy the rest through Stripe Checkout, show links after payment.
(() => {
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const TITLES = {};
  document.querySelectorAll('.gd-card[data-guide]').forEach(f => { TITLES[f.dataset.guide] = f.querySelector('b').textContent; });
  document.querySelectorAll('.gd-pick input').forEach(i => { TITLES[i.value] = i.parentNode.querySelector('b').textContent; });

  // where the visitor came from (ManyChat link: /free?src=manychat)
  let src = (qs.get('src') || qs.get('utm_source') || '').replace(/[^\w.\-]/g, '').slice(0, 60);
  if (!src && document.referrer) { try { const h = new URL(document.referrer).hostname; if (!h.endsWith('teroir.com')) src = h.replace(/^www\./, ''); } catch {} }
  $('gd-src').value = src;
  document.querySelectorAll('.gd-src').forEach(i => { i.value = src; });
  $('gd-t').value = Date.now();
  const want = qs.get('guide') && TITLES[qs.get('guide')] ? qs.get('guide') : '';
  const pick = want && document.querySelector(`.gd-pick input[value="${want}"]`);
  if (pick) pick.checked = true;
  else if (want) addEventListener('load', () => document.querySelector(`.gd-card[data-guide="${want}"]`).scrollIntoView({ block: 'center' })); // paid-only guide: show its buy card

  const form = $('gd-form'), msg = $('gd-msg'), done = $('gd-done');
  const show = (h, p) => { form.hidden = true; done.hidden = false; $('gd-done-h').textContent = h; $('gd-done-p').textContent = p; };
  const claimed = id => show('This email already has its day pass.',
    `${id && TITLES[id] ? `It got "${TITLES[id]}". ` : ''}Check your inbox for the link, or see the upgrades below.`);

  if (qs.get('sent')) show('Check your inbox.', "Your day pass is on its way. If it's not there in a few minutes, look in spam or promotions.");
  if (qs.get('claimed')) claimed();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!/^\S+@\S+\.\S+$/.test(data.email || '')) { msg.textContent = 'Please enter a valid email.'; return; }
    const btn = form.querySelector('button'); btn.disabled = true; msg.textContent = 'Sending…';
    try {
      const r = await fetch('/api/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        show('Check your inbox.', `"${TITLES[data.guide]}" is on its way to ${data.email}. If it's not there in a few minutes, look in spam or promotions.`);
        document.querySelectorAll('.gd-card').forEach(c => { c.hidden = c.dataset.guide === data.guide; });
        $('gd-buy-email').value = data.email;
      } else if (j.error === 'claimed') { claimed(j.guide); }
      else { msg.textContent = j.error === 'email' ? 'Please check your email address.' : 'Something went wrong. Please try again, or email wyatt@teroir.com.'; }
    } catch { msg.textContent = 'Something went wrong. Please try again, or email wyatt@teroir.com.'; }
    btn.disabled = false;
  });

  // 24-hour $29 offer link from the free-guide email: /free?offer=<token>. The server checks the token; this only shows the price.
  const offer = qs.get('offer');
  let offerEnd = 0;
  let offerEmail = '';
  try { ({ x: offerEnd, e: offerEmail } = JSON.parse(atob(offer.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))); } catch {}
  if (offerEnd > Date.now() && offerEmail) $('gd-buy-email').value = offerEmail;
  if (offerEnd > Date.now()) document.querySelectorAll('#buy form[data-guide]').forEach(f => {
    f.insertAdjacentHTML('beforeend', '<input type="hidden" name="offer">'); f.elements.offer.value = offer;
    const p = f.querySelector('.gd-price'); p.innerHTML = `<s>${p.textContent}</s> $29 <small>for 24 hours</small>`;
  });

  // Buy buttons: JSON first so the email they gave carries into Stripe; plain form post is the fallback
  document.querySelectorAll('#buy form').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      const email = $('gd-buy-email').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { $('gd-buy-msg').textContent = 'Please enter a valid email.'; $('gd-buy-email').focus(); btn.disabled = false; return; }
      $('gd-buy-msg').textContent = '';
      const body = { ...Object.fromEntries(new FormData(f)), email };
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.url) { location.href = j.url; return; }
    } catch {}
    btn.disabled = false; f.submit();
  }));

  // Back from Stripe: /free?paid=<session id>
  const paid = qs.get('paid');
  if (paid) {
    show('Payment received.', 'Getting your guides…');
    fetch(`/api/order?session=${encodeURIComponent(paid)}`).then(r => r.json()).then(j => {
      if (!j.ok) throw 0;
      $('gd-done-p').textContent = `Your download links are below, and they're in your inbox at ${j.email} too.`;
      const ul = $('gd-links');
      for (const l of j.links) { const li = document.createElement('li'); const a = document.createElement('a');
        a.href = l.url; a.textContent = `Download: ${l.title}`; a.className = 'more'; li.append(a); ul.append(li); }
    }).catch(() => { $('gd-done-p').textContent = "Your payment went through. If the guides aren't in your inbox in a few minutes, email wyatt@teroir.com and I'll send them right away."; });
  }
})();
