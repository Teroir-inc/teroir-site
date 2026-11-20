#!/usr/bin/env python3
"""The WyattWorldWide worldscape (Wyatt 11-20): a pencil + blueprint perspective sketch of one beach world, drawn as
SVG tiles that sit behind the page sections. Graphite lines on paper, visible construction (horizon, vanishing points,
perspective rays), light hatching, a hand-drawn wobble, and only a faint pastel-sunset wash so the v5 palette shows.
Mood only from his reference sketch: nothing traced or copied.

    python3 scripts/ww_scenes.py            # writes ww/scene/*.svg

Every tile is 1200 x 1000 with its subject in the middle third (phones show about that much), fades to paper at all
four edges so stacked tiles read as one world, and has no text. Output is deterministic (seeded wobble).
"""
from pathlib import Path
import math
import random

OUT = Path(__file__).resolve().parent.parent / 'ww' / 'scene'
W, H = 1200, 1000
GRAPHITE = '#3E3B46'      # main pencil line
SOFT = '#6B6773'          # lighter pencil, far things
BLUE = '#5B7DB1'          # blueprint construction lines
WASH = ['#C9A7EB', '#FF9EC7', '#FF8A7A', '#FFC8A2']  # lavender, pink, coral, peach (palette.json), used faintly


class Pencil:
    def __init__(self, seed):
        self.r = random.Random(seed)
        self.parts = []

    def _wob(self, pts, amp):
        """jitter a polyline perpendicular-ish to make a hand-drawn line"""
        out = []
        for i, (x, y) in enumerate(pts):
            if 0 < i < len(pts) - 1:
                x += self.r.uniform(-amp, amp); y += self.r.uniform(-amp, amp)
            out.append((x, y))
        return out

    @staticmethod
    def _seg(a, b, n):
        return [(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n) for t in range(n + 1)]

    @staticmethod
    def _bez(p0, p1, p2, p3, n):
        pts = []
        for i in range(n + 1):
            t = i / n; u = 1 - t
            pts.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0], u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
        return pts

    def _path(self, pts):
        # smooth through the wobbled points with quadratic midpoints
        d = f'M{pts[0][0]:.0f} {pts[0][1]:.0f}'
        for i in range(1, len(pts) - 1):
            mx, my = (pts[i][0] + pts[i+1][0]) / 2, (pts[i][1] + pts[i+1][1]) / 2
            d += f'Q{pts[i][0]:.0f} {pts[i][1]:.0f} {mx:.0f} {my:.0f}'
        d += f'L{pts[-1][0]:.0f} {pts[-1][1]:.0f}'
        return d

    def stroke(self, pts, w=1.6, col=GRAPHITE, op=.85, amp=1.2, double=True, dash=None):
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        self.parts.append(f'<path d="{self._path(self._wob(pts, amp))}" stroke="{col}" stroke-width="{w}" opacity="{op}"{extra}/>')
        if double:  # a second, lighter pass: the pencil goes over the line twice
            self.parts.append(f'<path d="{self._path(self._wob(pts, amp * 1.4))}" stroke="{col}" stroke-width="{w * .55:.2f}" opacity="{op * .45:.2f}"{extra}/>')

    def line(self, a, b, n=None, **k):
        n = n or max(2, int(math.dist(a, b) / 40))
        self.stroke(self._seg(a, b, n), **k)

    def curve(self, p0, p1, p2, p3, n=16, **k):
        self.stroke(self._bez(p0, p1, p2, p3, n), **k)

    def circle(self, cx, cy, r, n=40, start=0, end=360, **k):
        pts = [(cx + r * math.cos(math.radians(a)), cy - r * math.sin(math.radians(a))) for a in [start + (end - start) * i / n for i in range(n + 1)]]
        self.stroke(pts, **k)

    def poly(self, pts, close=True, **k):
        """a polygon drawn edge by edge, so corners stay crisp (stroke() would round them)"""
        seq = pts + [pts[0]] if close else pts
        for a, b in zip(seq, seq[1:]):
            self.line(a, b, **k)

    def construction(self, a, b, op=.38):
        """a blueprint construction line: thin, blue, dashed, runs past its ends"""
        self.line(a, b, w=.9, col=BLUE, op=op, amp=.4, double=False, dash='10 7')

    def hatch(self, poly, angle=-35, gap=9, w=.8, op=.4, col=GRAPHITE):
        """light pencil hatching clipped to a polygon"""
        cid = f'h{len(self.parts)}'
        pts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in poly)
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        R = math.hypot(max(xs) - min(xs), max(ys) - min(ys))
        lines = []
        dx, dy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        k = -R
        while k < R:
            ox, oy = cx - dy * k, cy + dx * k
            a = (ox - dx * R, oy - dy * R); b = (ox + dx * R, oy + dy * R)
            p = self._wob(self._seg(a, b, 6), .9)
            lines.append(f'<path d="{self._path(p)}"/>')
            k += gap + self.r.uniform(-1.5, 1.5)
        self.parts.append(f'<clipPath id="{cid}"><polygon points="{pts}"/></clipPath>'
                          f'<g clip-path="url(#{cid})" stroke="{col}" stroke-width="{w}" opacity="{op}">{"".join(lines)}</g>')

    def raw(self, s):
        self.parts.append(s)


