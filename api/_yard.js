// Yard Studio (teroir.com/yard): backyard redesign images for door-to-door landscaping visits.
// Nothing about the homeowner is stored here: the photo and the instruction pass through to Gemini and the image comes
// back as a data URL. Name and address never leave the phone. The only server-side state is image counters.
const crypto = require('crypto');
const G = require('./_guides');

const CAP = { day: 20, month: 115, session: 15 }; // sized to Gemini prepaid credit ($5 on 11-19, ~4c an image); raise when more is added
const MODELS = () => [process.env.YARD_MODEL || 'gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];
// Keep every existing structure as it is (orchestrator-81 11-23): a sales tool that swaps someone's fence or redraws their
// house misrepresents their yard. Only the landscaping asked for may differ.
const KEEP = 'Keep everything that already exists exactly as it is in the photo: the house and any other buildings (walls, roof, siding, colors, windows, doors), '
  + 'the fence (same material, color, height and position; a chain-link fence stays chain-link), existing trees, existing paving, steps and walls, '
  + 'the neighbors\' houses, the yard size and the camera angle. Do not replace, restyle or remove any of them, and do not add fences or walls that were not asked for. Only the changes asked for may differ.';
const ENDING = `${KEEP} Photorealistic, late-afternoon light, eye level, no people, no text.`;

// The chip lists (from the owner's prototype) and what each one asks the image model for.
const GROUPS = [
  ['use', "How they'll use it", {
    'Entertaining': 'a patio with outdoor dining for a group', 'Kids play': 'a safe open lawn for kids to play',
    'Dogs': 'dog-friendly durable surfaces and a tough lawn area', 'Pool or hot tub': 'a hot tub (or a pool if the yard is large enough)',
    'Outdoor kitchen': 'an outdoor kitchen with a built-in grill and counter', 'Veggie garden': 'raised vegetable beds',
    'Quiet retreat': 'a quiet seating nook surrounded by planting', 'Fire pit nights': 'a fire pit with seating around it' }],
  ['look', 'The look', {
    'Modern': 'modern', 'Cozy cottage': 'cozy cottage-garden', 'Mediterranean': 'Mediterranean', 'Desert': 'desert',
    'California native': 'California native', 'Tropical': 'tropical', 'Zen': 'Japanese Zen', 'Farmhouse': 'farmhouse' }],
  ['problems', 'Problems to solve', {
    'Low maintenance': 'low-maintenance planting', 'Water-wise': 'water-wise, drought-tolerant plants and drip irrigation',
    'Privacy': 'tall screening plants or a privacy screen along the fence', 'Shade': 'a shade structure such as a pergola or shade sail',
    'Night lighting': 'warm landscape and path lighting', 'Mud or drainage': 'good drainage with gravel and dry-creek details',
    'Bare dirt (new build)': 'a complete new landscape over the bare dirt', 'Too hot in summer': 'shade trees and a cool shaded seating area' }],
  ['budget', 'Budget feel', {
    'Starter': 'a simple, affordable starter design', 'Mid-range': 'a mid-range design with quality materials',
    'Dream yard': 'a premium dream-yard design with high-end materials' }],
];
const PHRASE = Object.fromEntries(GROUPS.map(([k, , m]) => [k, m]));
const DEFAULT_LOOKS = ['Modern', 'California native', 'Cozy cottage', 'Mediterranean'];

const pickIn = (picked, group) => (Array.isArray(picked) ? picked : []).filter(w => typeof w === 'string' && PHRASE[group][w]);
// The three looks to show: the ones they picked first, then defaults.
function looks(picked) {
  const mine = pickIn(picked, 'look');
  return [...new Set([...mine, ...DEFAULT_LOOKS])].slice(0, 3);
}
const tidy = (s, n) => String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function designPrompt(picked, notes, style) {
  const look = looks(picked)[style];
  const want = [...pickIn(picked, 'use'), ...pickIn(picked, 'problems')].map(w => PHRASE.use[w] || PHRASE.problems[w]);
  const budget = pickIn(picked, 'budget').map(w => PHRASE.budget[w])[0];
  const n = tidy(notes, 400);
  return [
    `Edit this photo. Change only the yard itself (the ground, lawn, planting beds and new garden features) into a ${PHRASE.look[look]} style backyard;`
      + ' everything above and behind the yard stays exactly as photographed.',
    want.length ? `Add only these: ${want.join('; ')}.` : 'Do not add structures such as kitchens, pools or pergolas.',
    budget ? `Make it ${budget}.` : '',
    n ? `The homeowner said: "${n.replace(/"/g, "'")}".` : '',
    ENDING,
  ].filter(Boolean).join(' ');
}
const editPrompt = instruction => `Edit this backyard design: ${tidy(instruction, 300).replace(/"/g, "'")}. If the change adds something of the same kind as a feature already in the design (for example a fire pit where there is a fire table, a new seating set where there is one, a new path where there is one), replace the existing one with it rather than adding a second. Keep everything else in the design the same. ${ENDING}`;

// ---- passcode gate: a signed cookie that dies when YARD_PASSCODE changes
const phash = () => crypto.createHash('sha256').update('yard|' + (process.env.YARD_PASSCODE || '')).digest('hex').slice(0, 16);
function passOk(given) {
  const want = String(process.env.YARD_PASSCODE || '');
  if (!want) return false;
  const a = crypto.createHash('sha256').update(String(given || '')).digest(), b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
// The passcode sign-in lasts 12 hours (`until`). Each page open starts a new visit (a new sid, same `until`), and the
// 15-image cap is per visit, so closing and reopening the page starts a new visit; the daily cap still holds.
const newSession = (until = Date.now() + 12 * 3600e3) => G.sign('yard', `${crypto.randomBytes(9).toString('base64url')}.${phash()}`, (until - Date.now()) / 86400e3);
function session(req) {
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)yard_s=([^;]+)/);
  const t = m && G.verify(decodeURIComponent(m[1]));
  if (!t || t.d !== 'yard' || !(t.x > Date.now()) || !process.env.YARD_PASSCODE) return null;
  const [sid, p] = String(t.e).split('.');
  return p === phash() ? { sid, until: t.x } : null;
}
const cookie = (v, until = Date.now() + 12 * 3600e3) => `yard_s=${encodeURIComponent(v)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, Math.round((until - Date.now()) / 1000))}`;

