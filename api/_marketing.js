// Marketing email for wyattworldwide.com (abandoned checkout, offer reminder, nurture). Unlike the receipts and
// delivery emails, these are commercial email, so every one has a one-click unsubscribe, List-Unsubscribe headers and
// a postal address (CAN-SPAM), and nobody who unsubscribed gets one.
// Opt-outs live on the Stripe customer metadata (unsub, unsub_at, unsub_how): no extra database.
const G = require('./_guides');
const E = require('./_email');

// Wording approved by Wyatt 11-16. Sending stays off until go-live: While LIVE is false nothing is sent: each send is logged and
// returned as { dry: true }. Flip to true in the PR that ships the approved wording.
const cfg = { live: true };  // tests may set cfg.live; production changes it only by a reviewed commit
// Postal address for the footer (CAN-SPAM), from the FOOTER_POSTAL env var (set in Vercel by the owner; supplied by ops-61).
// It must never be committed: this repo is deployed as-is. Marketing sends refuse to go without it.
const postal = () => String(process.env.FOOTER_POSTAL || '').trim();

const unsubLink = email => `${E.WW}/api/unsub?t=${G.sign('unsub', String(email).toLowerCase(), 3650)}`;

// Every Stripe customer with this email; an opt-out on any of them counts.
async function customersOf(email) {
  return (await G.stripe('GET', 'customers', { email: String(email).toLowerCase(), limit: 10 })).data;
}
async function suppressed(email) {
  return (await customersOf(email)).some(c => c.metadata?.unsub === 'true');
}

// kind: a short tag for logs ('abandoned', 'offer-reminder', 'nurture-3' …). idem: a stable Resend idempotency key.
async function sendMarketing({ to, subject, kind, idem, content }) {
  const email = String(to).toLowerCase();
  if (!G.EMAIL_RE.test(email)) throw new Error(`marketing ${kind}: bad address`);
  if (await suppressed(email)) return { skipped: 'unsub' };
  if (!postal()) throw new Error(`marketing ${kind}: FOOTER_POSTAL env var missing`);
  const unsub = unsubLink(email);
  const { html, text } = E.renderEmail({ ...content, footer: { unsub, postal: postal() } });
  if (!cfg.live) { console.log(`marketing DRY (draft wording) ${kind} -> ${email.replace(/^(.).*@/, '$1…@')}`); return { dry: true, html, text }; }
  const sent = await G.send({
    from: G.FROM, to: [email], reply_to: 'wyatt@teroir.com', subject, html, text,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  }, idem);
  return { sent: sent?.id || true };
}

// What a checkout session was for, in words, from its metadata.
const D = require('./_districts');
function itemOf(s) {
  const m = s.metadata || {}, d = D.BY_DISTRICT[m.district], ids = String(m.guides || '').split(',').filter(Boolean);
  if (d && d.id === 'rooftop-hq') return 'the all-access pass';
  if (d) return `the ${d.name} pass`.replace('the The ', 'The ');
  if (ids.length === 1 && G.BY_ID[ids[0]]) return `"${G.BY_ID[ids[0]].title}"`;
  return 'the guides';
}

// checkout.session.expired (re-read from Stripe): one "finish your order" email with Stripe's recovery link.
// Only wyattworldwide sessions with a known email; not if that email has paid since; never twice (idempotency key).
async function abandoned(s) {
  const m = s.metadata || {};
  const email = String(m.email || s.customer_email || s.customer_details?.email || '').toLowerCase();
  const url = s.after_expiration?.recovery?.url;
  if (s.status !== 'expired' || m.brand !== G.BRAND) return { skipped: 'not ours' };
  if (!email) return { skipped: 'no email' };
  if (!url) return { skipped: 'no recovery link' };
  const later = (await G.stripe('GET', 'checkout/sessions', { 'customer_details[email]': email, limit: 20 })).data
    .filter(x => x.payment_status === 'paid' && x.created >= s.created);
  if (later.length) return { skipped: 'paid since' };
  const item = itemOf(s);
  return sendMarketing({
    to: email, kind: 'abandoned', idem: `abandon-${s.id}`,
    subject: `Still want ${/^"/.test(item) ? 'the guide' : item}? Your cart is saved`, // a guide title is too long for a subject // approved 11-16 (Wyatt: "emails approved"), tightened by the team
    content: {
      preheader: 'One tap picks up where you left off.', kicker: 'order saved',
      heading: 'Your cart is saved',
      intro: [`Hey, it's Wyatt. You started checking out for ${item} and didn't finish. One tap picks up where you left off.`],
      buttons: [{ label: 'Finish your order', url, primary: true }],
      notes: ['If something got in the way, reply and tell me.'],
      signoff: ['Wyatt', G.SIGNOFF],
    },
  });
}

module.exports = { cfg, postal, unsubLink, customersOf, suppressed, sendMarketing, abandoned, itemOf };