def frame(name, body_parts, horizon=None, wash_to=None):
    """wrap a tile: faint pastel wash (sky above the horizon, sand below), fade to paper at top and bottom"""
    hz = horizon if horizon is not None else 360
    wash = (f'<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{WASH[0]}" stop-opacity=".0"/>'
            f'<stop offset=".45" stop-color="{WASH[0]}" stop-opacity=".16"/><stop offset=".8" stop-color="{WASH[1]}" stop-opacity=".16"/>'
            f'<stop offset="1" stop-color="{WASH[3]}" stop-opacity=".2"/></linearGradient>'
            f'<linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{WASH[3]}" stop-opacity=".16"/>'
            f'<stop offset="1" stop-color="{WASH[3]}" stop-opacity=".04"/></linearGradient>'
            '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            '<stop offset=".1" stop-color="#fff" stop-opacity="1"/><stop offset=".9" stop-color="#fff" stop-opacity="1"/>'
            '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            f'<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>'
            '<linearGradient id="fadeh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            '<stop offset=".09" stop-color="#fff" stop-opacity="1"/><stop offset=".91" stop-color="#fff" stop-opacity="1"/>'
            '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            f'<mask id="mh" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="url(#fadeh)"/></mask>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" aria-hidden="true">'
            f'<!-- WyattWorldWide worldscape: {name}. Drawn by scripts/ww_scenes.py (pencil + blueprint sketch, look v5 wash). -->'
            f'<defs>{wash}</defs><g mask="url(#m)"><g mask="url(#mh)">'
            f'<rect width="{W}" height="{hz}" fill="url(#sky)"/><rect y="{hz}" width="{W}" height="{H - hz}" fill="url(#sand)"/>'
            f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">{"".join(body_parts)}</g></g></g></svg>')


# ---- shared drawings ------------------------------------------------------------------------------------------------
def horizon_line(p, y, op=.5):
    p.line((0, y), (W, y), w=1.1, col=SOFT, op=op, amp=.6)
    p.construction((0, y - 1), (W, y - 1), op=.3)


def palm(p, x, y, h, lean=0.0, scale=1.0, col=GRAPHITE, hatch=True):
    """a palm: curved trunk with ring ticks, a crown of fronds with leaflet strokes"""
    top = (x + lean * h, y - h)
    c1 = (x + lean * h * .1, y - h * .35); c2 = (x + lean * h * .7, y - h * .7)
    off = 7 * scale
    p.curve((x - off, y), (c1[0] - off * .8, c1[1]), (c2[0] - off * .5, c2[1]), (top[0] - off * .3, top[1]), w=1.8 * scale, col=col)
    p.curve((x + off, y), (c1[0] + off * .8, c1[1]), (c2[0] + off * .5, c2[1]), (top[0] + off * .3, top[1]), w=1.4 * scale, col=col)
    for i in range(1, 12):  # trunk rings
        t = i / 12; u = 1 - t
        cx = u**3*x + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t**3*top[0]
        cy = u**3*y + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t**3*top[1]
        ww = off * (1 - t * .55)
        p.line((cx - ww, cy + 2), (cx + ww, cy - 1), n=2, w=.9 * scale, col=col, op=.6, double=False)
    if hatch:
        p.hatch([(x + off, y), (top[0] + off * .3, top[1]), (top[0], top[1]), (x, y)], angle=70, gap=6 * scale, op=.3)
    # 7-9 fronds of different lengths and angles: a couple rising, most drooping, tips curling down unevenly
    nf = p.r.randint(7, 9)
    fronds = [(p.r.uniform(70, 110), p.r.uniform(.45, .6), -.15)]                       # rising
    fronds.append((p.r.uniform(40, 65) if lean <= 0 else p.r.uniform(115, 140), p.r.uniform(.55, .7), .05))  # half-rising
    for k in range(nf - 2):                                                                # drooping, both sides, uneven
        side_left = k % 2 == 0
        base_ang = p.r.uniform(150, 215) if side_left else p.r.uniform(-35, 30)
        fronds.append((base_ang, p.r.uniform(.7, 1.15), p.r.uniform(.25, .6)))
    for ang, ln, droop in fronds:
        L = h * .5 * ln
        a = math.radians(ang)
        side = math.cos(a)
        mid = (top[0] + side * L * .5, top[1] - L * (.18 + .3 * max(math.sin(a), 0)) + L * droop * .15)
        end = (top[0] + side * L * p.r.uniform(.85, 1.0), top[1] - math.sin(a) * L * .45 + L * droop)
        # the leaf: a spine plus two outline edges that swell in the middle and meet at the tip
        spine, up, dn, ticks = [], [], [], []
        n = 10
        for j in range(n + 1):
            t = j / n; u = 1 - t
            bx = u*u*top[0] + 2*u*t*mid[0] + t*t*end[0]; by = u*u*top[1] + 2*u*t*mid[1] + t*t*end[1]
            tx = 2*u*(mid[0]-top[0]) + 2*t*(end[0]-mid[0]); ty = 2*u*(mid[1]-top[1]) + 2*t*(end[1]-mid[1])
            nn = math.hypot(tx, ty) or 1; tx, ty = tx / nn, ty / nn
            wd = 15 * scale * math.sin(math.pi * min(t * 1.15, 1)) + 1
            spine.append((bx, by))
            up.append((bx - ty * wd, by + tx * wd)); dn.append((bx + ty * wd * .8, by - tx * wd * .8 + wd * .35))
            if 1 < j < n - 1:
                ticks.append(((bx, by), (bx - ty * wd * .95 + tx * wd * .5, by + tx * wd * .95 + ty * wd * .5)))
                ticks.append(((bx, by), (bx + ty * wd * .8 + tx * wd * .5, by - tx * wd * .8 + ty * wd * .5 + wd * .3)))
        p.stroke(up, w=1.3 * scale, col=col, amp=.8)
        p.stroke(dn, w=1.1 * scale, col=col, amp=.8, double=False)
        p.stroke(spine, w=.9 * scale, col=col, op=.6, amp=.5, double=False)
        for k, (s0, s1) in enumerate(ticks):
            if k % 2 == 0:
                p.line(s0, s1, n=2, w=.7 * scale, col=col, op=.45, double=False)


    for dx, dy, rr in [(-6, 8, 7), (5, 10, 6.5), (0, 16, 6)]:  # a small coconut cluster under the crown
        p.circle(top[0] + dx * scale, top[1] + dy * scale, rr * scale, n=14, w=1.1 * scale, col=col, op=.8, double=False)
    p.hatch([(top[0] - 12 * scale, top[1] + 4 * scale), (top[0] + 12 * scale, top[1] + 4 * scale), (top[0] + 10 * scale, top[1] + 22 * scale), (top[0] - 10 * scale, top[1] + 22 * scale)], angle=45, gap=3 * scale, op=.35)


def sun(p, cx, hz, r):
    p.circle(cx, hz, r, start=0, end=180, w=1.6, col=GRAPHITE)
    p.raw(f'<path d="M{cx - r} {hz} A{r} {r} 0 0 1 {cx + r} {hz} Z" fill="{WASH[3]}" fill-opacity=".35" stroke="none"/>')
    for i, yy in enumerate([.18, .36, .54, .72]):  # bands in the lower half, the v5 sun
        y = hz - r * (1 - yy) * .55
        half = math.sqrt(max(r * r - (hz - y) ** 2, 0))
        p.line((cx - half + 4, y), (cx + half - 4, y), n=4, w=1.0, col='#C66A5E', op=.55, double=False)
    for k in range(9):  # faint rays, construction style
        a = math.radians(15 + k * 18.75)
        p.construction((cx + math.cos(a) * r * 1.15, hz - math.sin(a) * r * 1.15), (cx + math.cos(a) * r * 1.8, hz - math.sin(a) * r * 1.8), op=.22)


def water(p, hz, y2):
    for k in range(9):  # wave strokes, closer = longer
        y = hz + (y2 - hz) * (k + 1) / 10
        for j in range(4):
            x = p.r.uniform(80, 1050); L = 30 + k * 9
            p.line((x, y), (x + L, y + p.r.uniform(-1, 1)), n=3, w=.9, col=SOFT, op=.45, double=False)


def shoreline(p, y):
    pts = [(x, y + 10 * math.sin(x / 90) + p.r.uniform(-3, 3)) for x in range(0, W + 1, 60)]
    p.stroke(pts, w=1.5, col=GRAPHITE, op=.75)
    pts2 = [(x, y + 14 + 8 * math.sin(x / 70 + 1)) for x in range(0, W + 1, 60)]
    p.stroke(pts2, w=.9, col=SOFT, op=.5, double=False)


def sand_marks(p, y0, y1, n=40):
    for _ in range(n):
        x = p.r.uniform(30, W - 30); y = p.r.uniform(y0, y1)
        p.line((x, y), (x + p.r.uniform(6, 14), y + p.r.uniform(-1, 1)), n=2, w=.8, col=SOFT, op=.35, double=False)


def perspective_fan(p, vp, ys, op=.2):
    for x in range(-600, W + 700, 150):
        p.construction(vp, (x, ys), op=op)


# ---- tiles ----------------------------------------------------------------------------------------------------------
def shore():
    """hero: the shoreline at sunset, the road running to the vanishing point, palms, the phone in the foreground"""
    p = Pencil(1); hz = 420; vp = (600, hz)
    sun(p, 600, hz, 150)
    horizon_line(p, hz)
    p.circle(600, hz, 6, w=1.0, col=BLUE, op=.5, double=False)  # the vanishing point, marked
    water(p, hz, 520)
    shoreline(p, 525)
    perspective_fan(p, vp, 1000, op=.16)
    # road: two edges to the VP, perspective dashes
    p.line((470, 1000), vp, w=2.0); p.line((730, 1000), vp, w=2.0)
    p.hatch([(470, 1000), (600, hz + 2), (520, 1000)], angle=-60, gap=11, op=.22)
    y = hz + 12
    while y < 990:
        t = (y - hz) / (1000 - hz); L = 6 + 46 * t; wd = 2 + 9 * t
        p.raw(f'<path d="M{600 - wd:.1f} {y:.1f}h{2 * wd:.1f}l{wd * .4:.1f} {L:.1f}h{-2.8 * wd:.1f}z" stroke="{GRAPHITE}" stroke-width="1" opacity=".55"/>')
        y += L * 2.1
    sand_marks(p, 560, 980, 50)
    palm(p, 390, 940, 500, lean=-.18, scale=1.15)      # trunks inside the phone-width crop (about x 330-870)
    palm(p, 250, 560, 170, lean=.1, scale=.6, col=SOFT, hatch=False)
    palm(p, 850, 900, 420, lean=.16, scale=1.0)
    palm(p, 940, 548, 140, lean=-.08, scale=.5, col=SOFT, hatch=False)
    # the phone: a box in perspective, front face + right side, screen with cards
    fx, fy, fw, fh = 700, 730, 96, 180
    p.line((fx, fy), (fx + fw, fy - 8), w=1.8); p.line((fx + fw, fy - 8), (fx + fw + 6, fy + fh - 10), w=1.8)
    p.line((fx + fw + 6, fy + fh - 10), (fx + 6, fy + fh), w=1.8); p.line((fx + 6, fy + fh), (fx, fy), w=1.8)
    p.line((fx + fw, fy - 8), (fx + fw + 18, fy + 4), w=1.2); p.line((fx + fw + 18, fy + 4), (fx + fw + 24, fy + fh), w=1.2)
    p.line((fx + fw + 24, fy + fh), (fx + fw + 6, fy + fh - 10), w=1.2)
    p.hatch([(fx + fw, fy - 8), (fx + fw + 18, fy + 4), (fx + fw + 24, fy + fh), (fx + fw + 6, fy + fh - 10)], angle=80, gap=3, op=.6)
    p.hatch([(fx + fw, fy - 8), (fx + fw + 18, fy + 4), (fx + fw + 24, fy + fh), (fx + fw + 6, fy + fh - 10)], angle=-10, gap=5, op=.35)
    shadow = [(fx + 6, fy + fh), (fx + fw + 24, fy + fh), (fx + fw + 90, fy + fh + 34), (fx + 50, fy + fh + 40)]  # cast shadow on the sand
    p.hatch(shadow, angle=15, gap=5, op=.4)
    p.line((fx + 6, fy + fh), (fx + 50, fy + fh + 40), w=.9, op=.5, double=False); p.line((fx + 50, fy + fh + 40), (fx + fw + 90, fy + fh + 34), w=.9, op=.5, double=False)
    for i, (yy, ww, col) in enumerate([(24, 58, WASH[2]), (66, 64, WASH[1]), (106, 46, WASH[3])]):
        x0 = fx + 18 + i * 3; y0 = fy + yy
        p.raw(f'<rect x="{x0}" y="{y0}" width="{ww}" height="26" rx="6" fill="{col}" fill-opacity=".35" stroke="{GRAPHITE}" stroke-width="1.1" opacity=".8"/>')
    p.construction((fx, fy), vp, op=.25); p.construction((fx + 6, fy + fh), vp, op=.25)
    return frame('shore', p.parts, horizon=hz)


def hut():
    """guides: a beach hut in two-point perspective, construction to both vanishing points on the horizon"""
    p = Pencil(2); hz = 330; vl = (-500, hz); vr = (1700, hz)
    horizon_line(p, hz)
    water(p, hz, 380); shoreline(p, 390)
    # corners of the hut: front edge at x=560, from ground 760 to eave 520
    fx, gy, ey = 560, 760, 520
    def towards(pt, vp, t):
        return (pt[0] + (vp[0] - pt[0]) * t, pt[1] + (vp[1] - pt[1]) * t)
    gl, el = towards((fx, gy), vl, .17), towards((fx, ey), vl, .17)
    gr, er = towards((fx, gy), vr, .16), towards((fx, ey), vr, .16)
    for a, b in [((fx, gy), (fx, ey)), (gl, el), (gr, er), ((fx, gy), gl), ((fx, gy), gr), ((fx, ey), el), ((fx, ey), er)]:
        p.line(a, b, w=1.9)
    for pt in [(fx, gy), (fx, ey), gl, gr]:  # construction to the vanishing points
        p.construction(pt, vl if pt[0] <= fx else vr, op=.22)
        p.construction(pt, vr if pt[0] <= fx else vl, op=.14)
    # roof: ridge above the left face centre
    ridge_f = ((fx + el[0]) / 2 - 10, ey - 120)
    p.line((fx - 12, ey + 8), ridge_f, w=1.9); p.line(ridge_f, (el[0] - 10, el[1] + 6), w=1.9)
    ridge_b = towards(ridge_f, vr, .16)
    p.line(ridge_f, ridge_b, w=1.7); p.line(ridge_b, (er[0] + 14, er[1] + 8), w=1.7); p.line((fx - 12, ey + 8), (er[0] + 14, er[1] + 8), w=1.5)
    p.hatch([ridge_f, ridge_b, (er[0] + 14, er[1] + 8), (fx - 12, ey + 8)], angle=-20, gap=7, op=.35)
    # planks on the right face
    for k in range(1, 9):
        t = k / 9
        a = towards((fx, gy - (gy - ey) * t), vr, .16); p.line((fx, gy - (gy - ey) * t), a, w=.8, op=.5, double=False)
    # door on the left face, window on the right face
    d1, d2 = towards((fx, gy), vl, .05), towards((fx, gy), vl, .12)
    p.line(d1, (d1[0], d1[1] - 150), w=1.4); p.line(d2, (d2[0], d2[1] - 138), w=1.4); p.line((d1[0], d1[1] - 150), (d2[0], d2[1] - 138), w=1.4)
    p.hatch([d1, (d1[0], d1[1] - 150), (d2[0], d2[1] - 138), d2], angle=90, gap=5, op=.4)
    w1, w2 = towards((fx, 610), vr, .04), towards((fx, 610), vr, .11)
    for a, b in [(w1, w2), ((w1[0], w1[1] + 60), (w2[0], w2[1] + 58)), (w1, (w1[0], w1[1] + 60)), (w2, (w2[0], w2[1] + 58))]:
        p.line(a, b, w=1.3)
    p.raw(f'<polygon points="{w1[0]:.0f},{w1[1]:.0f} {w2[0]:.0f},{w2[1]:.0f} {w2[0]:.0f},{w2[1] + 58:.0f} {w1[0]:.0f},{w1[1] + 60:.0f}" fill="{WASH[1]}" fill-opacity=".25" stroke="none"/>')
    # steps + ground shadow
    p.line((fx - 60, gy + 14), (fx + 70, gy + 10), w=1.3); p.line((fx - 50, gy + 28), (fx + 80, gy + 24), w=1.3)
    p.hatch([(fx, gy), gr, (gr[0] + 120, gr[1] + 40), (fx + 120, gy + 40)], angle=0, gap=6, op=.25)
    palm(p, 900, 800, 420, lean=-.12, scale=1.0)
    palm(p, 250, 700, 300, lean=.15, scale=.8)
    sand_marks(p, 420, 960, 50)
    return frame('beach hut', p.parts, horizon=hz)


def stall():
    """shop: the boardwalk running to its vanishing point, a stall with a striped awning"""
    p = Pencil(3); hz = 300; vp = (760, hz)
    horizon_line(p, hz)
    water(p, hz, 350)
    # boardwalk: edges + planks across, converging
    p.line((560, 1000), vp, w=2.0); p.line((1140, 1000), vp, w=2.0)
    y = hz + 6
    while y < 1000:
        t = (y - hz) / (1000 - hz)
        xl = vp[0] + (560 - vp[0]) * t; xr = vp[0] + (1140 - vp[0]) * t
        p.line((xl, y), (xr, y), n=4, w=.7 + 1.0 * t, op=.6, double=False)
        y += 4 + 40 * t
    perspective_fan(p, vp, 1000, op=.14)
    # posts along the boardwalk
    for t in (.2, .35, .55, .8, 1.0):
        for edge in (560, 1140):
            x = vp[0] + (edge - vp[0]) * t; yb = hz + (1000 - hz) * t
            p.line((x, yb), (x, yb - 90 * t), w=1.0 + t, op=.7)
    # the stall: a box in the boardwalk's own one-point perspective (front face square to us, side face to the VP)
    def tvp(pt, t):
        return (pt[0] + (vp[0] - pt[0]) * t, pt[1] + (vp[1] - pt[1]) * t)
    x0, x1, yb, yc, yr = 150, 420, 820, 680, 520   # front face: left, right, base, counter top, roof posts top
    D = .16                                         # depth of the stall toward the VP
    fb_l, fb_r, fc_l, fc_r = (x0, yb), (x1, yb), (x0, yc), (x1, yc)
    sb_r, sc_r = tvp(fb_r, D), tvp(fc_r, D)
    for a_, b_ in [(fb_l, fb_r), (fb_l, fc_l), (fb_r, fc_r), (fc_l, fc_r), (fb_r, sb_r), (fc_r, sc_r), (sb_r, sc_r)]:
        p.line(a_, b_, w=1.9)
    p.hatch([fb_r, sb_r, sc_r, fc_r], angle=80, gap=4, op=.5)          # shade side
    p.hatch([fb_l, fb_r, fc_r, fc_l], angle=-45, gap=11, op=.18)       # front, light
    for pt in (fb_r, fc_r, (x0, yb), (x0, yc)):
        p.construction(pt, vp, op=.2)
    # posts up to the awning, front and back
    pr_l, pr_r = (x0, yr), (x1, yr)
    p.line(fc_l, pr_l, w=1.5); p.line(fc_r, pr_r, w=1.5); p.line(sc_r, tvp(pr_r, D), w=1.1, op=.7)
    # awning: a sloped roof in the same perspective, striped
    a_fl, a_fr = (x0 - 24, yr + 26), (x1 + 24, yr + 26)                 # front lip (lower)
    a_bl, a_br = tvp((x0 - 24, yr - 40), D), tvp((x1 + 24, yr - 40), D) # back (higher, toward the VP)
    p.poly([a_fl, a_fr, a_br, a_bl], w=1.8)
    for k in range(7):
        t0, t1 = k / 7, (k + 1) / 7
        f0 = (a_fl[0] + (a_fr[0] - a_fl[0]) * t0, a_fl[1]); f1 = (a_fl[0] + (a_fr[0] - a_fl[0]) * t1, a_fl[1])
        b0 = (a_bl[0] + (a_br[0] - a_bl[0]) * t0, a_bl[1] + (a_br[1] - a_bl[1]) * t0); b1 = (a_bl[0] + (a_br[0] - a_bl[0]) * t1, a_bl[1] + (a_br[1] - a_bl[1]) * t1)
        if k % 2 == 0:
            p.raw(f'<polygon points="{f0[0]:.0f},{f0[1]:.0f} {f1[0]:.0f},{f1[1]:.0f} {b1[0]:.0f},{b1[1]:.0f} {b0[0]:.0f},{b0[1]:.0f}" fill="{WASH[2]}" fill-opacity=".32" stroke="none"/>')
        p.line(f1, b1, w=.9, op=.6, double=False)
    p.construction(a_fl, vp, op=.18); p.construction(a_fr, vp, op=.18)
    # scalloped valance along the front lip
    for k in range(7):
        xa = a_fl[0] + (a_fr[0] - a_fl[0]) * k / 7; xb = a_fl[0] + (a_fr[0] - a_fl[0]) * (k + 1) / 7
        p.curve((xa, a_fl[1]), (xa + 4, a_fl[1] + 18), (xb - 4, a_fl[1] + 18), (xb, a_fl[1]), n=6, w=1.1, op=.7, double=False)
    # little stacked guides on the counter, square to the front face
    for k in range(3):
        p.raw(f'<rect x="{x0 + 30 + k * 76}" y="{yc - 18 - (k % 2) * 6}" width="56" height="16" rx="2" fill="{WASH[k % 3 + 1]}" fill-opacity=".38" stroke="{GRAPHITE}" stroke-width="1.1" opacity=".85"/>')
    # cast shadow on the sand, away from the sun
    p.hatch([fb_l, fb_r, (x1 - 20, yb + 50), (x0 - 70, yb + 46)], angle=10, gap=5, op=.32)
    palm(p, 500, 700, 330, lean=.1, scale=.85)
    palm(p, 1120, 560, 220, lean=-.1, scale=.6, col=SOFT, hatch=False)
    return frame('boardwalk stall', p.parts, horizon=hz)


def tower():
    """blog: a lifeguard tower on stilts, ladder and flag, the sea behind"""
    p = Pencil(4); hz = 360
    horizon_line(p, hz)
    sun(p, 980, hz, 70)
    water(p, hz, 470); shoreline(p, 480)
    cx, base, top = 600, 900, 560
    legs = [(cx - 110, base), (cx + 110, base - 10), (cx - 70, base - 60), (cx + 70, base - 66)]
    for (x, y) in legs:
        p.line((x, y), (cx + (x - cx) * .55, top + 10), w=1.8 if y > base - 30 else 1.2, op=.85 if y > base - 30 else .55)
    p.line((cx - 95, base - 120), (cx + 95, base - 128), w=1.1); p.line((cx - 80, base - 230), (cx + 80, base - 236), w=1.1)
    p.line((cx - 95, base - 120), (cx + 80, base - 236), w=.9, op=.6); p.line((cx + 95, base - 128), (cx - 80, base - 236), w=.9, op=.6)
    # cabin box
    cab = [(cx - 110, top), (cx + 110, top - 6), (cx + 110, top - 120), (cx - 110, top - 114)]
    p.poly(cab, w=1.9)
    p.line((cx + 110, top - 6), (cx + 150, top - 30), w=1.4); p.line((cx + 110, top - 120), (cx + 150, top - 140), w=1.4); p.line((cx + 150, top - 30), (cx + 150, top - 140), w=1.4)
    p.hatch([(cx + 110, top - 6), (cx + 150, top - 30), (cx + 150, top - 140), (cx + 110, top - 120)], angle=80, gap=5, op=.4)
    p.raw(f'<polygon points="{cx - 80},{top - 95} {cx + 80},{top - 99} {cx + 80},{top - 45} {cx - 80},{top - 41}" fill="{WASH[0]}" fill-opacity=".3" stroke="{GRAPHITE}" stroke-width="1.3" opacity=".8"/>')
    # roof + flag
    p.poly([(cx - 135, top - 112), (cx, top - 175), (cx + 175, top - 140), (cx + 135, top - 118)], w=1.8)
    p.hatch([(cx - 135, top - 112), (cx, top - 175), (cx + 175, top - 140), (cx + 135, top - 118)], angle=-15, gap=7, op=.3)
    p.line((cx, top - 175), (cx, top - 280), w=1.4)
    p.poly([(cx, top - 280), (cx + 70, top - 262), (cx, top - 240)], close=False, w=1.3)
    p.raw(f'<polygon points="{cx},{top - 280} {cx + 70},{top - 262} {cx},{top - 240}" fill="{WASH[2]}" fill-opacity=".4" stroke="none"/>')
    # ladder
    p.line((cx - 30, base + 20), (cx - 60, top), w=1.3); p.line((cx + 10, base + 22), (cx - 20, top), w=1.3)
    for k in range(1, 9):
        t = k / 9
        p.line((cx - 30 + (-30) * t, base + 20 - (base + 20 - top) * t), (cx + 10 + (-30) * t, base + 22 - (base + 22 - top) * t), n=2, w=1.0, double=False)
    p.construction((0, hz), (cx, top - 60), op=.15); p.construction((W, hz), (cx, top - 60), op=.15)
    palm(p, 200, 860, 380, lean=.12, scale=.9)
    palm(p, 1060, 900, 300, lean=-.1, scale=.8)
    sand_marks(p, 520, 980, 45)
    return frame('lifeguard tower', p.parts, horizon=hz)


def dunes():
    """the walk between places: dunes, a fence receding, grass tufts"""
    p = Pencil(5); hz = 300; vp = (900, hz)
    horizon_line(p, hz, op=.35)
    for k, y in enumerate([420, 560, 720]):
        pts = [(x, y + 40 * math.sin(x / (160 + k * 40) + k) + p.r.uniform(-3, 3)) for x in range(0, W + 1, 50)]
        p.stroke(pts, w=1.2 + k * .3, op=.6 + k * .1)
    # fence posts receding to the VP
    for t in [i / 10 for i in range(1, 11)]:
        x = vp[0] + (80 - vp[0]) * t; yb = hz + (900 - hz) * t
        p.line((x, yb), (x - 4, yb - 120 * t), w=.8 + 1.2 * t, op=.75)
        if t > .1:
            tp = t - .1; xp = vp[0] + (80 - vp[0]) * tp; ybp = hz + (900 - hz) * tp
            p.line((xp - 2, ybp - 80 * tp), (x - 3, yb - 80 * t), n=3, w=.8, op=.5, double=False)
    p.construction(vp, (80, 900), op=.25); p.construction(vp, (80, 780), op=.2)
    for _ in range(26):  # grass tufts
        x = p.r.uniform(40, W - 40); y = p.r.uniform(430, 960)
        for b in range(4):
            p.line((x, y), (x + p.r.uniform(-14, 14), y - p.r.uniform(18, 34)), n=2, w=.9, op=.55, double=False)
    # one pastel accent: a striped beach towel lying in perspective, and a little sign post beside it
    tw = [(470, 790), (650, 770), (690, 840), (480, 868)]
    p.poly(tw, w=1.5)
    for k in range(5):
        t0, t1 = k / 5, (k + 1) / 5
        q = lambda a_, b_, t: (a_[0] + (b_[0] - a_[0]) * t, a_[1] + (b_[1] - a_[1]) * t)
        a0, a1, b0, b1 = q(tw[0], tw[1], t0), q(tw[0], tw[1], t1), q(tw[3], tw[2], t0), q(tw[3], tw[2], t1)
        if k % 2 == 0:
            p.raw(f'<polygon points="{a0[0]:.0f},{a0[1]:.0f} {a1[0]:.0f},{a1[1]:.0f} {b1[0]:.0f},{b1[1]:.0f} {b0[0]:.0f},{b0[1]:.0f}" fill="{WASH[1]}" fill-opacity=".38" stroke="none"/>')
        p.line(a1, b1, w=.9, op=.6, double=False)
    p.line((760, 860), (764, 700), w=1.6); p.poly([(738, 700), (830, 692), (834, 730), (742, 738)], w=1.4)
    p.hatch([(764, 860), (800, 880), (806, 872), (768, 856)], angle=0, gap=3, op=.35)
    palm(p, 700, 640, 260, lean=.1, scale=.7)
    sand_marks(p, 600, 980, 40)
    return frame('dunes', p.parts, horizon=hz)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in [('shore', shore), ('hut', hut), ('stall', stall), ('tower', tower), ('dunes', dunes)]:
        svg = fn()
        (OUT / f'{name}.svg').write_text(svg)
        print(f'wrote ww/scene/{name}.svg ({len(svg) // 1024} KB)')


if __name__ == '__main__':
    main()
