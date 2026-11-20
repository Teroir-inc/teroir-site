// teroir.com/founding: join the founding list, then show the person's real place and their invite link.
// Every number on the page comes from /api/waitlist?list=founding; nothing is made up here.
(() => {
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const API = '/api/waitlist?list=founding';
  const form = $('fq-form'), msg = $('fq-msg'), you = $('you');
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  // the inviter's code from ?r=, kept for this visit so a reload still credits them
  const ref = (qs.get('r') || store.get('fq-ref') || '').toLowerCase().replace(/[^a-z2-9]/g, '').slice(0, 8);
  if (ref.length === 8) { $('fq-ref').value = ref; store.set('fq-ref', ref); $('fq-invited').hidden = false; }
  let src = (qs.get('src') || qs.get('utm_source') || '').replace(/[^\w.\-]/g, '').slice(0, 60);
  if (!src && ref) src = 'invite';
  $('fq-src').value = src;
  $('fq-t').value = String(Date.now());

  const showTotal = n => { if (n) { $('fq-total').textContent = `${n.toLocaleString()} operators are on the list.`; $('fq-total').hidden = false; } };
  const placeText = n => `You're number ${Number(n).toLocaleString()} on the list.`;
  function showYou(d, note) {
    form.hidden = true; $('fq-invited').hidden = true; you.hidden = false;
    $('fq-you-h').textContent = d.place ? placeText(d.place) : "You're on the list.";
    $('fq-you-p').textContent = note;
    $('fq-invite').value = d.invite;
    $('fq-count').textContent = `Each operator who joins with your link and confirms their email moves you up ${d.step || 3} places.` +
      (typeof d.invites === 'number' ? ` So far, ${d.invites} ${d.invites === 1 ? 'has' : 'have'} joined with it.` : '');
    showTotal(d.total);
  }
  $('fq-copy').addEventListener('click', async () => {
    const i = $('fq-invite');
    try { await navigator.clipboard.writeText(i.value); } catch { i.select(); document.execCommand && document.execCommand('copy'); }
    $('fq-copy').textContent = 'Copied';
    setTimeout(() => { $('fq-copy').textContent = 'Copy'; }, 2000);
  });

  // the person's own view: ?me=<token> from their email (or saved from the join on this device)
  const me = qs.get('me') || store.get('fq-me');
  if (qs.get('bad')) msg.textContent = "That link didn't work. Check that you copied the whole link from your email.";
  if (qs.get('error')) msg.textContent = 'Something went wrong. Please try the link again, or email wyatt@teroir.com.';
  if (qs.get('already')) msg.textContent = "You're already on the list. We emailed your links again.";
  if (me) {
    fetch(`${API}&me=${encodeURIComponent(me)}`).then(r => r.json()).then(d => {
      if (!d.ok) return;
      store.set('fq-me', me);
      showYou(d, qs.get('confirmed') ? 'Your email is confirmed. Thanks.' : d.confirmed ? 'Your email is confirmed.' : 'Check your inbox to confirm your email.');
    }).catch(() => {});
  } else {
    fetch(API).then(r => r.json()).then(d => showTotal(d.total)).catch(() => {});
  }

  const ERR = { email: 'Please check your email address.', disposable: 'Please use an email you check. Throwaway addresses can\'t join.',
    name: 'Please add your name.', company: 'Please add your company.', doors: 'Please add the number of doors (rooms you rent).',
    limit: 'Too many signups from this network today. Please try again tomorrow, or email wyatt@teroir.com.',
    already: "You're already on the list. We emailed your links again." };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = 'Joining…';
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const d = await r.json().catch(() => ({}));
      if (d.ok && d.me) { store.set('fq-me', d.me); showYou(d, 'Check your inbox to confirm your email.'); msg.textContent = ''; }
      else if (d.ok) msg.textContent = 'Thanks. Check your inbox.';
      else msg.textContent = ERR[d.error] || 'Something went wrong. Please try again, or email wyatt@teroir.com.';
    } catch { msg.textContent = 'Something went wrong. Please try again, or email wyatt@teroir.com.'; }
    btn.disabled = false;
  });
})();
