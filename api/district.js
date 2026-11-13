// wyattworldwide.com/d/<district>: GET /api/district?d=<id>&k=<pass token>.
// Without a valid pass it returns only what the locked panel shows (name, price). With one, the lessons and signed
// download links for that email. Tokens are the same HMAC links as guide downloads; nothing is stored.
const G = require('./_guides');
const D = require('./_districts');
const L = require('./_lessons.json');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method' }); }
  const d = D.BY_DISTRICT[G.clean(req.query?.d, 40)];
  if (!d || d.status === 'link') return res.status(404).json({ ok: false, error: 'district' });
  const pub = { id: d.id, name: d.name, status: d.status, kind: d.kind, line: d.line, price: d.price };
  const keys = String(req.query?.k || '').split(',').map(k => G.clean(k, 600)).filter(Boolean).slice(0, 6);
  let pass = null;
  for (const k of keys) {
    const t = G.verify(k);
    if (t && /^district:/.test(t.d) && t.x > Date.now() && G.EMAIL_RE.test(t.e) && D.opens(t.d.slice(9), d.id)) { pass = t; break; }
  }
  if (!pass || d.status !== 'open') return res.status(200).json({ ok: true, open: false, district: pub });
  const email = pass.e;
  const guides = (d.guides === 'all' ? G.GUIDES.map(g => g.id) : d.guides).map(id => G.BY_ID[id]).filter(Boolean).map(g => ({ id: g.id, title: g.title, url: G.linkFor(g.id, email, 30) }));
  const reads = (L[d.id] || []).map(({ slug, title, description }) => ({ slug, title, description }));
  return res.status(200).json({ ok: true, open: true, district: pub, email, guides, lessons: d.lessons, reads });
};
