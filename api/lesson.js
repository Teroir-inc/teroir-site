// wyattworldwide.com lesson text: GET /api/lesson?d=<district>&s=<slug>&k=<pass tokens>. Lessons are stored encrypted
// (lessons/<district>/<slug>.html.enc, rendered and escaped at build time); only a pass that opens the district reads one.
const fs = require('fs');
const path = require('path');
const G = require('./_guides');
const D = require('./_districts');
const L = require('./_lessons.json');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method' }); }
  const d = D.BY_DISTRICT[G.clean(req.query?.d, 40)];
  const lesson = d && (L[d.id] || []).find(l => l.slug === G.clean(req.query?.s, 80));
  if (!lesson) return res.status(404).json({ ok: false, error: 'lesson' });
  const keys = String(req.query?.k || '').split(',').map(k => G.clean(k, 600)).filter(Boolean).slice(0, 6);
  const pass = d.status === 'open' && keys.map(k => G.verify(k)).find(t => t && /^district:/.test(t.d) && t.x > Date.now() && D.opens(t.d.slice(9), d.id));
  if (!pass) return res.status(403).json({ ok: false, error: 'pass' });
  try {
    const html = G.decrypt(fs.readFileSync(path.join(__dirname, '..', 'lessons', d.id, `${lesson.slug}.html.enc`))).toString('utf8');
    return res.status(200).json({ ok: true, title: lesson.title, html });
  } catch (e) {
    console.error('lesson read failed', d.id, lesson.slug, e.message);
    return res.status(500).json({ ok: false, error: 'read' });
  }
};
