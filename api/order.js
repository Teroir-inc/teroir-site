// teroir.com/free?paid=<session>: after Stripe Checkout, check the payment, show the download links, and email them once.
const G = require('./_guides');

module.exports = async (req, res) => {
  const id = G.clean(req.query?.session, 200);
  if (!/^cs_(test|live)_\w+$/.test(id)) return res.status(400).json({ ok: false, error: 'session' });
  try {
    const s = await G.stripe('GET', `checkout/sessions/${id}`, { expand: ['payment_intent'] });
    if (s.payment_status !== 'paid') return res.status(402).json({ ok: false, error: 'unpaid' });
    const email = String(s.customer_details?.email || s.customer_email || '').toLowerCase();
    const guides = String(s.metadata?.guides || '').split(',').map(g => G.BY_ID[g]).filter(Boolean);
    const links = guides.map(g => ({ id: g.id, title: g.title, url: G.linkFor(g.id, email, 730) }));

    const pi = s.payment_intent;
    if (pi && typeof pi === 'object' && !pi.metadata?.delivered) {
      await G.send({
        from: G.FROM, to: [email], reply_to: 'wyatt@teroir.com',
        subject: links.length > 1 ? 'Your Teroir guides' : `Your guide: ${links[0].title}`,
        text: [`Hey, it's Wyatt. Thanks for buying${links.length > 1 ? ' the guides' : ''}.`, '',
          ...links.flatMap(l => [`${l.title}:`, l.url, '']),
          'These links work for two years. Save the PDFs somewhere you will see them again.', '',
          'Questions, or want something like this built for your business? Just reply to this email.', '',
          'Wyatt', 'Teroir · teroir.com'].join('\n'),
      });
      await G.stripe('POST', `payment_intents/${pi.id}`, { metadata: { delivered: new Date().toISOString() } });
      await G.notify(`Guide sale: $${(s.amount_total / 100).toFixed(2)} · ${email}`, [
        `Bought: ${guides.map(g => g.title).join(', ')}`, `Paid: $${(s.amount_total / 100).toFixed(2)}`,
        `Email: ${email}`, `Came from: ${s.metadata?.src || '(direct)'}`, `Stripe session: ${s.id}`]);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, email, links });
  } catch (e) {
    console.error('order failed', e.message);
    return res.status(502).json({ ok: false, error: 'stripe' });
  }
};
