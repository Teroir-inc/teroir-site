// Stripe webhook: emails paid guides even if the buyer never returns to /free.
// Setup (Stripe dashboard): endpoint https://teroir.com/api/stripe-webhook, events checkout.session.completed and
// checkout.session.async_payment_succeeded; put its signing secret (whsec_...) in Vercel as STRIPE_WEBHOOK_SECRET.
const crypto = require('crypto');
const G = require('./_guides');

const raw = req => new Promise((ok, fail) => {
  const parts = [];
  req.on('data', c => parts.push(c));
  req.on('end', () => ok(Buffer.concat(parts)));
  req.on('error', fail);
});

// Stripe-Signature: t=<unix>,v1=<hex hmac of "t.body">; anything older than 5 minutes is refused
function verified(sig, body, secret, now = Date.now()) {
  const kv = String(sig || '').split(',').map(p => p.split('='));
  const t = kv.find(([k]) => k === 't')?.[1];
  const v1 = kv.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !v1.length || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const want = crypto.createHmac('sha256', secret).update(`${t}.`).update(body).digest();
  return v1.some(v => { const got = Buffer.from(v, 'hex'); return got.length === want.length && crypto.timingSafeEqual(got, want); });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { console.error('STRIPE_WEBHOOK_SECRET missing'); return res.status(500).end(); }
  const body = await raw(req);
  if (!verified(req.headers['stripe-signature'], body, secret)) return res.status(400).json({ ok: false, error: 'signature' });
  let ev;
  try { ev = JSON.parse(body.toString('utf8')); } catch { return res.status(400).end(); }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(ev.type)) {
    return res.status(200).json({ ok: true, ignored: ev.type });
  }
  try {
    // re-read the session from Stripe rather than trusting the event body
    const s = await G.stripe('GET', `checkout/sessions/${ev.data.object.id}`, { expand: ['payment_intent'] });
    if (s.payment_status === 'paid') await G.deliver(s);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('webhook delivery failed', e.message);
    return res.status(500).json({ ok: false }); // Stripe retries
  }
};
module.exports.verified = verified;
