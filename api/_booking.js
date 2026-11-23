// teroir.com/api/booking: call bookings from Wyatt's Cal.com page ("Wyatt calls you at this number").
// Rides on the stripe-webhook function (Hobby allows 12 functions; vercel.json rewrites /api/booking here) because both
// need the raw body for the signature check.
//   POST  Cal.com webhook (BOOKING_CREATED / BOOKING_RESCHEDULED / BOOKING_CANCELLED). Trust: a valid
//         x-cal-signature-256 (hex HMAC-SHA256 of the raw body with CAL_WEBHOOK_SECRET). Anything else: 401, nothing stored.
//   GET   ?since=<ISO>  ops' desk sync (Bearer BOOKING_READ_SECRET): bookings changed AT or after then, oldest first.
//         Inclusive on purpose: a row on a page edge comes back twice rather than never (ops dedupes on uid + updated_at).
// Each booking is the lead's own written request for a call; Cal.com keeps the full record (what they typed, and when).
// Cal.com sends each webhook once and does not retry on an error reply (independent review of #89, from its source), so a
// store failure here sends Wyatt an alert (no personal data) to check his Cal.com bookings list by hand.
// Kept KEEP_DAYS, then dropped (the full record stays in Cal.com).
// This store keeps only what ops' desk needs to match the lead: no phone number and no name are stored or returned
// (ops rule 11-23). Nothing is logged except event names.
const crypto = require('crypto');
const Q = require('./_queue');

const PV = process.env.VERCEL_ENV === 'preview' ? 'pv:' : '';
const B = `${PV}bk`;
const KINDS = { BOOKING_CREATED: 'booked', BOOKING_RESCHEDULED: 'rescheduled', BOOKING_CANCELLED: 'cancelled' };
const MAX_LIST = 200;
const KEEP_DAYS = 400;
const G = require('./_guides');

const raw = req => new Promise((ok, fail) => {
  const parts = [];
  req.on('data', c => parts.push(c));
  req.on('end', () => ok(Buffer.concat(parts)));
  req.on('error', fail);
});
const sha = v => crypto.createHash('sha256').update(String(v)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b)); // equal-length digests: no length leak

function verified(sig, body, secret) {
  if (!secret || !/^[0-9a-f]{64}$/i.test(String(sig || ''))) return false;
  return same(String(sig).toLowerCase(), crypto.createHmac('sha256', secret).update(body).digest('hex'));
}

const str = (v, n) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
// a booking answer: Cal.com sends responses as { field: value } or { field: { value } }
const answer = (r, ...keys) => {
  for (const k of keys) {
    const v = r && r[k];
    const x = v && typeof v === 'object' && !Array.isArray(v) ? v.value : v;
    if (x != null && String(x).trim()) return typeof x === 'object' ? '' : str(x, 120);
  }
  return '';
};

const emailOf = v => { const e = str(v, 200).toLowerCase(); return /@sms\.cal\.com$/.test(e) || !e.includes('@') ? '' : e; };
const refOf = v => { const x = v && typeof v === 'object' && !Array.isArray(v) ? v.value : v; return typeof x === 'string' && x.length <= 200 ? x : ''; };

// The fields ops needs, from one webhook body. created_at is when the lead asked: the webhook's createdAt on
// BOOKING_CREATED (kept from the first event if a later one arrives).
function record(ev) {
  const p = ev.payload || {};
  const a = (p.attendees || [])[0] || {};
  const r = p.responses || {};
  return {
    uid: str(p.uid, 80),
    from_uid: str(p.rescheduleUid || '', 80),
    status: KINDS[ev.triggerEvent],
    // a phone-only booking gets a made-up <digits>@sms.cal.com address: that is the phone number, so it is never kept
    email: emailOf(a.email || answer(r, 'email')),
    start: str(p.startTime, 40),
    tz: str(a.timeZone, 60),
    ref: refOf(r.ref), // exactly as given (UTM never reaches Cal.com webhooks, so the lead id rides on this hidden question)
    event_at: str(ev.createdAt, 40) || new Date().toISOString(),
  };
}

