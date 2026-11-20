// Invite lists in Upstash Redis (the KV_REST_API_* vars the Yard uses). Two separate lists, nothing shared between them:
//  - fq: teroir.com/founding, the Founding Client Setup queue. A real place in line; each invited operator who confirms
//        their email moves the inviter up INVITE_STEP places.
//  - wr: wyattworldwide.com/free share links. A count of friends who claimed a guide (and opened it) with your link;
//        3 unlocks a bonus guide, 10 an invite to the monthly live session. Rewards are digital only.
// Every number shown comes from these keys; nothing is seeded or rounded up.
// Preview deployments share the production store, so their keys get a pv: prefix and never touch the real lists.
// Abuse rules (both lists): one entry per mailbox (gmail dots and +tags folded), disposable domains never count,
// an invitee on the inviter's own company domain or from the inviter's own network (IP hash) never counts, and at
// most DAILY_CREDITS credits per inviter per day.
const crypto = require('crypto');

const INVITE_STEP = 3;          // places an inviter moves up per confirmed invitee
const SHOW_TOTAL_FROM = 10;     // the founding page shows "N operators on the list" only from this many real entries
const DAILY_CREDITS = 10;       // per inviter per day, either list
const JOINS_PER_IP_DAY = 5;     // founding signups from one network per day
const REWARDS = [{ at: 3, id: 'bonus' }, { at: 10, id: 'live' }];

