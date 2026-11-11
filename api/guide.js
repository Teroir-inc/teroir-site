// teroir.com/api/guide?t=<signed token>: serves one guide PDF to the email it was sent to, until the link expires.
const fs = require('fs');
const path = require('path');
const G = require('./_guides');

const page = (res, status, msg) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex');
  return res.status(status).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teroir guide</title>` +
    `<body style="font:17px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#17130f;background:#F6F4EE">` +
    `<p>${msg}</p><p><a href="/free">Back to the guides</a> · <a href="mailto:wyatt@teroir.com">wyatt@teroir.com</a></p></body>`);
};

module.exports = async (req, res) => {
  let tok;
  try { tok = G.verify(req.query?.t); } catch (e) { console.error('guide', e.message); return page(res, 500, 'Downloads are not available right now. Please email wyatt@teroir.com.'); }
  if (!tok || !G.BY_ID[tok.d]) return page(res, 404, 'This download link is not valid. Check that you copied the whole link from your email.');
  if (Date.now() > tok.x) return page(res, 410, 'This download link has expired. Reply to the email it came in and Wyatt will send you a fresh one.');
  try {
    const pdf = G.decrypt(fs.readFileSync(path.join(__dirname, '..', 'guides', `${tok.d}.pdf.enc`)));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Teroir - ${G.BY_ID[tok.d].title.replace(/[^\w ,.'-]/g, '')}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    return res.status(200).send(pdf);
  } catch (e) {
    console.error('guide read failed', tok.d, e.message);
    return page(res, 500, 'That guide could not be opened. Please email wyatt@teroir.com and Wyatt will send it directly.');
  }
};
