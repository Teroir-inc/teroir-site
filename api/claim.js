// wyattworldwide.com/free: one free guide per email. The download link is emailed, so the address has to be real.
// The record of who claimed what lives on the Stripe customer (metadata.free_guide), so there is no extra database.
const G = require('./_guides');
const E = require('./_email');
const Q = require('./_queue');
const S = require('./_share');

// The claimer's email (html + text). Every link is on www.wyattworldwide.com: teroir.com/free redirects there anyway.
const freeEmail = ({ guide, link, pass, offer, share }) => E.renderEmail({
  preheader: `Your free guide: ${guide.title}`,
  kicker: 'free day pass',
  heading: 'Your free guide',
  intro: [`Hey, it's Wyatt. Here's your free guide, "${guide.title}".`],
  buttons: [
    { label: 'Download the guide', url: link, note: guide.title, primary: true },
    { label: 'Open Free Street', url: pass, note: 'Your Free Street pass · no login needed' },
    { label: 'Get any guide for $29 — 24 hours', url: offer, note: 'For the next 24 hours, any of the longer guides is $29' },
    ...(share ? [{ label: 'Get your share link', url: share, note: 'When 3 friends claim a guide with it, you pick a longer guide free' }] : []),
  ],
  notes: ['The download link works for 30 days. Save the PDF somewhere you will see it again.',
    'Questions, or want something like this built for your business? Just reply to this email.'],
  signoff: ['Wyatt', G.SIGNOFF],
});

module.exports = async (req, res) => {
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    const to = body.ok ? (body.me ? `/free?sent=1&me=${body.me}#share` : '/free?sent=1#get') : body.error === 'claimed' ? '/free?claimed=1#buy' : null;
    if (to) { res.setHeader('Location', to); return res.status(303).end(); }
    return res.status(status).send('Something went wrong. Please email wyatt@teroir.com.');
  };
  if (req.method === 'GET' && req.query?.me) return S.status(req, res); // share link status (api/_share.js)
  if (req.method === 'POST' && b.bonus) return S.bonus(req, res, b);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }

  // bots: a filled honeypot, or a submit faster than a person can type, gets a quiet success and nothing is sent
  const t = Number(b.t);
  if (G.clean(b.website, 200) || (t && Date.now() - t < 2500)) return reply(200, { ok: true });

  const email = G.clean(b.email, 200).toLowerCase();
  if (!G.EMAIL_RE.test(email)) return reply(400, { ok: false, error: 'email' });
  const guide = G.BY_ID[G.clean(b.guide, 40)];
  if (!guide || guide.paidOnly) return reply(400, { ok: false, error: 'guide' }); // paid-only guides can't be the free pick
  const src = G.clean(b.src, 60).replace(/[^\w.\-]/g, '');

  let share = null;
  try {
    const found = (await G.stripe('GET', 'customers', { email, limit: 10 })).data;
    const prior = found.find(c => c.metadata?.free_guide);
    if (prior) return reply(409, { ok: false, error: 'claimed', guide: prior.metadata.free_guide });

    const link = G.linkFor(guide.id, email, 30);
    // a share link of their own; if the list store is down they still get the guide, just without the link
    const ref = G.clean(b.ref, 20).toLowerCase();
    share = await Q.shareJoin({ email, ref, net: Q.netOf(req), guide: guide.id }).then(r => r.code).catch(e => { console.error('share join failed', e.message); return null; });
    await G.send({
      from: G.FROM, to: [email], reply_to: 'wyatt@teroir.com',
      subject: `Your free guide: ${guide.title}`,
      ...freeEmail({ guide, link, pass: G.passFor('free-street', email, 365), offer: `${E.WW}/free?offer=${G.offerFor(email)}#buy`, share: share && S.meUrl(share) }),
    });

    const meta = { brand: G.BRAND, free_guide: guide.id, free_src: src || 'direct', free_at: new Date().toISOString(), nurture: 'on', nurture_step: '0' }; // follow-ups: api/_nurture.js
    if (found[0]) await G.stripe('POST', `customers/${found[0].id}`, { metadata: meta });
    else await G.stripe('POST', 'customers', { email, description: 'Free guide signup (wyattworldwide.com/free)', metadata: meta });
  } catch (e) {
    console.error('claim failed', e.message);
    return reply(502, { ok: false, error: 'send' });
  }

  await G.notify(`Free guide: ${guide.title} · ${email}${src ? ` · ${src}` : ''}`, [
    `Guide: ${guide.title}`, `Email: ${email}`, `Came from: ${src || '(direct)'}`, `When: ${new Date().toISOString()}`,
    `Country: ${G.clean(req.headers['x-vercel-ip-country'], 4) || 'unknown'}`]);
  return reply(200, share ? { ok: true, share: S.shareUrl(share), me: S.meToken(share) } : { ok: true });
};
module.exports.freeEmail = freeEmail; // for tests and the QA render
