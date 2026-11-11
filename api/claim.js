// teroir.com/free: one free guide per email. The download link is emailed, so the address has to be real.
// The record of who claimed what lives on the Stripe customer (metadata.free_guide), so there is no extra database.
const G = require('./_guides');

module.exports = async (req, res) => {
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    const to = body.ok ? '/free?sent=1#get' : body.error === 'claimed' ? '/free?claimed=1#buy' : null;
    if (to) { res.setHeader('Location', to); return res.status(303).end(); }
    return res.status(status).send('Something went wrong. Please email wyatt@teroir.com.');
  };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }

  // bots: a filled honeypot, or a submit faster than a person can type, gets a quiet success and nothing is sent
  const t = Number(b.t);
  if (G.clean(b.website, 200) || (t && Date.now() - t < 2500)) return reply(200, { ok: true });

  const email = G.clean(b.email, 200).toLowerCase();
  if (!G.EMAIL_RE.test(email)) return reply(400, { ok: false, error: 'email' });
  const guide = G.BY_ID[G.clean(b.guide, 40)];
  if (!guide) return reply(400, { ok: false, error: 'guide' });
  const src = G.clean(b.src, 60).replace(/[^\w.\-]/g, '');

  try {
    const found = (await G.stripe('GET', 'customers', { email, limit: 10 })).data;
    const prior = found.find(c => c.metadata?.free_guide);
    if (prior) return reply(409, { ok: false, error: 'claimed', guide: prior.metadata.free_guide });

    const link = G.linkFor(guide.id, email, 30);
    await G.send({
      from: G.FROM, to: [email], reply_to: 'wyatt@teroir.com',
      subject: `Your free guide: ${guide.title}`,
      text: [`Hey, it's Wyatt.`, '', `Here's your free guide, "${guide.title}":`, link, '',
        'The link works for 30 days. Save the PDF somewhere you will see it again.', '',
        `Want the other guides? They're at https://teroir.com/free#buy`, '',
        'Questions, or want something like this built for your business? Just reply to this email.', '',
        'Wyatt', 'Teroir · teroir.com'].join('\n'),
    });

    const meta = { free_guide: guide.id, free_src: src || 'direct', free_at: new Date().toISOString() };
    if (found[0]) await G.stripe('POST', `customers/${found[0].id}`, { metadata: meta });
    else await G.stripe('POST', 'customers', { email, description: 'Free guide signup (teroir.com/free)', metadata: meta });
  } catch (e) {
    console.error('claim failed', e.message);
    return reply(502, { ok: false, error: 'send' });
  }

  await G.notify(`Free guide: ${guide.title} · ${email}${src ? ` · ${src}` : ''}`, [
    `Guide: ${guide.title}`, `Email: ${email}`, `Came from: ${src || '(direct)'}`, `When: ${new Date().toISOString()}`,
    `Country: ${G.clean(req.headers['x-vercel-ip-country'], 4) || 'unknown'}`]);
  return reply(200, { ok: true });
};
