const { createHmac, timingSafeEqual } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const COOKIE = 'sable_brainstorm';
const MAX_AGE = 60 * 60 * 24 * 3;
const PAGE = require('./brainstorm-page');
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 12;

function secret() {
  const end = Date.parse(process.env.BRAINSTORM_EXPIRES_AT || '');
  if (!process.env.BRAINSTORM_PIN || !process.env.BRAINSTORM_SECRET || !Number.isFinite(end)) {
    throw new Error('Missing PIN gate configuration or expiry');
  }
  return process.env.BRAINSTORM_SECRET;
}
function expired(now = Date.now()) {
  return now >= Date.parse(process.env.BRAINSTORM_EXPIRES_AT);
}
function isRateLimited(ip, now = Date.now()) {
  const record = attempts.get(ip);
  if (!record || now - record.start >= WINDOW_MS) { attempts.set(ip, { start: now, count: 0 }); return false; }
  return record.count >= MAX_ATTEMPTS;
}
function recordFailure(ip, now = Date.now()) {
  const record = attempts.get(ip);
  if (!record || now - record.start >= WINDOW_MS) attempts.set(ip, { start: now, count: 1 });
  else record.count += 1;
}
function signature(payload, key) {
  return createHmac('sha256', key).update(payload).digest('base64url');
}
function validSession(value, key, now = Date.now()) {
  if (!value) return false;
  const [expires, supplied, extra] = value.split('.');
  if (extra || !/^\d+$/.test(expires) || Number(expires) < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(signature(expires, key));
  const actual = Buffer.from(supplied || '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function cookie(req) {
  const header = req.headers.cookie || '';
  const item = header.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!item) return '';
  try { return decodeURIComponent(item.slice(COOKIE.length + 1)); } catch { return ''; }
}
function gate(error = '') {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Private concept session</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at 70% 10%,#183340,transparent 45%),#080d16;color:#e9f4f1;font:16px/1.5 system-ui,sans-serif}.box{width:min(420px,100%);padding:34px;border:1px solid #263c51;border-radius:18px;background:#101a28}small{color:#69efd5;letter-spacing:.18em}h1{line-height:1.1}p{color:#98adbc}input{width:100%;padding:13px;background:#080d16;color:white;border:1px solid #38516b;border-radius:8px;font:inherit;letter-spacing:.2em}button{margin-top:14px;padding:11px 20px;border:0;border-radius:24px;background:#69efd5;color:#08131a;font:inherit;font-weight:700;cursor:pointer}.err{color:#ffad7c;min-height:24px}</style><main class="box"><small>SABLE / PRIVATE SESSION</small><h1>A concept worth exploring.</h1><p>Enter the short-term access PIN to open the private product brainstorm.</p><form method="post" action="/brainstorm"><input name="pin" type="password" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" minlength="6" maxlength="8" placeholder="6–8 digit PIN" required aria-label="Access PIN"><p class="err">${error}</p><button type="submit">Enter session →</button></form><p>This link is temporary. Please don’t forward it.</p></main></html>`;
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}
function serveAsset(req, res) {
  const asset = new URL(req.url || '/brainstorm', 'https://teroir.com').searchParams.get('asset');
  if (!asset) return false;
  if (!/^(renders|drawings)\/[a-z0-9-]+\.(jpg|svg|pdf)$/i.test(asset)) {
    send(res, 404, 'Asset not found.');
    return true;
  }
  const ext = asset.split('.').pop().toLowerCase();
  const types = { jpg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf' };
  let bytes;
  try { bytes = readFileSync(join(__dirname, 'brainstorm-assets', asset)); }
  catch { send(res, 404, 'Asset not found.'); return true; }
  send(res, 200, bytes, {
    'Content-Type': types[ext],
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; sandbox",
  });
  return true;
}
module.exports = function handler(req, res) {
  let key;
  try { key = secret(); } catch { return send(res, 503, 'Temporary demo is not configured.'); }
  if (expired()) return send(res, 410, 'This short-term concept demo has expired.');
  if (req.method === 'GET' && validSession(cookie(req), key)) {
    if (serveAsset(req, res)) return;
    return send(res, 200, PAGE, { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" });
  }
  if (req.method === 'GET') return send(res, 200, gate());
  if (req.method !== 'POST') return send(res, 405, 'Method not allowed.', { Allow: 'GET, POST' });
  const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) return send(res, 429, gate('Too many attempts. Wait 15 minutes and try again.'), { 'Retry-After': '900' });
  function complete(pin) {
    const expected = Buffer.from(process.env.BRAINSTORM_PIN);
    const actual = Buffer.from(pin || '');
    const match = actual.length === expected.length && timingSafeEqual(actual, expected);
    if (!match) { recordFailure(ip); return send(res, 401, gate('That PIN didn’t work. Try again.')); }
    attempts.delete(ip);
    const endSeconds = Math.floor(Date.parse(process.env.BRAINSTORM_EXPIRES_AT) / 1000);
    const expires = Math.min(Math.floor(Date.now() / 1000) + MAX_AGE, endSeconds);
    const value = `${expires}.${signature(String(expires), key)}`;
    const maxAge = expires - Math.floor(Date.now() / 1000);
    res.writeHead(303, { Location: '/brainstorm', 'Cache-Control': 'no-store', 'Set-Cookie': `${COOKIE}=${encodeURIComponent(value)}; Path=/brainstorm; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`, 'Referrer-Policy': 'no-referrer' });
    res.end();
  }
  if (req.body && typeof req.body === 'object') return complete(req.body.pin || '');
  if (typeof req.body === 'string') return complete(new URLSearchParams(req.body).get('pin') || '');
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 2048) req.destroy(); });
  req.on('end', () => complete(new URLSearchParams(body).get('pin') || ''));
};
module.exports.validSession = validSession;
module.exports.PAGE = PAGE;
module.exports.expired = expired;
module.exports.isRateLimited = isRateLimited;
