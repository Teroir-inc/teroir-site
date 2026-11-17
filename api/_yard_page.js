// The two pages for teroir.com/yard: the passcode screen and the phone app. Served only by api/yard.js.
const HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Yard Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Inter:wght@400;500;600&display=swap">
<style>
:root{--bg:#f3f5ef;--surface:#fff;--fg:#18231a;--muted:#5a6a5c;--line:#dde3d6;--leaf:#2f7d4f;--leaf-fg:#fff;--chip:#eaf1e6;--warn:#b3261e;
--display:"Bricolage Grotesque",system-ui,sans-serif;--body:"Inter",system-ui,-apple-system,sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111712;--surface:#192119;--fg:#e6eee4;--muted:#9db09e;--line:#2a352b;--leaf:#73c793;--leaf-fg:#0d1a11;--chip:#202b21;--warn:#ff8a80;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#111712;--surface:#192119;--fg:#e6eee4;--muted:#9db09e;--line:#2a352b;--leaf:#73c793;--leaf-fg:#0d1a11;--chip:#202b21;--warn:#ff8a80;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 var(--body);padding:16px max(16px,env(safe-area-inset-right)) 64px max(16px,env(safe-area-inset-left))}
.wrap{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
h1{font:700 30px/1.05 var(--display);margin:0}
h2{font:600 12px/1 var(--body);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.sub{color:var(--muted);margin:4px 0 0;font-size:14px}
.row{display:flex;gap:8px;flex-wrap:wrap}.grow{flex:1 1 180px;min-width:0}
input[type=text],input[type=password],textarea{width:100%;font:16px var(--body);color:var(--fg);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:11px 12px}
textarea{min-height:76px;resize:vertical}
:focus-visible{outline:2px solid var(--leaf);outline-offset:2px}
.group{display:flex;flex-direction:column;gap:6px}.glabel{font-size:12px;color:var(--muted);font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);background:var(--chip);color:var(--fg);font:500 14px var(--body);padding:8px 12px;border-radius:99px;cursor:pointer}
.chip[aria-pressed=true]{background:var(--leaf);color:var(--leaf-fg);border-color:var(--leaf)}
.btn{font:600 15px var(--body);background:var(--leaf);color:var(--leaf-fg);border:0;border-radius:10px;padding:12px 16px;cursor:pointer;text-decoration:none;text-align:center}
.btn.ghost{background:transparent;color:var(--leaf);border:1px solid var(--line)}
.btn:disabled{opacity:.5;cursor:default}.big{width:100%;font-size:17px;padding:15px}
label.photo{display:flex;align-items:center;justify-content:center;border:2px dashed var(--line);border-radius:12px;padding:18px;cursor:pointer;color:var(--muted);font-weight:600;text-align:center}
label.photo input{position:absolute;opacity:0;width:1px;height:1px}
.preview{border-radius:12px;width:100%;max-height:360px;object-fit:cover;display:block;margin-top:8px}
.status{font-size:14px;color:var(--muted);min-height:20px}.err,.card .wait.err{color:var(--warn)}
.cards{display:flex;flex-direction:column;gap:14px}
.card{background:var(--surface);border:2px solid var(--line);border-radius:14px;overflow:hidden}
.card[aria-current=true]{border-color:var(--leaf)}
.card img{display:block;width:100%;height:auto;-webkit-touch-callout:default}
.card .wait{aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;padding:16px;text-align:center}
.cbar{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;flex-wrap:wrap}
.cbar b{font:700 17px var(--display)}
.small{font-size:13px;color:var(--muted)}
.log{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.log div{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:14px}
</style></head><body><div class="wrap">`;
const FOOT = '</div></body></html>';

const login = () => `${HEAD}
<header><h1>Yard Studio</h1><p class="sub">Enter the team passcode.</p></header>
<form id="f" class="row"><input id="p" class="grow" type="password" autocomplete="current-password" placeholder="Passcode" required>
<button class="btn" type="submit">Open</button></form><div id="s" class="status" role="status"></div>
<script>
document.getElementById('f').onsubmit = async e => {
  e.preventDefault(); const s = document.getElementById('s'); s.textContent = 'Checking…'; s.className = 'status';
  try {
    const r = await fetch('/api/yard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'login', passcode: document.getElementById('p').value }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return location.reload();
    s.textContent = j.error || 'That did not work. Try again.'; s.className = 'status err';
  } catch { s.textContent = 'No connection. Try again.'; s.className = 'status err'; }
};
</script>${FOOT}`;

const app = groups => `${HEAD}
<header><h1>Yard Studio</h1><p class="sub">Tap what they tell you, snap the yard, and show three designs of their own backyard.</p></header>
<section><h2>Visit</h2><div class="row">
<input id="cust" class="grow" type="text" placeholder="Homeowner name" autocomplete="off">
<input id="addr" class="grow" type="text" placeholder="Address" autocomplete="off"></div>
<p class="small">Name and address stay on this phone. They aren't sent or saved anywhere.</p></section>
<section><h2>What they said</h2><div id="groups" style="display:flex;flex-direction:column;gap:12px"></div>
<textarea id="notes" style="margin-top:12px" maxlength="400" placeholder="Their words: “we never use the yard in summer, it's too hot”, “dog digs everything”…"></textarea></section>
<section><h2>The yard</h2>
<label class="photo"><input id="photo" type="file" accept="image/*" capture="environment"><span id="photoText">📷 Take a photo of the backyard</span></label>
<img id="prev" class="preview" alt="Backyard photo" hidden></section>
<section><button id="go" class="btn big" type="button">Design it</button><div id="status" class="status" role="status" style="margin-top:8px"></div></section>
<section id="results" hidden><h2 id="rtitle">Designs</h2><div id="cards" class="cards"></div>
<div style="margin-top:16px"><h2>Change it</h2><div id="log" class="log"></div>
<form id="tf" class="row"><input id="tweak" class="grow" type="text" maxlength="300" placeholder="“add a pergola”, “smaller lawn”">
<button id="tweakGo" class="btn" type="submit">Update</button></form>
<p class="small">Changes the design with the green border. Tap a design to pick it. To keep one, press and hold the picture, then Save.</p></div></section>
<script>
const GROUPS = ${JSON.stringify(groups.map(([k, label, m]) => [label, Object.keys(m)]))};
const $ = id => document.getElementById(id);
const st = { picked: new Set(), photo: null, cards: [], sel: 0, busy: 0 };
for (const [label, words] of GROUPS) {
  const g = document.createElement('div'); g.className = 'group';
  const l = document.createElement('div'); l.className = 'glabel'; l.textContent = label;
  const c = document.createElement('div'); c.className = 'chips';
  for (const w of words) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = w; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { st.picked.has(w) ? st.picked.delete(w) : st.picked.add(w); b.setAttribute('aria-pressed', st.picked.has(w)); };
    c.appendChild(b);
  }
  g.append(l, c); $('groups').appendChild(g);
}
// Any image (photo file or a returned design) → 1024px JPEG data URL, to keep uploads small.
async function jpeg(src) {
  const img = src instanceof Blob ? await createImageBitmap(src) : await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const w = img.width, h = img.height, s = Math.min(1, 1024 / Math.max(w, h));
  const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.85);
}
$('photo').onchange = async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  try { st.photo = await jpeg(f); $('prev').src = st.photo; $('prev').hidden = false; $('photoText').textContent = '📷 Retake photo'; setStatus(''); }
  catch { setStatus("That photo couldn't be read. Try another one.", true); }
};
function setStatus(t, err) { $('status').textContent = t; $('status').className = 'status' + (err ? ' err' : ''); }
function busy(d) { st.busy += d; $('go').disabled = $('tweakGo').disabled = st.busy > 0; }
async function call(body) {
  const r = await fetch('/api/yard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.image) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}
function el(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function render() {
  const box = $('cards'); box.textContent = '';
  st.cards.forEach((c, i) => {
    const card = el('div', 'card'); card.setAttribute('aria-current', i === st.sel); card.onclick = () => { st.sel = i; render(); };
    if (c.img) { const im = el('img'); im.src = c.img; im.alt = c.look + ' design'; card.appendChild(im); }
    else card.appendChild(el('div', 'wait' + (c.err ? ' err' : ''), c.err || 'Designing ' + c.look + '… (about 15–30 seconds)'));
    const bar = el('div', 'cbar'); bar.appendChild(el('b', null, c.look));
    const row = el('div', 'row');
    if (c.prev.length) { const u = el('button', 'btn ghost', 'Undo'); u.type = 'button'; u.onclick = ev => { ev.stopPropagation(); c.img = c.prev.pop(); c.err = ''; render(); }; row.appendChild(u); }
    if (c.img) { const s = el('a', 'btn ghost', 'Save'); s.href = c.img; s.download = (($('cust').value.trim() || 'yard') + ' ' + c.look).replace(/[^a-z0-9 -]/gi, '').trim() + '.png'; s.onclick = ev => ev.stopPropagation(); row.appendChild(s); }
    bar.appendChild(row); card.appendChild(bar); box.appendChild(card);
  });
}
$('go').onclick = async () => {
  if (!st.photo) return setStatus('Take a photo of the backyard first.', true);
  setStatus(''); $('results').hidden = false; $('log').textContent = '';
  const name = $('cust').value.trim(); $('rtitle').textContent = name ? 'Designs for ' + name : 'Designs';
  const picked = [...st.picked], notes = $('notes').value.trim();
  const order = picked.filter(w => GROUPS[1][1].includes(w));
  const looks = [...new Set([...order, 'Modern', 'California native', 'Cozy cottage', 'Mediterranean'])].slice(0, 3);
  st.cards = looks.map(look => ({ look, img: '', err: '', prev: [] })); st.sel = 0; render();
  $('results').scrollIntoView({ behavior: 'smooth' });
  await Promise.all(st.cards.map(async (c, i) => {
    busy(1);
    try { const j = await call({ op: 'design', style: i, picked, notes, image: st.photo }); c.img = j.image; if (j.look) c.look = j.look; }
    catch (e) { c.err = e.message; }
    finally { busy(-1); render(); }
  }));
};
$('tf').onsubmit = async e => {
  e.preventDefault(); const t = $('tweak').value.trim(); const c = st.cards[st.sel];
  if (!t || !c) return; if (!c.img) { c.err = 'Pick a design that has a picture first.'; return render(); }
  busy(1); const line = el('div', null, c.look + ': ' + t + ' …'); $('log').appendChild(line); $('tweak').value = '';
  try { const j = await call({ op: 'edit', instruction: t, image: await jpeg(c.img) }); c.prev.push(c.img); c.img = j.image; c.err = ''; line.textContent = c.look + ': ' + t + ' ✓'; }
  catch (err) { line.textContent = c.look + ': ' + t + ' — ' + err.message; line.className = 'err'; }
  finally { busy(-1); render(); }
};
</script>${FOOT}`;

module.exports = { login, app };
