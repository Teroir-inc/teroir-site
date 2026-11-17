// teroir.com/yard (rewritten here by vercel.json). GET: the passcode page or the app. POST: login, design, edit.
const Y = require('./_yard');
const P = require('./_yard_page');

const MSG = {
  day: "Today's image limit is reached. It resets at midnight UTC, which is late afternoon in the US.",
  month: "This month's image limit is reached. Ask Tyler to raise it.",
  session: 'This phone has made its 15 images for this session. A session lasts 12 hours.',
  no_counter: "Image limits aren't set up yet, so designing is off. Tell Tyler.",
  no_key: "The image service isn't connected yet. Tell Tyler.",
  no_image: "The design didn't come back for that one. Try again, or change the wording.",
  gemini: 'The image service is busy. Wait a minute and try again.',
};
const JPEG = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

function html(res, code, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.status(code).send(body);
}
const json = (res, code, body) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex'); return res.status(code).json(body); };

module.exports = async (req, res) => {
  if (req.method === 'GET') return html(res, 200, Y.session(req) ? P.app(Y.GROUPS) : P.login());
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  try {
    if (b.op === 'login') {
      if (!process.env.YARD_PASSCODE) return json(res, 503, { error: "Yard Studio isn't switched on yet." });
      if (await Y.loginLocked()) return json(res, 429, { error: 'Too many wrong passcodes. Try again next hour.' });
      if (!Y.passOk(b.passcode)) { await Y.loginFailed(); return json(res, 401, { error: "That passcode isn't right." }); }
      res.setHeader('Set-Cookie', Y.cookie(Y.newSession()));
      return json(res, 200, { ok: true });
    }
    const sid = Y.session(req);
    if (!sid) return json(res, 401, { error: 'Signed out. Reload the page and enter the passcode.', code: 'signed_out' });
    if (b.op !== 'design' && b.op !== 'edit') return json(res, 400, { error: 'Unknown request.' });
    const m = JPEG.exec(String(b.image || ''));
    if (!m || m[1].length > 3_000_000) return json(res, 400, { error: 'Take the photo again.' });
    const style = Number(b.style);
    if (b.op === 'design' && ![0, 1, 2].includes(style)) return json(res, 400, { error: 'Unknown design.' });
    if (b.op === 'edit' && !String(b.instruction || '').trim()) return json(res, 400, { error: 'Type what to change.' });
    const prompt = b.op === 'design' ? Y.designPrompt(b.picked, b.notes, style) : Y.editPrompt(b.instruction);

    if (!Y.kv()) return json(res, 503, { error: MSG.no_counter, code: 'no_counter' });
    if (!process.env.GEMINI_API_KEY) return json(res, 503, { error: MSG.no_key, code: 'no_key' });
    const r = await Y.reserve(sid);
    if (r.hit) { console.log(`yard limit ${r.hit}`); return json(res, 429, { error: MSG[r.hit], code: `limit_${r.hit}` }); }
    try {
      const out = await Y.gemini(prompt, m[1]);
      console.log(`yard image ${b.op} ok, today ${r.day}/${Y.CAP.day}`); // counts only: never the prompt, photo or notes
      return json(res, 200, { image: out.dataUrl, look: b.op === 'design' ? Y.looks(b.picked)[style] : undefined });
    } catch (e) {
      await Y.release(sid);
      throw e;
    }
  } catch (e) {
    console.error('yard failed', e.code || '', e.message);
    const code = MSG[e.code] ? e.code : 'gemini';
    return json(res, code === 'no_counter' || code === 'no_key' ? 503 : 502, { error: MSG[code], code });
  }
};
