// Buyer- and claimer-facing emails for wyattworldwide.com: one branded HTML layout plus a matching plain-text part.
// Look v5 (Wyatt 11-20): pale sunset page, a cream panel with a thick ink edge, ink text, coral primary button.
// HTML: 600px table layout, inline CSS, light only, explicit bgcolor on every cell. No emblem image (no W emblem). Links are buttons only; no raw token URL is ever printed in the HTML.
// Text: each link alone on its own line under a short label, so a long signed URL never shares a line with words.
const WW = 'https://www.wyattworldwide.com';
// contrast: ink on cream 14.6:1, muted on cream 6.9:1, ink on coral 6.8:1, link plum on cream 7.9:1
const C = { page: '#FFE9DF', panel: '#FFF3E3', ink: '#2B1E3F', muted: '#5A4A75', coral: '#FF8A7A', band: '#FF9EC7', link: '#5B2E8C' };
const FONT_BODY = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_HEAD = "'Bricolage Grotesque', Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = FONT_BODY;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A bulletproof button: the colored cell is the button, the link fills it (48px tall), Outlook gets the same box.
function button({ label, url, primary }) {
  const bg = primary ? C.coral : C.panel;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;"><tr>
<td align="center" bgcolor="${bg}" style="background-color:${bg};border:3px solid ${C.ink};border-radius:12px;">
<a href="${esc(url)}" target="_blank" style="display:block;padding:13px 16px;line-height:22px;font-family:${FONT_BODY};font-size:16px;font-weight:700;color:${C.ink};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

// { preheader, kicker, heading, intro:[para], buttons:[{label,url,note?,primary?}], notes:[para], signoff:[line] }
// footer (marketing only): { unsub, postal } adds an unsubscribe link and the postal address under the card.
function renderEmail({ preheader = '', kicker = '// wyattworldwide', heading, intro = [], buttons = [], notes = [], signoff = [], footer = null }) {
  const p = t => `<p style="margin:0 0 16px 0;font-family:${FONT_BODY};font-size:16px;line-height:1.55;color:${C.ink};">${esc(t)}</p>`;
  const small = t => `<p style="margin:0 0 12px 0;font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${C.muted};">${esc(t)}</p>`;
  const btns = buttons.map(b => (b.note ? `<p style="margin:8px 0 8px 0;font-family:${FONT_MONO};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};">${esc(b.note)}</p>` : '') + button(b)).join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
<style>:root{color-scheme:light only;supported-color-schemes:light}body{margin:0;padding:0;background:${C.page}}a{color:${C.link}}@media (max-width:620px){.wrap{width:100%!important}.pad{padding:24px 20px!important}}</style>
</head>
<body bgcolor="${C.page}" style="margin:0;padding:0;background-color:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background-color:${C.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td bgcolor="${C.page}" style="padding:0 0 14px 4px;background-color:${C.page};">
<a href="${WW}/" target="_blank" style="text-decoration:none;font-family:${FONT_HEAD};font-size:22px;font-weight:800;letter-spacing:-.01em;color:${C.ink};">WYATTWORLDWIDE</a>
</td></tr>
<tr><td class="pad" bgcolor="${C.panel}" style="padding:0;background-color:${C.panel};border:3px solid ${C.ink};border-radius:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="10" bgcolor="${C.band}" style="height:10px;line-height:10px;font-size:0;background-color:${C.band};background-image:linear-gradient(90deg,#8E7CC3,#FF9EC7,#FF8A7A,#FFC8A2);border-radius:13px 13px 0 0;">&nbsp;</td></tr>
<tr><td class="pad" style="padding:28px 28px 24px 28px;">
<p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};">${esc(kicker)}</p>
<h1 style="margin:0 0 20px 0;font-family:${FONT_HEAD};font-size:30px;line-height:1.1;font-weight:800;letter-spacing:-.01em;color:${C.ink};">${esc(heading)}</h1>
${intro.map(p).join('\n')}
${btns}
<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
${notes.map(small).join('\n')}
${signoff.length ? `<p style="margin:16px 0 0 0;font-family:${FONT_BODY};font-size:16px;line-height:1.5;color:${C.ink};">${signoff.map(esc).join('<br>')}</p>` : ''}
</td></tr></table>
</td></tr>
<tr><td bgcolor="${C.page}" style="padding:16px 4px;background-color:${C.page};font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:${C.muted};">
<a href="${WW}/" target="_blank" style="color:${C.link};font-weight:700;text-decoration:none;">wyattworldwide.com</a> &middot; reply to this email to reach Wyatt
${footer ? `<br>Wyatt Horton &middot; ${esc(footer.postal)}<br><a href="${esc(footer.unsub)}" target="_blank" style="color:${C.link};font-weight:700;">Unsubscribe</a> from these emails` : ''}
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = [heading, '', ...intro.flatMap(t => [t, '']),
    ...buttons.flatMap(b => [...(b.note ? [`${b.note}.`] : []), `${b.label}:`, b.url, '']),
    ...notes.flatMap(t => [t, '']), ...signoff,
    ...(footer ? ['', '--', `Wyatt Horton · ${footer.postal}`, 'Unsubscribe:', footer.unsub] : [])].join('\n');
  return { html, text };
}

module.exports = { renderEmail, WW };
