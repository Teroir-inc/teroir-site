// wyattworldwide.com/api/unsub?t=<signed token>: unsubscribe from the marketing emails (not receipts or deliveries).
// GET shows a confirm button (link scanners in mail filters follow GETs, so a GET alone never unsubscribes).
// POST does it: mail apps' one-click (RFC 8058, body List-Unsubscribe=One-Click) and the confirm button both POST.
// The opt-out is stored on every Stripe customer with that email (metadata unsub, unsub_at, unsub_how).
const G = require('./_guides');
const M = require('./_marketing');

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><title>${title}</title>
<style>body{margin:0;background:#03010D;color:#EAF6FF;font:17px/1.55 Inter,system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh}
main{max-width:30rem;padding:24px 16px}h1{font:700 1.5rem/1.2 "Chakra Petch",Inter,system-ui,sans-serif}p{color:#9DB3CC}
button{min-height:48px;padding:0 20px;background:#FF2BD6;color:#03010D;border:0;border-radius:2px;font:700 1rem Inter,system-ui,sans-serif;cursor:pointer}
a{color:#00E5FF}</style></head><body><main>${body}</main></body></html>`;

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
