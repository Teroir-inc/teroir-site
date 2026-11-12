// Shared helpers for teroir.com/free: the guide catalog, signed download links, Stripe and Resend calls.
// Files starting with "_" in api/ are not routes on Vercel.
const crypto = require('crypto');

// The order here is the order on the page. `file` is guides/<id>.pdf.enc (AES-256-GCM, key from GUIDE_KEY).
const GUIDES = [
  { id: 'repeat-task', title: 'Hand AI your most repeated task' },
  { id: 'run-while-out', title: "Keep your business running while you're out" },
  { id: 'get-paid', title: 'Get paid for AI: build and sell one small automation' },
  { id: 'claude-artifacts', title: 'Make Claude build it: a field guide to artifacts' },
];
const PRICE_EACH = 1900, PRICE_BUNDLE = 3900; // cents, USD
const BY_ID = Object.fromEntries(GUIDES.map(g => [g.id, g]));

const NOTIFY_TO = ['wyatt@teroir.com'];
const NOTIFY_CC = ['wyatthorton.pm@gmail.com'];
const FROM = 'Wyatt Horton <wyatt@teroir.com>';
const EMAIL_RE = /^[^\s@<>"]{1,100}@[^\s@<>"]{1,100}\.[^\s@<>"]{2,24}$/;
const DAY = 86400e3;

const clean = (v, n) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, '').trim().slice(0, n);
const b64u = buf => Buffer.from(buf).toString('base64url');

function keys() {
  const k = process.env.GUIDE_KEY;
  if (!k || k.length < 32) throw new Error('GUIDE_KEY missing');
  const h = s => crypto.createHash('sha256').update(s + '|' + k).digest();
  return { enc: h('enc'), sig: h('sig') };
}

// A download link token: which guide, for which email, until when. Signed, not encrypted.
function sign(d, e, days) {
  const body = b64u(JSON.stringify({ d, e, x: Date.now() + days * DAY }));
  return body + '.' + b64u(crypto.createHmac('sha256', keys().sig).update(body).digest());
}
function verify(t) {
  const [body, mac] = String(t || '').split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', keys().sig).update(body).digest();
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url')); } catch { return null; }
}

// guides/<id>.pdf.enc layout: 12-byte IV, 16-byte GCM tag, then ciphertext.
function decrypt(buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', keys().enc, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}
function encrypt(buf) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keys().enc, iv);
  const out = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), out]);
}

// Stripe's API takes form encoding with bracketed keys: a[b][0][c]=v
function form(obj, pre = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(method, path, params) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY missing');
  const q = params ? form(params).toString() : '';
  const r = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && q ? '?' + q : ''}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : q,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`stripe ${r.status}: ${j.error?.message || ''}`.slice(0, 200));
  return j;
}

async function send(payload) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const notify = (subject, lines) => send({ from: 'Teroir Guides <waitlist@teroir.com>', to: NOTIFY_TO, cc: NOTIFY_CC, subject, text: lines.join('\n') })
  .catch(e => console.error('guides notify failed', e.message));

const linkFor = (id, email, days) => `https://teroir.com/api/guide?t=${sign(id, email, days)}`;

module.exports = { FROM, GUIDES, BY_ID, PRICE_EACH, PRICE_BUNDLE, EMAIL_RE, clean, sign, verify, encrypt, decrypt, stripe, send, notify, linkFor };