// ---- counters (Upstash Redis REST; Vercel's Upstash integration sets KV_REST_API_*). No counter, no images.
function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
async function pipeline(cmds) {
  const k = kv(); if (!k) throw Object.assign(new Error('counter not configured'), { code: 'no_counter' });
  const r = await fetch(`${k.url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${k.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw Object.assign(new Error(`counter HTTP ${r.status}`), { code: 'no_counter' });
  const out = await r.json();
  const bad = out.find(x => x.error); if (bad) throw Object.assign(new Error(`counter: ${bad.error}`), { code: 'no_counter' });
  return out.map(x => x.result);
}
const keys = (sid, now = new Date()) => {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now); // YYYY-MM-DD, Pacific: resets at local midnight
  return { day: `yard:d:${d}`, month: `yard:m:${d.slice(0, 7)}`, session: `yard:s:${sid}` };
};
// Takes one image off every cap, or none: returns null if it fits, else which cap was hit.
async function reserve(sid) {
  const k = keys(sid);
  const [d, , m, , s] = await pipeline([['INCR', k.day], ['EXPIRE', k.day, 2 * 86400], ['INCR', k.month], ['EXPIRE', k.month, 40 * 86400], ['INCR', k.session], ['EXPIRE', k.session, 13 * 3600]]);
  const hit = d > CAP.day ? 'day' : m > CAP.month ? 'month' : s > CAP.session ? 'session' : null;
  if (hit) await pipeline([['DECR', k.day], ['DECR', k.month], ['DECR', k.session]]);
  return { hit, day: d };
}
// A failed generation is not billed, so it gives the image back.
const release = sid => { const k = keys(sid); return pipeline([['DECR', k.day], ['DECR', k.month], ['DECR', k.session]]).catch(() => {}); };
// Login attempts: 20 wrong passcodes an hour, across everyone, locks login for the rest of the hour.
async function loginLocked() {
  const h = `yard:login:${new Date().toISOString().slice(0, 13)}`;
  const [n] = await pipeline([['GET', h]]);
  return Number(n || 0) >= 20;
}
const loginFailed = () => { const h = `yard:login:${new Date().toISOString().slice(0, 13)}`; return pipeline([['INCR', h], ['EXPIRE', h, 7200]]); };

// ---- Gemini image edit
async function gemini(prompt, jpegB64) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY missing'), { code: 'no_key' });
  let last;
  for (const model of MODELS()) {
    for (const size of [true, false]) {
      const body = {
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: jpegB64 } }, { text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], ...(size ? { imageConfig: { imageSize: '1K' } } : {}) },
      };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const parts = j.candidates?.[0]?.content?.parts || [];
        const img = parts.map(p => p.inlineData || p.inline_data).find(p => p && p.data);
        if (img) return { model, dataUrl: `data:${img.mimeType || img.mime_type || 'image/png'};base64,${img.data}` };
        last = Object.assign(new Error(`${model}: no image (${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || 'empty'})`), { code: 'no_image' });
        break; // the model answered without an image: a retry without the size option won't change that
      }
      last = Object.assign(new Error(`${model} HTTP ${r.status}: ${String(j.error?.message || '').slice(0, 160)}`), { code: 'gemini', status: r.status });
      if (r.status === 400 && size && /image_?size|imageConfig/i.test(j.error?.message || '')) continue; // retry without the size option
      // bad key (401/403) or no API credit (402): the fallback won't help, and it isn't "busy". Show "not switched on".
      if (r.status === 401 || r.status === 402 || r.status === 403) { last.code = 'no_key'; throw last; }
      break; // 404 (no such model), 429, 5xx: try the fallback model
    }
  }
  throw last;
}

module.exports = { CAP, GROUPS, ENDING, looks, designPrompt, editPrompt, passOk, newSession, session, cookie, reserve, release, loginLocked, loginFailed, gemini, kv };
