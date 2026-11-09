const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const handler = require('./brainstorm');
const key = 'test-secret-long-random';
process.env.BRAINSTORM_PIN = '482916';
process.env.BRAINSTORM_SECRET = key;
process.env.BRAINSTORM_EXPIRES_AT = new Date(Date.now()+86400000).toISOString();
function call(method, headers = {}, body = '', url = '/brainstorm') {
  const result = { headers: null, status: null, body: null, writeHead(status, headers) { this.status = status; this.headers = headers; }, end(text) { this.body = text; } };
  const req = { method, headers, url, on(event, cb) { if (event === 'data' && body) cb(Buffer.from(body)); if (event === 'end') cb(); } };
  handler(req, result);
  return result;
}
assert.equal(call('GET').status, 200);
assert.equal(handler.expired(), false);
assert.match(call('GET').body, /Enter session/);
assert.equal(call('POST', {}, 'pin=000000').status, 401);
const ok = call('POST', {}, 'pin=482916');
assert.equal(ok.status, 303);
assert.match(ok.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
const value = decodeURIComponent(ok.headers['Set-Cookie'].split(';')[0].split('=')[1]);
const page = call('GET', { cookie: `sable_brainstorm=${value}` });
assert.equal(page.status, 200);
assert.match(page.body, /Open the real drawings/);
assert.match(page.headers['X-Robots-Tag'], /noindex/);
assert.match(call('GET', {}, '', '/brainstorm?asset=drawings/core-exploded.svg').body, /Enter session/);
const drawing = call('GET', { cookie: `sable_brainstorm=${value}` }, '', '/brainstorm?asset=drawings/core-exploded.svg');
assert.equal(drawing.status, 200);
assert.equal(drawing.headers['Content-Type'], 'image/svg+xml');
assert.match(drawing.body.toString(), /<svg/);
assert.equal(call('GET', { cookie: `sable_brainstorm=${value}` }, '', '/brainstorm?asset=drawings/..%2Fbrainstorm.js').status, 404);
const expired = `${Math.floor(Date.now()/1000)-10}.${createHmac('sha256',key).update(String(Math.floor(Date.now()/1000)-10)).digest('base64url')}`;
assert.match(call('GET',{cookie:`sable_brainstorm=${expired}`}).body,/Enter session/);
assert.equal(handler.isRateLimited('test-ip'), false);
for(let i=0;i<12;i++) handler.isRateLimited('limit-ip');
for(let i=0;i<12;i++) { const before=handler.isRateLimited('fail-ip'); if(!before) { const r=call('POST',{'x-forwarded-for':'fail-ip'},'pin=000000'); assert.equal(r.status,401); } }
assert.equal(handler.isRateLimited('fail-ip'), true);
process.env.BRAINSTORM_EXPIRES_AT=new Date(Date.now()-1000).toISOString();assert.equal(handler.expired(),true);assert.equal(call('GET').status,410);
console.log('PIN gate checks passed: locked, reject, unlock, signed cookie, expiry, noindex, per-process throttling.');
