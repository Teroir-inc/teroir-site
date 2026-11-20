// teroir.com/founding: the Founding Client Setup list. Served through /api/waitlist?list=founding (the Hobby plan
// allows 12 functions and all 12 are used, so this rides on the waitlist function).
//   POST                 join: { name, company, email, doors, ref, src, t, website } -> { ok, place, invite, me, total }
//   GET  ?me=<token>     the person's own place and invite count (token from their email or the join reply)
//   GET  ?confirm=<tok>  the link in the confirmation email: confirms the address, credits their inviter, then
//                        sends them to /founding?me=…&confirmed=1
const G = require('./_guides');
const Q = require('./_queue');

const DOORS_MAX = 100000;
const inviteUrl = (origin, code) => `${origin}/founding?r=${code}`;
const meToken = code => G.sign('fq-me', code, 3650);
const readTok = (t, kind) => { const v = G.verify(t); return v && v.d === kind && Date.now() <= v.x && Q.okCode(v.e) ? v.e : null; };

// The confirmation email: plain text from Wyatt, like the other teroir.com confirmations.
function joinEmail({ name, place, confirm, invite, status }) {
  return {
    subject: `You're number ${place} on the Houkee founding list`,
    text: [`Hi ${name || 'there'},`, '',
      `Thanks for joining the founding list for Houkee. You're number ${place} right now.`, '',
      'Please confirm your email:', confirm, '',
      'Your invite link:', invite, '',
      `Each operator who joins with your link and confirms their email moves you up ${Q.INVITE_STEP} places.`, '',
      'See your place any time:', status, '',
      'We offer the 3 founding spots in list order to operators who are a fit (co-living or shared housing, 25+ rooms), then bring on the rest in order.', "I'll email you when your turn comes up.", '',
      'Reply to this email to tell me about your houses, or to leave the list.', '',
      'Wyatt Horton', 'Founder, Teroir', 'https://teroir.com'].join('\n'),
  };
}
function movedEmail({ name, place, status }) {
  return {
    subject: `You moved up to number ${place} on the Houkee founding list`,
    text: [`Hi ${name || 'there'},`, '',
      `An operator you invited just confirmed their email, so you moved up ${Q.INVITE_STEP} places. You're number ${place} now.`, '',
      'See your place any time:', status, '',
      'Wyatt Horton', 'Founder, Teroir'].join('\n'),
  };
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const origin = G.originOf(req);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET' && q.confirm) {
    const code = readTok(q.confirm, 'fq-ok');
    const go = to => { res.setHeader('Location', to); return res.status(303).end(); };
    if (!code) return go('/founding?bad=1');
    try {
      const c = await Q.foundingConfirm(code);
      if (c.credited && c.inviter?.email && c.inviter.place) {
        const status = `${origin}/founding?me=${meToken(c.inviter.code)}`;
        await G.send({ from: G.FROM, to: [c.inviter.email], reply_to: 'wyatt@teroir.com', ...movedEmail({ ...c.inviter, status }) }, `fq-moved-${code}`)
          .catch(e => console.error('founding moved email failed', e.message));
      }
    } catch (e) { console.error('founding confirm failed', e.message); return go('/founding?error=1'); }
    return go(`/founding?me=${meToken(code)}&confirmed=1`);
  }

  if (req.method === 'GET' && q.me) {
    const code = readTok(q.me, 'fq-me');
    if (!code) return res.status(404).json({ ok: false, error: 'link' });
    try {
      const s = await Q.foundingStatus(code);
      if (!s) return res.status(404).json({ ok: false, error: 'link' });
      return res.status(200).json({ ok: true, place: s.place, total: s.total, invites: s.invites, confirmed: s.confirmed, invite: inviteUrl(origin, code), step: Q.INVITE_STEP });
    } catch (e) { console.error('founding status failed', e.message); return res.status(503).json({ ok: false, error: 'store' }); }
  }

  if (req.method === 'GET') {
    // the page asks for the total; it only comes back once it is big enough to mean something
    try { const t = await Q.foundingTotal(); return res.status(200).json({ ok: true, total: t >= Q.SHOW_TOTAL_FROM ? t : null }); }
    catch { return res.status(200).json({ ok: true, total: null }); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method' }); }

  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    const to = body.me ? `/founding?me=${body.me}&joined=1#you` : body.error === 'already' ? '/founding?already=1#you' : null;
    if (to) { res.setHeader('Location', to); return res.status(303).end(); }
    return res.status(status).send('Something went wrong. Please email wyatt@teroir.com.');
  };
  const t = Number(b.t);
  if (G.clean(b.website, 200) || (t && Date.now() - t < 2500)) return reply(200, { ok: true, bot: true }); // bots: quiet success, nothing stored

  const email = G.clean(b.email, 200).toLowerCase();
  if (!G.EMAIL_RE.test(email) || !Q.norm(email)) return reply(400, { ok: false, error: 'email' });
  if (Q.isDisposable(email)) return reply(400, { ok: false, error: 'disposable' });
  const name = G.clean(b.name, 120), company = G.clean(b.company, 160);
  const doors = Math.floor(Number(String(b.doors || '').replace(/[,\s]/g, '')));
  if (!name) return reply(400, { ok: false, error: 'name' });
  if (!company) return reply(400, { ok: false, error: 'company' });
  if (!Number.isFinite(doors) || doors < 1 || doors > DOORS_MAX) return reply(400, { ok: false, error: 'doors' });
  const ref = G.clean(b.ref, 20).toLowerCase();
  const src = G.clean(b.src, 60).replace(/[^\w.\-]/g, '');

  let j;
  try { j = await Q.foundingJoin({ name, company, email, doors, ref, net: Q.netOf(req), src }); }
  catch (e) {
    if (e.code === 'limit') return reply(429, { ok: false, error: 'limit' });
    console.error('founding join failed', e.message); return reply(503, { ok: false, error: 'store' });
  }
  const status = `${origin}/founding?me=${meToken(j.code)}`;
  const mail = joinEmail({ name, place: j.place, confirm: `${origin}/api/waitlist?list=founding&confirm=${G.sign('fq-ok', j.code, 30)}`, invite: inviteUrl(origin, j.code), status });

  if (j.dup) {
    // already on the list: the links go to the inbox only, so nobody can read someone else's place by typing their email
    await G.send({ from: G.FROM, to: [email], reply_to: 'wyatt@teroir.com', ...mail, subject: 'Your place on the Houkee founding list' },
      `fq-again-${j.code}-${new Date().toISOString().slice(0, 13)}`).catch(e => console.error('founding resend failed', e.message)); // at most one an hour
    return reply(409, { ok: false, error: 'already' });
  }
  try { await G.send({ from: G.FROM, to: [email], reply_to: 'wyatt@teroir.com', ...mail }, `fq-join-${j.code}`); }
  catch (e) { console.error('founding email failed', e.message); } // they are on the list; the page shows their links
  if (!Q.PV) await G.notify(`Founding list #${j.place}: ${company} · ${doors} doors`, [`Name: ${name}`, `Company: ${company}`, `Email: ${email}`, `Doors: ${doors}`,
    `Place: ${j.place}`, `Invited by: ${ref && Q.okCode(ref) ? ref : '(nobody)'}`, `Came from: ${src || '(direct)'}`, `When: ${new Date().toISOString()}`])
    .catch(e => console.error('founding notify failed', e.message));
  const total = await Q.foundingTotal().catch(() => 0);
  return reply(200, { ok: true, place: j.place, invite: inviteUrl(origin, j.code), me: meToken(j.code), total: total >= Q.SHOW_TOTAL_FROM ? total : null, step: Q.INVITE_STEP });
};
module.exports.joinEmail = joinEmail;
module.exports.movedEmail = movedEmail;
