// teroir.com/free: starts a Stripe Checkout for one guide or the bundle of all guides (prices in _guides.js).
const G = require('./_guides');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const item = G.clean(b.item, 40);
  const one = G.BY_ID[item];
  if (!one && item !== 'bundle') return res.status(400).json({ ok: false, error: 'item' });
  const email = G.clean(b.email, 200).toLowerCase();
  const src = G.clean(b.src, 60).replace(/[^\w.\-]/g, '');
  const host = String(req.headers.host || '');
  const origin = /^(teroir\.com|www\.teroir\.com|[\w-]+\.vercel\.app)$/.test(host) ? `https://${host}` : 'https://teroir.com';

  // 24-hour $29 offer from the free-guide email: single guides only, locked to the email it was sent to
  const offer = one && b.offer ? G.offerOk(G.clean(b.offer, 400)) : null;
  const buyer = offer ? offer.e : G.EMAIL_RE.test(email) ? email : undefined;
  const ids = one ? [one.id] : G.GUIDES.map(g => g.id);
  const meta = { guides: ids.join(','), src: src || 'direct', ...(offer ? { offer: '29' } : {}) };
  try {
    const s = await G.stripe('POST', 'checkout/sessions', {
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: offer ? G.OFFER_PRICE : one ? G.PRICE_EACH : G.PRICE_BUNDLE,
        product_data: { name: one ? `Teroir guide: ${one.title}` : `Teroir guides: all ${ids.length}`,
          description: one ? 'PDF guide, sent to your email' : G.GUIDES.map(g => g.title).join(' · ') } } }],
      customer_email: buyer,
      customer_creation: 'always',
      allow_promotion_codes: 'true',
      metadata: meta,
      payment_intent_data: { metadata: meta },
      success_url: `${origin}/free?paid={CHECKOUT_SESSION_ID}#get`,
      cancel_url: `${origin}/free#buy`,
    });
    if (wantsJson) return res.status(200).json({ ok: true, url: s.url });
    res.setHeader('Location', s.url); return res.status(303).end();
  } catch (e) {
    console.error('checkout failed', e.message);
    return wantsJson ? res.status(502).json({ ok: false, error: 'stripe' })
      : res.status(502).send('Checkout is not available right now. Please email wyatt@teroir.com.');
  }
};
