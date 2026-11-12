// teroir.com/free?paid=<session>: after Stripe Checkout, check the payment, show the download links, and email them once.
// The Stripe webhook (api/stripe-webhook) also delivers, so a buyer who closes the tab still gets the email.
const G = require('./_guides');

module.exports = async (req, res) => {
  const id = G.clean(req.query?.session, 200);
  if (!/^cs_(test|live)_\w+$/.test(id)) return res.status(400).json({ ok: false, error: 'session' });
  try {
    const s = await G.stripe('GET', `checkout/sessions/${id}`, { expand: ['payment_intent'] });
    if (s.payment_status !== 'paid') return res.status(402).json({ ok: false, error: 'unpaid' });
    const { email, links } = await G.deliver(s);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, email, links });
  } catch (e) {
    console.error('order failed', e.message);
    return res.status(502).json({ ok: false, error: 'stripe' });
  }
};
