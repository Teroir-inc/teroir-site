// teroir.com waitlist: each signup is emailed to Wyatt (the list lives in his inbox) and the signer gets a fixed confirmation.
const NOTIFY_TO = ['wyatt@teroir.com'];
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
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    if (body.ok) { res.setHeader('Location', b.interest ? '/talk?joined=1#form' : '/apply'); return res.status(303).end(); }
    return res.status(status).send('Something went wrong. Please email wyatt@teroir.com.');
  };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }


  // bots: a filled honeypot, or a submit faster than a person can type, gets a quiet success and nothing is sent
  const t = Number(b.t);
  if (clean(b.website, 200) || (t && Date.now() - t < 2500)) return reply(200, { ok: true });

  const email = clean(b.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return reply(400, { ok: false, error: 'email' });
  const name = clean(b.name, 120);
  const role = ROLES.has(clean(b.role, 60)) ? clean(b.role, 60) : 'Other';
  const size = clean(b.size, 20);
  const INTERESTS = { business: 'Discovery call', coaching: 'Coaching call', newsletter: 'Newsletter', beta: 'Waitlist' };
  const asked = clean(b.interest, 20) === 'call' ? 'business' : clean(b.interest, 20);
  const interest = INTERESTS[asked] ? asked : 'beta';
  const isCall = interest === 'business' || interest === 'coaching';
  const src = clean(b.src, 60).replace(/[^\w.\-]/g, '');
  const times = clean(b.times, 200), note = clean(b.note, 500);
  if (!process.env.RESEND_API_KEY) { console.error('waitlist: RESEND_API_KEY missing'); return reply(500, { ok: false, error: 'config' }); }

  const when = new Date().toISOString();
  const lines = [`Wants: ${INTERESTS[interest]}`, `Name: ${name || '(not given)'}`, `Email: ${email}`,
    ...(interest === 'beta' ? [`Role: ${role || '(not given)'}`, `Rooms or units: ${size || '(not given)'}`] : []),
    ...(isCall ? [`Takes up their week: ${note || '(not given)'}`, `Good times: ${times || '(not given)'}`] : []),
    `Came from: ${src || '(direct)'}`, `Signed up: ${when}`, `Country: ${clean(req.headers['x-vercel-ip-country'], 4) || 'unknown'}`, '', 'Reply to this email to answer them directly.'];
  try {
    await send({ from: FROM, to: NOTIFY_TO, reply_to: email,
      subject: interest === 'beta' ? `Teroir waitlist: ${name || email}${role ? ` · ${role}` : ''}`
        : `Teroir ${INTERESTS[interest].toLowerCase()}: ${name || email}${src ? ` · ${src}` : ''}`, text: lines.join('\n') });
  } catch (e) {
    console.error('waitlist notify failed', e.message);
    return reply(502, { ok: false, error: 'send' });
  }
  try {
    const CONFIRM = {
      beta: ["You're on the Teroir waitlist", "You're on the waitlist for early access to PM.BOS. We bring on a small cohort of operators at a time so every house is set up properly, and we'll reach out when a spot opens.",
        'In the meantime, reply to this email if you want to tell us about your portfolio.'],
      business: ['Your discovery call with Teroir', "Thanks for reaching out about your business. If you haven't picked a time yet, book a one-on-one call here: https://calendly.com/wyatt-teroir/30min",
        'If it helps, reply with a little about your business and where your week goes. Calls may be recorded so you get the most out of the call and I can deliver the best result.'],
      coaching: ['Your coaching call with Teroir', "Thanks for reaching out about coaching. If you haven't picked a time yet, book a one-on-one call here: https://calendly.com/wyatt-teroir/30min",
        'If it helps, reply with what you do and where you want AI to help. Calls may be recorded so you get the most out of the call and I can deliver the best result.'],
      newsletter: ["You're on the Teroir newsletter", "You're on the list. I'll send updates as Teroir grows.",
        'Reply to this email any time to unsubscribe or to tell me about your business.'],
    }[interest];
    await send({ from: FROM, to: [email], reply_to: 'wyatt@teroir.com', subject: CONFIRM[0],
      text: ['Thanks for your interest in Teroir.', '', CONFIRM[1], '', CONFIRM[2], '', 'Wyatt Horton', 'Founder, Teroir', 'https://teroir.com'].join('\n') });
  } catch (e) {
    console.error('waitlist confirmation failed', e.message); // the signup itself reached Wyatt
  }
  return reply(200, { ok: true });
};
