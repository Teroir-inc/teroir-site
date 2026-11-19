// Buyer- and claimer-facing emails for wyattworldwide.com: one branded HTML layout plus a matching plain-text part.
// HTML: 600px table layout, inline CSS, dark only (the site is dark only), explicit bgcolor on every cell so mail apps
// in dark mode have nothing to invert. Links are buttons only; no raw token URL is ever printed in the HTML.
// Text: each link alone on its own line under a short label, so a long signed URL never shares a line with words.
const WW = 'https://www.wyattworldwide.com';
const C = { night: '#03010D', panel: '#0B0524', line: '#1B3A52', ink: '#EAF6FF', muted: '#9DB3CC', cyan: '#00E5FF', magenta: '#FF2BD6', gold: '#FFD23F' };
const FONT_BODY = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_HEAD = "'Chakra Petch', Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "'JetBrains Mono', Menlo, Consolas, monospace";

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A bulletproof button: the colored cell is the button, the link fills it (48px tall), Outlook gets the same box.
function button({ label, url, primary }) {
  const bg = primary ? C.magenta : C.night, fg = primary ? C.night : C.cyan, border = primary ? C.magenta : C.cyan;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;"><tr>
<td align="center" bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:2px;">
<a href="${esc(url)}" target="_blank" style="display:block;padding:13px 16px;line-height:22px;font-family:${FONT_HEAD};font-size:16px;font-weight:700;letter-spacing:.02em;color:${fg};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

// { preheader, kicker, heading, intro:[para], buttons:[{label,url,note?,primary?}], notes:[para], signoff:[line] }
// footer (marketing only): { unsub, postal } adds an unsubscribe link and the postal address under the card.
function renderEmail({ preheader = '', kicker = '// wyattworldwide', heading, intro = [], buttons = [], notes = [], signoff = [], footer = null }) {
  const p = t => `<p style="margin:0 0 16px 0;font-family:${FONT_BODY};font-size:16px;line-height:1.55;color:${C.ink};">${esc(t)}</p>`;
  const small = t => `<p style="margin:0 0 12px 0;font-family:${FONT_BODY};font-size:14px;line-height:1.5;color:${C.muted};">${esc(t)}</p>`;
  const btns = buttons.map(b => (b.note ? `<p style="margin:8px 0 8px 0;font-family:${FONT_MONO};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.cyan};">${esc(b.note)}</p>` : '') + button(b)).join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(heading)}</title>
<style>:root{color-scheme:dark;supported-color-schemes:dark}body{margin:0;padding:0;background:${C.night}}a{color:${C.cyan}}@media (max-width:620px){.wrap{width:100%!important}.pad{padding:24px 20px!important}}</style>
</head>
<body bgcolor="${C.night}" style="margin:0;padding:0;background-color:${C.night};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.night};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.night}" style="background-color:${C.night};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td bgcolor="${C.night}" style="padding:0 0 16px 0;background-color:${C.night};">
<a href="${WW}/" target="_blank" style="text-decoration:none;"><img src="${WW}/ww/emblem.png" width="48" height="48" alt="WyattWorldwide" style="display:inline-block;vertical-align:middle;border:0;"><span style="display:inline-block;vertical-align:middle;padding-left:12px;font-family:${FONT_HEAD};font-size:18px;font-weight:700;letter-spacing:.04em;color:${C.ink};">WYATTWORLDWIDE</span></a>
</td></tr>
<tr><td height="2" bgcolor="${C.cyan}" style="height:2px;line-height:2px;font-size:0;background-color:${C.cyan};">&nbsp;</td></tr>
<tr><td class="pad" bgcolor="${C.panel}" style="padding:32px 32px 24px 32px;background-color:${C.panel};border:1px solid ${C.line};border-top:0;">
<p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.cyan};">${esc(kicker)}</p>
<h1 style="margin:0 0 20px 0;font-family:${FONT_HEAD};font-size:26px;line-height:1.2;font-weight:700;color:${C.ink};">${esc(heading)}</h1>
${intro.map(p).join('\n')}
${btns}
<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
${notes.map(small).join('\n')}
${signoff.length ? `<p style="margin:16px 0 0 0;font-family:${FONT_BODY};font-size:16px;line-height:1.5;color:${C.ink};">${signoff.map(esc).join('<br>')}</p>` : ''}
</td></tr>
<tr><td bgcolor="${C.night}" style="padding:16px 4px;background-color:${C.night};font-family:${FONT_MONO};font-size:12px;line-height:1.6;color:${C.muted};">
<a href="${WW}/" target="_blank" style="color:${C.cyan};text-decoration:none;">wyattworldwide.com</a> &middot; reply to this email to reach Wyatt
${footer ? `<br>Wyatt Horton &middot; ${esc(footer.postal)}<br><a href="${esc(footer.unsub)}" target="_blank" style="color:${C.cyan};">Unsubscribe</a> from these emails` : ''}
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