async function store(rec) {
  const key = `${B}:b:${rec.uid}`;
  const now = Date.now(), iso = new Date(now).toISOString(), ttl = KEEP_DAYS * 86400;
  // a reschedule carries the original request time over from the booking it replaces (when that one was stored)
  const [old] = rec.from_uid ? await Q.pipe([['HGET', `${B}:b:${rec.from_uid}`, 'created_at']]) : [null];
  const created = rec.status === 'booked' ? rec.event_at : rec.status === 'rescheduled' ? (old || rec.event_at) : '';
  const cmds = [];
  if (created) cmds.push(['HSETNX', key, 'created_at', created]);
  cmds.push(['HSET', key, 'uid', rec.uid, 'status', rec.status, 'email', rec.email, 'start', rec.start, 'tz', rec.tz, 'ref', rec.ref,
    'from_uid', rec.from_uid, 'updated_at', iso], ['EXPIRE', key, ttl], ['ZADD', `${B}:t`, now, rec.uid],
    ['ZREMRANGEBYSCORE', `${B}:t`, '-inf', now - ttl * 1000]);
  if (rec.status === 'rescheduled' && old != null) cmds.push(['HSET', `${B}:b:${rec.from_uid}`, 'status', 'rescheduled_away', 'updated_at', iso], ['ZADD', `${B}:t`, now, rec.from_uid]);
  await Q.pipe(cmds);
}

async function since(t) {
  const uids = await Q.pipe([['ZRANGEBYSCORE', `${B}:t`, t, '+inf', 'LIMIT', 0, MAX_LIST + 1]]).then(x => x[0] || []);
  if (!uids.length) return [];
  const rows = await Q.pipe(uids.map(u => ['HGETALL', `${B}:b:${u}`]));
  return rows.map(x => { const o = {}; const a = x || []; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; }).filter(o => o.uid);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const want = process.env.BOOKING_READ_SECRET;
    if (!want || !same(req.headers.authorization || '', `Bearer ${want}`)) return res.status(401).json({ ok: false });
    const t = Date.parse(String((req.query || {}).since || '1970-01-01T00:00:00Z'));
    if (!Number.isFinite(t)) return res.status(400).json({ ok: false, error: 'since' });
    try { const list = await since(t); return res.status(200).json({ ok: true, bookings: list.slice(0, MAX_LIST), more: list.length > MAX_LIST }); }
    catch (e) { console.error('booking read failed', e.code || 'error'); return res.status(503).json({ ok: false, error: 'store' }); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }

  const body = await raw(req);
  if (!verified(req.headers['x-cal-signature-256'], body, process.env.CAL_WEBHOOK_SECRET)) return res.status(401).json({ ok: false });
  let ev; try { ev = JSON.parse(body.toString('utf8')); } catch { return res.status(400).json({ ok: false, error: 'json' }); }
  if (!ev || typeof ev.triggerEvent !== 'string') return res.status(400).json({ ok: false, error: 'shape' }); // e.g. a custom payload template: loud, not ignored
  if (ev.triggerEvent === 'PING') return res.status(200).json({ ok: true, ping: true });
  if (!KINDS[ev.triggerEvent]) return res.status(200).json({ ok: true, ignored: true });
  const rec = record(ev);
  if (!rec.uid) return res.status(400).json({ ok: false, error: 'uid' });
  try { await store(rec); } catch (e) {
    console.error('booking store failed', e.code || 'error');
    await G.notify('Booking feed: a Cal.com booking was not saved', ['A booking webhook could not be stored (Cal.com does not resend it).', 'Check the Cal.com bookings list and tell ops which lead booked.', `When: ${new Date().toISOString()}`]).catch(() => {});
    return res.status(503).json({ ok: false, error: 'store' });
  }
  console.log(`booking ${rec.status}`); // the event name only
  return res.status(200).json({ ok: true });
};
module.exports.verified = verified;
module.exports.record = record;
