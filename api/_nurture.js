// The follow-up emails after a free claim (wyattworldwide.com). Wording approved by Wyatt 11-16, tightened by the team.
// Steps, timed from the claim (customer metadata free_at):
//   1  ~20 h  the $29 offer is ending (only while the offer is still open)
//   2   3 d   did the free guide work? → Free Street
//   3   7 d   The Lab
//   4  14 d   talk to Wyatt (teroir.com/talk?for=coaching)
// State lives on the Stripe customer metadata: nurture ('on' | 'done' | 'bought' | 'unsub'), nurture_step (last step
// sent). Only the newest due step is sent, so a late run never sends a burst. Any purchase or an unsubscribe stops it.
const G = require('./_guides');
const E = require('./_email');
const M = require('./_marketing');

const HOUR = 3600e3, DAY = 24 * HOUR;
const STEPS = [
  { n: 1, at: 20 * HOUR, until: 24 * HOUR, kind: 'offer-reminder' },
  { n: 2, at: 3 * DAY, kind: 'nurture-day3' },
  { n: 3, at: 7 * DAY, kind: 'nurture-day7' },
  { n: 4, at: 14 * DAY, kind: 'nurture-day14' },
];

// Each returns { subject, content } for renderEmail. One idea and one button per email, button right after the opener.
function message(n, { email, guide, offerUntil }) {
  const sign = ['Wyatt', G.SIGNOFF];
  if (n === 1) return {
    subject: 'Your $29 offer ends in a few hours',
    content: { preheader: 'Any of the longer guides for $29, for a few more hours.', kicker: 'offer ending', heading: 'Any longer guide, $29',
      intro: ["Hey, it's Wyatt. Your free guide came with an offer: any of the longer guides for $29. It ends in a few hours."],
      // the original offer's expiry, re-signed: this link never extends the 24 hours
      buttons: [{ label: 'Get any guide for $29', url: `${E.WW}/free?offer=${G.sign('offer29', email, Math.max(0, offerUntil - Date.now()) / DAY)}#buy`, primary: true }],
      notes: ["If one of them fits your week, now's the time."],
      signoff: sign } };
  if (n === 2) return {
    subject: `Did you try "${guide}"?`,
    content: { preheader: 'Your next step is on Free Street.', kicker: 'check-in', heading: 'Your next step',
      intro: [`Hey, it's Wyatt. Did you get a chance to try "${guide}"? Free Street has a short start page that tells you what to do next.`],
      buttons: [{ label: 'Open Free Street', url: G.passFor('free-street', email, 365), primary: true }],
      notes: ['Tried it? Reply and tell me what happened. I read every reply.'],
      signoff: sign } };
  if (n === 3) return {
    subject: 'The Lab: 16 AI lessons and 2 deep guides, $97',
    content: { preheader: 'Where the free guide goes deeper.', kicker: 'next district', heading: 'The Lab',
      intro: ["Hey, it's Wyatt. If the free guide was useful, The Lab goes deeper: sixteen AI lessons and two deep guides, Make Claude build it and Build the harness. $97, once."],
      buttons: [{ label: 'See The Lab', url: `${E.WW}/d/the-lab?src=nurture`, primary: true }],
      signoff: sign } };
  return {
    subject: 'Want me to set it up with you?',
    content: { preheader: 'Book a time and we look at your setup together.', kicker: 'vip', heading: 'Set it up together',
      intro: ["Hey, it's Wyatt. Some people would rather set it up with me than read about it. Book a time and we'll look at your setup together."],
      buttons: [{ label: 'Book a time', url: 'https://teroir.com/talk?for=coaching&src=nurture', primary: true }],
      signoff: sign } };
}

// The step to send now for a claim made at `claimed` (ms), given the last step sent, or null.
function dueStep(claimed, last, now = Date.now()) {
  const due = STEPS.filter(s => s.n > last && now >= claimed + s.at && (!s.until || now < claimed + s.until));
  return due.length ? due[due.length - 1] : null;
}

const setMeta = (c, meta) => G.stripe('POST', `customers/${c.id}`, { metadata: meta });

// One pass over the enrolled customers. Returns counts; never personal data.
async function run(now = Date.now()) {
  const counts = { enrolled: 0, sent: 0, dry: 0, skipped: 0, stopped: 0, errors: 0 };
  let after;
  for (;;) {
    const page = await G.stripe('GET', 'customers', { limit: 100, ...(after ? { starting_after: after } : {}) });
    for (const c of page.data) {
      const m = c.metadata || {};
      if (m.nurture !== 'on') continue;
      counts.enrolled++;
      try {
        const email = String(c.email || '').toLowerCase();
        const claimed = Date.parse(m.free_at || '');
        if (!email || !claimed) { counts.skipped++; continue; }
        if (m.unsub === 'true') { await setMeta(c, { nurture: 'unsub' }); counts.stopped++; continue; }
        const paid = (await G.stripe('GET', 'checkout/sessions', { 'customer_details[email]': email, limit: 20 })).data
          .some(s => s.payment_status === 'paid' && s.created * 1000 >= claimed);
        if (paid) { await setMeta(c, { nurture: 'bought' }); counts.stopped++; continue; }
        const last = Number(m.nurture_step || 0);
        const step = dueStep(claimed, last, now);
        if (!step) {
          if (last >= 4 || now >= claimed + STEPS[3].at) { await setMeta(c, { nurture: 'done' }); counts.stopped++; }
          continue;
        }
        const guide = G.BY_ID[m.free_guide]?.title || 'your free guide';
        const { subject, content } = message(step.n, { email, guide, offerUntil: claimed + DAY });
        const r = await M.sendMarketing({ to: email, subject, kind: step.kind, idem: `nurture-${c.id}-${step.n}`, content });
        if (r.dry) { counts.dry++; continue; } // draft mode: state is not advanced, so nothing is skipped when it goes live
        if (r.skipped) { await setMeta(c, { nurture: 'unsub' }); counts.stopped++; continue; }
        await setMeta(c, { nurture_step: String(step.n), nurture_sent_at: new Date(now).toISOString(), ...(step.n === 4 ? { nurture: 'done' } : {}) });
        counts.sent++;
      } catch (e) {
        counts.errors++;
        console.error('nurture failed for', c.id, e.message);
      }
    }
    if (!page.has_more) break;
    after = page.data[page.data.length - 1].id;
  }
  if (counts.errors) await G.notify(`NURTURE ERRORS: ${counts.errors}`, [`Nurture run: ${JSON.stringify(counts)}`, 'See Vercel logs for api/nurture.']);
  return counts;
}

module.exports = { STEPS, message, dueStep, run };
