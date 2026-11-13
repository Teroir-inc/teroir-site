// Host routing: wyattworldwide.com (Wyatt's personal site) is served from /ww/ in this project.
// teroir.com is untouched. /api/ is shared by both sites and never rewritten.
export const config = { matcher: '/((?!api/).*)' };

const WW = /^(www\.)?wyattworldwide\.com$/i;

export default function middleware(req) {
  const url = new URL(req.url);
  const host = (req.headers.get('host') || url.host).toLowerCase();
  // x-ww-preview: 1 lets us test the routing on teroir.com before the domain points here
  if (!WW.test(host) && req.headers.get('x-ww-preview') !== '1') return; // teroir.com: carry on as before
  if (host.startsWith('www.')) return Response.redirect(`https://wyattworldwide.com${url.pathname}${url.search}`, 308);
  if (url.pathname.startsWith('/ww/')) return; // already rewritten
  const path = url.pathname === '/' ? '/ww/index.html' : `/ww${url.pathname}`;
  return new Response(null, { headers: { 'x-middleware-rewrite': new URL(path + url.search, url).toString() } });
}
