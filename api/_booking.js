// teroir.com/api/booking: call bookings from Wyatt's Cal.com page ("Wyatt calls you at this number").
// Rides on the stripe-webhook function (Hobby allows 12 functions; vercel.json rewrites /api/booking here) because both
// need the raw body for the signature check.
//   POST  Cal.com webhook (BOOKING_CREATED / BOOKING_RESCHEDULED / BOOKING_CANCELLED). Trust: a valid
//         x-cal-signature-256 (hex HMAC-SHA256 of the raw body with CAL_WEBHOOK_SECRET). Anything else: 401, nothing stored.
//   GET   ?since=<ISO>  ops' hourly desk sync (Bearer BOOKING_READ_SECRET): bookings changed since then, oldest first.
// Each booking is the lead's own written request for a call; Cal.com keeps the full record (what they typed, and when).
// This store keeps only what ops' desk needs to match the lead: no phone number and no name are stored or returned
// (ops rule 11-23). Nothing is logged except event names.
const crypto = require('crypto');
const Q = require('./_queue');

const PV = process.env.VERCEL_ENV === 'preview' ? 'pv:' : '';
const B = `${PV}bk`;
const KINDS = { BOOKING_CREATED: 'booked', BOOKING_RESCHEDULED: 'rescheduled', BOOKING_CANCELLED: 'cancelled' };
const MAX_LIST = 200;

const raw = req => new Promise((ok, fail) => {
  const parts = [];
  req.on('data', c => parts.push(c));
  req.on('end', () => ok(Buffer.concat(parts)));
  req.on('error', fail);
});
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

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

// The fields ops needs, from one webhook body. created_at is when the lead asked: the webhook's createdAt on
// BOOKING_CREATED (kept from the first event if a later one arrives).
function record(ev) {
  const p = ev.payload || {};
  const a = (p.attendees || [])[0] || {};
  const r = p.responses || {};
  const utm = p.tracking || p.utm || {};
  return {
    uid: str(p.uid, 80),
    from_uid: str(p.rescheduleUid || p.fromReschedule || '', 80),
    status: KINDS[ev.triggerEvent],
    email: str(a.email || answer(r, 'email'), 200).toLowerCase(),
    start: str(p.startTime, 40),
    tz: str(a.timeZone, 60),
    ref: answer(r, 'ref') || str(utm.utm_content || '', 60),
    utm_source: str(utm.utm_source || '', 60),
    event_at: str(ev.createdAt, 40) || new Date().toISOString(),
  };
}

async function store(rec) {
  const key = `${B}:b:${rec.uid}`;
  const now = Date.now();
  const cmds = [
    ['HSETNX', key, 'created_at', rec.status === 'booked' ? rec.event_at : ''],
    ['HSET', key, 'uid', rec.uid, 'status', rec.status, 'email', rec.email, 'start', rec.start,
      'tz', rec.tz, 'ref', rec.ref, 'utm_source', rec.utm_source, 'from_uid', rec.from_uid, 'updated_at', new Date(now).toISOString()],
    ['ZADD', `${B}:t`, now, rec.uid],
  ];
  if (rec.status === 'rescheduled' && rec.from_uid) cmds.push(['HSET', `${B}:b:${rec.from_uid}`, 'status', 'rescheduled_away', 'updated_at', new Date(now).toISOString()], ['ZADD', `${B}:t`, now, rec.from_uid]);
  await Q.pipe(cmds);
}

async function since(t) {
  const uids = await Q.pipe([['ZRANGEBYSCORE', `${B}:t`, `(${t}`, '+inf', 'LIMIT', 0, MAX_LIST]]).then(x => x[0] || []);
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
    try { const list = await since(t); return res.status(200).json({ ok: true, bookings: list, more: list.length >= MAX_LIST }); }
    catch (e) { console.error('booking read failed', e.code || 'error'); return res.status(503).json({ ok: false, error: 'store' }); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }

  const body = await raw(req);
  if (!verified(req.headers['x-cal-signature-256'], body, process.env.CAL_WEBHOOK_SECRET)) return res.status(401).json({ ok: false });
  let ev; try { ev = JSON.parse(body.toString('utf8')); } catch { return res.status(400).json({ ok: false, error: 'json' }); }
  if (ev.triggerEvent === 'PING') return res.status(200).json({ ok: true, ping: true });
  if (!KINDS[ev.triggerEvent]) return res.status(200).json({ ok: true, ignored: true });
  const rec = record(ev);
  if (!rec.uid) return res.status(400).json({ ok: false, error: 'uid' });
  try { await store(rec); } catch (e) { console.error('booking store failed', e.code || 'error'); return res.status(503).json({ ok: false, error: 'store' }); }
  console.log(`booking ${rec.status}`); // the event name only
  return res.status(200).json({ ok: true });
};
module.exports.verified = verified;
module.exports.record = record;
