// teroir.com waitlist: each signup is emailed to Wyatt (the list lives in his inbox) and the signer gets a fixed confirmation.
const NOTIFY_TO = ['hortonwyatt@outlook.com'];
const NOTIFY_CC = ['wyatthorton.pm@gmail.com'];
const FROM = 'Teroir Waitlist <waitlist@teroir.com>';
const EMAIL_RE = /^[^\s@<>"]{1,100}@[^\s@<>"]{1,100}\.[^\s@<>"]{2,24}$/;
const ROLES = new Set(['Property manager', 'Owner-operator', 'Co-living or PadSplit host', 'Investor', 'Other', '']);

const clean = (v, n) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, '').trim().slice(0, n);

async function send(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

module.exports = async (req, res) => {
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    if (body.ok) { res.setHeader('Location', '/?joined=1#waitlist'); return res.status(303).end(); }
    return res.status(status).send('Something went wrong. Please email hortonwyatt@outlook.com.');
  };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }

  const b = typeof req.body === 'object' && req.body ? req.body : {};
  // bots: a filled honeypot, or a submit faster than a person can type, gets a quiet success and nothing is sent
  const t = Number(b.t);
  if (clean(b.website, 200) || (t && Date.now() - t < 2500)) return reply(200, { ok: true });

  const email = clean(b.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return reply(400, { ok: false, error: 'email' });
  const name = clean(b.name, 120);
  const role = ROLES.has(clean(b.role, 60)) ? clean(b.role, 60) : 'Other';
  const size = clean(b.size, 20);
  if (!process.env.RESEND_API_KEY) { console.error('waitlist: RESEND_API_KEY missing'); return reply(500, { ok: false, error: 'config' }); }

  const when = new Date().toISOString();
  const lines = [`Name: ${name || '(not given)'}`, `Email: ${email}`, `Role: ${role || '(not given)'}`, `Rooms or units: ${size || '(not given)'}`,
    `Signed up: ${when}`, `Country: ${clean(req.headers['x-vercel-ip-country'], 4) || 'unknown'}`, '', 'Reply to this email to answer them directly.'];
  try {
    await send({ from: FROM, to: NOTIFY_TO, cc: NOTIFY_CC, reply_to: email,
      subject: `Teroir waitlist: ${name || email}${role ? ` · ${role}` : ''}`, text: lines.join('\n') });
  } catch (e) {
    console.error('waitlist notify failed', e.message);
    return reply(502, { ok: false, error: 'send' });
  }
  try {
    await send({ from: FROM, to: [email], reply_to: 'hortonwyatt@outlook.com', subject: "You're on the Teroir waitlist",
      text: ["Thanks for your interest in Teroir.", '',
        "You're on the waitlist for early access to PM.BOS. We bring on a small cohort of operators at a time so every house is set up properly, and we'll reach out when a spot opens.", '',
        'In the meantime, reply to this email if you want to tell us about your portfolio.', '', 'Wyatt Horton', 'Founder, Teroir', 'https://teroir.com'].join('\n') });
  } catch (e) {
    console.error('waitlist confirmation failed', e.message); // the signup itself reached Wyatt
  }
  return reply(200, { ok: true });
};