// ---- Upstash REST
function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
async function pipe(cmds) {
  const k = kv(); if (!k) throw Object.assign(new Error('list store not configured'), { code: 'no_store' });
  const r = await fetch(`${k.url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${k.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw Object.assign(new Error(`list store HTTP ${r.status}`), { code: 'no_store' });
  const out = await r.json();
  const bad = out.find(x => x.error); if (bad) throw Object.assign(new Error(`list store: ${bad.error}`), { code: 'no_store' });
  return out.map(x => x.result);
}
const one = async cmd => (await pipe([cmd]))[0];
const hash = arr => { const o = {}; for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1]; return o; };

// ---- email and network checks
const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'zoho.com', 'yandex.com', 'mail.com', 'att.net',
  'comcast.net', 'verizon.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net', 'charter.net', 'ymail.com', 'rocketmail.com', 'fastmail.com', 'hey.com']);
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', 'grr.la',
  '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'temp-mail.io', 'tempr.email',
  'yopmail.com', 'yopmail.net', 'trashmail.com', 'trashmail.de', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc',
  'throwawaymail.com', 'fakeinbox.com', 'mailnesia.com', 'mintemail.com', 'emailondeck.com', 'moakt.com', 'burnermail.io', 'mohmal.com',
  'mailcatch.com', 'spamgourmet.com', 'mytemp.email', 'tmail.ws', 'tmpmail.org', 'tmpmail.net', 'emailfake.com', 'fakemail.net',
  'inboxkitten.com', 'mailpoof.com', 'discard.email', 'spambox.us', 'trbvm.com', 'mail.tm', 'dropmail.me', '1secmail.com', '1secmail.net',
  'mailsac.com', 'harakirimail.com', 'luxusmail.org', 'tempail.com', 'byom.de', 'mailforspam.com', 'wegwerfmail.de', 'spam4.me', 'anonaddy.me',
  'getairmail.com', 'linshiyouxiang.net', 'minuteinbox.com', 'cs.email', 'fexbox.org', 'emltmp.com', 'tempinbox.com', 'guerrillamailblock.com']);
const domainOf = e => String(e).split('@')[1] || '';
const isDisposable = e => { const d = domainOf(e); return DISPOSABLE.has(d) || [...DISPOSABLE].some(x => d.endsWith('.' + x)); };
// one mailbox, one entry: lower case, +tags dropped, gmail dots dropped
function norm(email) {
  let [u, d] = String(email).trim().toLowerCase().split('@');
  if (!u || !d) return '';
  if (d === 'googlemail.com') d = 'gmail.com';
  u = u.split('+')[0];
  if (d === 'gmail.com') u = u.replace(/\./g, '');
  return `${u}@${d}`;
}
// a short hash of the visitor's network, so two signups from one place can be matched without keeping the IP
function netOf(req, secret = process.env.GUIDE_KEY || '') {
  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
  return ip ? crypto.createHash('sha256').update(`net|${ip}|${secret}`).digest('base64url').slice(0, 16) : '';
}
// why an invitee would not count for an inviter (null: it counts)
function noCredit(inviter, invitee) {
  if (!inviter || !invitee) return 'no inviter';
  if (norm(inviter.email) === norm(invitee.email)) return 'same mailbox';
  if (isDisposable(invitee.email)) return 'disposable email';
  const d = domainOf(norm(invitee.email));
  if (!FREEMAIL.has(d) && d === domainOf(norm(inviter.email))) return 'same company domain';
  if (inviter.net && invitee.net && inviter.net === invitee.net) return 'same network';
  return null;
}
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const newCode = () => Array.from(crypto.randomBytes(8), b => ALPHA[b % ALPHA.length]).join('');
const okCode = c => /^[a-z2-9]{8}$/.test(String(c || ''));
const today = () => new Date().toISOString().slice(0, 10);
async function underDailyCap(p, code) {
  const k = `${p}:cr:${code}:${today()}`;
  const [n] = await pipe([['INCR', k], ['EXPIRE', k, 2 * 86400]]);
  return n <= DAILY_CREDITS;
}

// ---- founding queue (fq)
const PV = process.env.VERCEL_ENV === 'preview' ? 'pv:' : '';
const F = `${PV}fq`;
const fUser = async code => (okCode(code) ? hash(await one(['HGETALL', `${F}:u:${code}`])) : {});

// Adds a person, or finds them. Returns { code, place, dup }.
async function foundingJoin({ name, company, email, doors, ref, net, src }) {
  const n = norm(email);
  const have = await one(['GET', `${F}:e:${n}`]);
  if (have) return { code: have, place: await foundingPlace(have), dup: true };
  if (net) {
    const k = `${F}:ip:${net}:${today()}`;
    const [c] = await pipe([['INCR', k], ['EXPIRE', k, 2 * 86400]]);
    if (c > JOINS_PER_IP_DAY) throw Object.assign(new Error('too many signups from one network today'), { code: 'limit' });
  }
  const code = newCode();
  // SET NX claims the mailbox, so two submits at once can't make two entries
  const got = await one(['SET', `${F}:e:${n}`, code, 'NX']);
  if (!got) { const c = await one(['GET', `${F}:e:${n}`]); return { code: c, place: await foundingPlace(c), dup: true }; }
  const seq = await one(['INCR', `${F}:seq`]);
  const inviter = okCode(ref) && ref !== code && (await one(['EXISTS', `${F}:u:${ref}`])) ? ref : '';
  await pipe([
    ['HSET', `${F}:u:${code}`, 'email', String(email).toLowerCase(), 'name', name, 'company', company, 'doors', String(doors), 'joined', new Date().toISOString(),
      'seq', String(seq), 'net', net || '', 'src', src || '', 'invitedBy', inviter, 'invites', '0'],
    ['ZADD', `${F}:q`, String(seq), code],
  ]);
  return { code, place: await foundingPlace(code), dup: false };
}
async function foundingPlace(code) {
  const r = await one(['ZRANK', `${F}:q`, code]);
  return r === null || r === undefined ? null : r + 1;
}
const foundingTotal = () => one(['ZCARD', `${F}:q`]).then(Number);
// what the person's own status view shows
async function foundingStatus(code) {
  const u = await fUser(code);
  if (!u.email) return null;
  const [place, total] = [await foundingPlace(code), await foundingTotal()];
  return { place, total: total >= SHOW_TOTAL_FROM ? total : null, invites: Number(u.invites || 0), confirmed: !!u.confirmed, name: u.name };
}
// Move a person up `step` places (or to the front). Scores are floats, so the new score sits between two neighbours.
async function moveUp(code, step = INVITE_STEP) {
  const r = await one(['ZRANK', `${F}:q`, code]);
  if (r === null || r === undefined || r === 0) return r === 0 ? 1 : null;
  const target = Math.max(0, r - step);
  let score;
  if (target === 0) {
    const [, s0] = await one(['ZRANGE', `${F}:q`, 0, 0, 'WITHSCORES']);
    score = Number(s0) - 1;
  } else {
    const a = await one(['ZRANGE', `${F}:q`, target - 1, target, 'WITHSCORES']); // [above, sAbove, at, sAt]
    score = (Number(a[1]) + Number(a[3])) / 2;
  }
  await one(['ZADD', `${F}:q`, String(score), code]);
  return foundingPlace(code);
}
// The person clicked the link in their email. Their inviter gets credit once, if the rules allow it.
// Returns { first, credited, why, inviter }.
async function foundingConfirm(code) {
  const u = await fUser(code);
  if (!u.email) return { first: false, credited: false, why: 'unknown' };
  const first = await one(['HSETNX', `${F}:u:${code}`, 'confirmed', new Date().toISOString()]);
  if (!first) return { first: false, credited: false, why: 'already confirmed' };
  if (!u.invitedBy) return { first: true, credited: false, why: 'no inviter' };
  const inv = await fUser(u.invitedBy);
  const why = noCredit(inv, u) || (await underDailyCap(F, u.invitedBy) ? null : 'daily cap');
  if (why) { await one(['HSET', `${F}:u:${code}`, 'noCredit', why]); return { first: true, credited: false, why }; }
  await one(['HINCRBY', `${F}:u:${u.invitedBy}`, 'invites', 1]);
  const place = await moveUp(u.invitedBy);
  return { first: true, credited: true, why: null, inviter: { code: u.invitedBy, email: inv.email, name: inv.name, place } };
}

// ---- wyattworldwide share links (wr)
const W = `${PV}wr`;
const wUser = async code => (okCode(code) ? hash(await one(['HGETALL', `${W}:u:${code}`])) : {});
const wCodeOf = email => one(['GET', `${W}:e:${norm(email)}`]);
// A claimer gets a share code (or keeps theirs). `ref` is the code in the link they came from.
async function shareJoin({ email, ref, net, guide = '' }) {
  const n = norm(email);
  const code = newCode();
  const got = await one(['SET', `${W}:e:${n}`, code, 'NX']);
  if (!got) return { code: await wCodeOf(email), dup: true };
  const inviter = okCode(ref) && (await one(['EXISTS', `${W}:u:${ref}`])) ? ref : '';
  await one(['HSET', `${W}:u:${code}`, 'email', String(email).toLowerCase(), 'joined', new Date().toISOString(), 'net', net || '', 'invitedBy', inviter, 'friends', '0', 'guide', guide]);
  return { code, dup: false };
}
// A claimer opened their free guide: that proves the address is real, so their inviter gets credit (once).
// Returns null, or { inviter, friends, unlocked: [reward ids newly reached] }.
async function shareOpened(email) {
  const code = await wCodeOf(email);
  if (!code) return null;
  const u = await wUser(code);
  if (!u.invitedBy || u.counted || u.noCredit) return null;
  const inv = await wUser(u.invitedBy);
  const why = noCredit(inv, u) || (await underDailyCap(W, u.invitedBy) ? null : 'daily cap');
  if (why) { await one(['HSET', `${W}:u:${code}`, 'noCredit', why]); return null; }
  if (!(await one(['HSETNX', `${W}:u:${code}`, 'counted', new Date().toISOString()]))) return null;
  const friends = await one(['HINCRBY', `${W}:u:${u.invitedBy}`, 'friends', 1]);
  const unlocked = REWARDS.filter(r => r.at === friends).map(r => r.id);
  return { inviter: { code: u.invitedBy, email: inv.email }, friends, unlocked };
}
async function shareStatus(code) {
  const u = await wUser(code);
  if (!u.email) return null;
  const friends = Number(u.friends || 0);
  return { friends, next: REWARDS.find(r => friends < r.at) || null, bonus: friends >= 3 ? (u.bonusGuide || 'open') : 'locked', live: friends >= 10, email: u.email, guide: u.guide || '' };
}
// Marks the bonus guide as taken (once). Returns true if this call took it.
const takeBonus = (code, guideId) => one(['HSETNX', `${W}:u:${code}`, 'bonusGuide', guideId]).then(Boolean);

module.exports = { PV, foundingTotal, INVITE_STEP, SHOW_TOTAL_FROM, REWARDS, kv, pipe, norm, netOf, isDisposable, noCredit, okCode, newCode,
  foundingJoin, foundingPlace, foundingStatus, foundingConfirm, moveUp, shareJoin, shareOpened, shareStatus, takeBonus, wUser, fUser };
