// wyattworldwide.com/free share links: after claiming a guide, a personal link. When 3 friends claim a free guide with
// it (and open it), you unlock a bonus guide; at 10, an invite to the monthly live session. Rewards are digital only.
// Store and abuse rules: api/_queue.js (wr:*). Served through api/claim.js (GET ?me=…, POST { bonus, guide }) and
// counted in api/guide.js when a referred claimer opens their guide. All 12 Hobby-plan functions are in use.
const G = require('./_guides');
const E = require('./_email');
const Q = require('./_queue');

const shareUrl = code => `${E.WW}/free?r=${code}`;
const meToken = code => G.sign('wr-me', code, 3650);
const meUrl = code => `${E.WW}/free?me=${meToken(code)}#share`;
const readMe = t => { const v = G.verify(t); return v && v.d === 'wr-me' && Date.now() <= v.x && Q.okCode(v.e) ? v.e : null; };
// the bonus is one more of the free picks, not the one they already have
const bonusChoices = claimed => G.GUIDES.filter(g => !g.paidOnly && g.id !== claimed).map(g => ({ id: g.id, title: g.title }));

const unlockEmail = (kind, code) => kind === 'bonus' ? E.renderEmail({
  preheader: '3 friends claimed a guide with your link.', kicker: '// bonus unlocked', heading: 'You unlocked a bonus guide',
  intro: ["Hey, it's Wyatt. 3 friends claimed a free guide with your link. Thanks for sharing. Pick your bonus guide here."],
  buttons: [{ label: 'Pick your bonus guide', url: meUrl(code), primary: true }],
  notes: ['At 10 friends, you get an invite to my monthly live session.'], signoff: ['Wyatt', G.SIGNOFF],
}) : E.renderEmail({
  preheader: '10 friends claimed a guide with your link.', kicker: '// live session unlocked', heading: 'You unlocked the live session',
  intro: ["Hey, it's Wyatt. 10 friends claimed a free guide with your link. You're on the invite list for my monthly live session. I'll email you the next date."],
  buttons: [{ label: 'See your link', url: meUrl(code) }],
  notes: ['Reply to this email if you have a question you want me to cover.'], signoff: ['Wyatt', G.SIGNOFF],
});

// guide.js calls this when a guide link is opened. Never throws: the PDF matters more than the count.
async function opened(email) {
  try {
    const r = await Q.shareOpened(email);
    if (!r || !r.unlocked.length) return r;
    for (const kind of r.unlocked) {
      const subject = kind === 'bonus' ? 'You unlocked a bonus guide' : 'You unlocked my monthly live session';
      await G.send({ from: G.FROM, to: [r.inviter.email], reply_to: 'wyatt@teroir.com', subject, ...unlockEmail(kind, r.inviter.code) }, `wr-${kind}-${r.inviter.code}`);
      if (!Q.PV) await G.notify(`Share reward: ${kind} · ${r.inviter.email}`, [`Reward: ${kind === 'bonus' ? 'bonus guide (3 friends)' : 'monthly live session invite (10 friends)'}`,
        `Email: ${r.inviter.email}`, `Friends counted: ${r.friends}`, `When: ${new Date().toISOString()}`], `wr-n-${kind}-${r.inviter.code}`);
    }
    return r;
  } catch (e) { console.error('share count failed', e.message); return null; }
}

// GET /api/claim?me=<token>: the person's own count and link
async function status(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const code = readMe(req.query.me);
  if (!code) return res.status(404).json({ ok: false, error: 'link' });
  try {
    const s = await Q.shareStatus(code);
    if (!s) return res.status(404).json({ ok: false, error: 'link' });
    return res.status(200).json({ ok: true, link: shareUrl(code), friends: s.friends, next: s.next, live: s.live,
      bonus: s.bonus === 'open' ? 'open' : s.bonus === 'locked' ? 'locked' : 'sent', choices: s.bonus === 'open' ? bonusChoices(s.guide) : [] });
  } catch (e) { console.error('share status failed', e.message); return res.status(503).json({ ok: false, error: 'store' }); }
}

// POST /api/claim { bonus: <me token>, guide }: sends the bonus guide once 3 friends count
async function bonus(req, res, b) {
  const code = readMe(b.bonus);
  if (!code) return res.status(404).json({ ok: false, error: 'link' });
  try {
    const s = await Q.shareStatus(code);
    if (!s) return res.status(404).json({ ok: false, error: 'link' });
    if (s.bonus === 'locked') return res.status(403).json({ ok: false, error: 'locked' });
    if (s.bonus !== 'open') return res.status(409).json({ ok: false, error: 'sent' });
    const guide = bonusChoices(s.guide).find(g => g.id === G.clean(b.guide, 40));
    if (!guide) return res.status(400).json({ ok: false, error: 'guide' });
    if (!(await Q.takeBonus(code, guide.id))) return res.status(409).json({ ok: false, error: 'sent' });
    await G.send({ from: G.FROM, to: [s.email], reply_to: 'wyatt@teroir.com', subject: `Your bonus guide: ${guide.title}`, ...E.renderEmail({
      preheader: `Your bonus guide: ${guide.title}`, kicker: '// bonus guide', heading: 'Your bonus guide',
      intro: [`Hey, it's Wyatt. Thanks for sharing. Here's your bonus guide, "${guide.title}".`],
      buttons: [{ label: 'Download the guide', url: G.linkFor(guide.id, s.email, 30), note: guide.title, primary: true }],
      notes: ['The download link works for 30 days.'], signoff: ['Wyatt', G.SIGNOFF],
    }) }, `wr-bonus-send-${code}`).catch(async e => { await Q.pipe([['HDEL', `${Q.PV}wr:u:${code}`, 'bonusGuide']]).catch(() => {}); throw e; }); // not sent: they can pick again
    return res.status(200).json({ ok: true, guide: guide.id });
  } catch (e) { console.error('share bonus failed', e.message); return res.status(502).json({ ok: false, error: 'send' }); }
}

module.exports = { shareUrl, meToken, meUrl, readMe, bonusChoices, unlockEmail, opened, status, bonus };
