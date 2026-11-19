// wyattworldwide.com/free: starts a Stripe Checkout for one guide or the bundle of all guides (prices in _guides.js).
const G = require('./_guides');
const D = require('./_districts');

const STATEMENT_SUFFIX = 'WWW GUIDES';

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const item = G.clean(b.item, 40);
  const one = G.BY_ID[item];
  // district pass: item 'district-<id>', only open districts with a price
  const dist = /^district-/.test(item) ? D.BY_DISTRICT[item.slice(9)] : null;
  if (dist && (dist.status !== 'open' || !dist.price)) return res.status(400).json({ ok: false, error: 'item' });
  if (!dist && (!one || !one.price) && item !== 'bundle') return res.status(400).json({ ok: false, error: 'item' }); // free guides are not sold singly
  const email = G.clean(b.email, 200).toLowerCase();
  const src = G.clean(b.src, 60).replace(/[^\w.\-]/g, '');
  const origin = G.originOf(req);

  // 24-hour $29 offer from the free-guide email: single paid guides only, locked to the email it was sent to
  const offer = one && !dist && b.offer ? G.offerOk(G.clean(b.offer, 400)) : null;
  const buyer = offer ? offer.e : G.EMAIL_RE.test(email) ? email : undefined;
  // the page always sends the email typed on teroir.com; it is locked into Checkout so a wallet (Apple Pay, Link) can't swap it
  if (wantsJson && !buyer) return res.status(400).json({ ok: false, error: 'email' });
  const ids = dist ? (dist.guides === 'all' ? G.GUIDES.map(g => g.id) : dist.guides) : one ? [one.id] : G.GUIDES.map(g => g.id);
  const meta = { brand: G.BRAND, guides: ids.join(','), src: src || 'direct', ...(buyer ? { email: buyer } : {}), ...(offer ? { offer: '29' } : {}), ...(dist ? { district: dist.id } : one ? {} : { district: 'rooftop-hq' }) };
  const amount = offer ? G.OFFER_PRICE : dist ? dist.price : one ? one.price : G.PRICE_BUNDLE;
  try {
    const s = await G.stripe('POST', 'checkout/sessions', {
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amount,
        product_data: { metadata: { brand: G.BRAND, ...(dist ? { district: dist.id } : {}) }, name: dist ? `${dist.name} pass (wyattworldwide.com)` : one ? `Guide: ${one.title}` : `Guides: all ${ids.length}`,
          description: dist ? `${dist.line} Sent to your email as a signed link.` : one ? 'PDF guide, sent to your email' : G.GUIDES.map(g => g.title).join(' · ') } } }],
      customer_email: buyer,
      customer_creation: 'always',
      allow_promotion_codes: 'true',
      metadata: meta,
      // fewer bank fraud declines (owner 11-15): a statement line buyers recognise ("TEROIR, IN* WWW GUIDES", 22 chars, the
      // limit), a Stripe receipt to the buyer, and 3D Secure on $97 and up (below that, Stripe decides: 'automatic')
      payment_intent_data: { metadata: meta, statement_descriptor_suffix: STATEMENT_SUFFIX, ...(buyer ? { receipt_email: buyer } : {}) },
      // an expired session gets a Stripe recovery link (restores the cart), used by the abandoned-checkout email
      after_expiration: { recovery: { enabled: 'true', allow_promotion_codes: 'true' } },
      ...(amount >= 9700 ? { payment_method_options: { card: { request_three_d_secure: 'any' } } } : {}),
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
