// wyattworldwide.com/api/unsub?t=<signed token>: unsubscribe from the marketing emails (not receipts or deliveries).
// GET shows a confirm button (link scanners in mail filters follow GETs, so a GET alone never unsubscribes).
// POST does it: mail apps' one-click (RFC 8058, body List-Unsubscribe=One-Click) and the confirm button both POST.
// The opt-out is stored on every Stripe customer with that email (metadata unsub, unsub_at, unsub_how).
const G = require('./_guides');
const M = require('./_marketing');

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light"><title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Inter:wght@400;700&display=swap">
<style>body{margin:0;background:#FBF8F2 url(/ww/scene/dunes.svg) center/max(100%,1200px) auto no-repeat;color:#2B1E3F;font:17px/1.55 Inter,system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh}
main{max-width:30rem;margin:16px;padding:22px 18px;background:rgba(255,245,232,.88);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);border:3px solid #2B1E3F;border-radius:18px;box-shadow:5px 5px 0 #2B1E3F}h1{margin:0 0 10px;font:800 1.8rem/1.05 "Bricolage Grotesque",Inter,system-ui,sans-serif;letter-spacing:-.02em}p{color:#5A4A75}
button{min-height:52px;padding:0 20px;background:#FF8A7A;color:#2B1E3F;border:3px solid #2B1E3F;border-radius:14px;box-shadow:3px 3px 0 #2B1E3F;font:700 1rem Inter,system-ui,sans-serif;cursor:pointer}
a{color:#5B2E8C;font-weight:700}</style></head><body><main>${body}</main></body></html>`;

module.exports = async (req, res) => {
  const t = G.clean(req.query?.t, 600);
  const v = G.verify(t);
  const ok = v && v.d === 'unsub' && v.x > Date.now() && G.EMAIL_RE.test(v.e);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!ok) return res.status(400).send(page('Link not valid', '<h1>That link is not valid.</h1><p>Reply to any of our emails and we will take you off the list by hand.</p>'));
  if (req.method === 'GET') {
    return res.status(200).send(page('Unsubscribe', `<h1>Unsubscribe?</h1><p>You will stop getting the guide tips and offers. Receipts and the guides you bought still work.</p>
<form method="post" action="/api/unsub?t=${encodeURIComponent(t)}"><button type="submit">Unsubscribe</button></form>`));
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  const oneClick = /List-Unsubscribe=One-Click/.test(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  const meta = { unsub: 'true', unsub_at: new Date().toISOString(), unsub_how: 'link' };
  try {
    const found = await M.customersOf(v.e);
    for (const c of found) if (c.metadata?.unsub !== 'true') await G.stripe('POST', `customers/${c.id}`, { metadata: meta });
    if (!found.length) await G.stripe('POST', 'customers', { email: v.e, description: 'Unsubscribed (wyattworldwide.com)', metadata: { brand: G.BRAND, ...meta } });
  } catch (e) {
    console.error('unsub failed', e.message); // loud: the person asked to stop and we could not record it
    await G.notify('UNSUBSCRIBE FAILED', [`Could not record an unsubscribe: ${e.message}`, `Email: ${v.e}`, 'Take them off by hand (Stripe customer metadata unsub=true).']);
    return res.status(502).send(page('Try again', '<h1>Something went wrong.</h1><p>Please reply to any of our emails and we will take you off the list by hand.</p>'));
  }
  if (oneClick) return res.status(200).send('ok');
  return res.status(200).send(page('Unsubscribed', '<h1>You are unsubscribed.</h1><p>No more tips or offers. Your guides and passes still work.</p><p><a href="/">wyattworldwide.com</a></p>'));
};
