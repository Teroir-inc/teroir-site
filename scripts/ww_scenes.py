#!/usr/bin/env python3
"""The WyattWorldWide worldscape (Wyatt 11-20): "the real world is being generated from the digital world at the
boundary line". Every tile has a horizon boundary: a neon wireframe world above it (grid, wireframe sun and terrain,
data marks) and a detailed pencil sketch below (hatching, waves and foam, rocks, cliffs, footprints, architect's
dimension lines). At the boundary the grid breaks up into pencil and the binary turns into foam; anything that
crosses it is pencil below and wireframe above. Down the page the digital part fades: the hero is night synthwave,
the dunes at the bottom are almost all pencil. Mood only from his reference image: nothing traced or copied.

    python3 scripts/ww_scenes.py            # writes ww/scene/*.svg

Tiles are 1200 x 1000, subject in the middle third (phones show about that much), faded to paper at all four edges.
Output is deterministic (seeded wobble).
"""
from pathlib import Path
import math
import random

OUT = Path(__file__).resolve().parent.parent / 'ww' / 'scene'
W, H = 1200, 1000
GRAPHITE = '#3E3B46'      # main pencil line
SOFT = '#6B6773'          # lighter pencil, far things
BLUE = '#5B7DB1'          # blueprint construction and dimension lines
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
        if double and w >= 1.5:  # a second, lighter pass on main outlines: the pencil goes over the line twice
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
            p = self._wob(self._seg(a, b, 2), .9)
            lines.append(f'<path d="M{p[0][0]:.0f} {p[0][1]:.0f}L{p[1][0]:.0f} {p[1][1]:.0f}L{p[2][0]:.0f} {p[2][1]:.0f}"/>')
            k += gap + self.r.uniform(-1.5, 1.5)
        self.parts.append(f'<clipPath id="{cid}"><polygon points="{pts}"/></clipPath>'
                          f'<g clip-path="url(#{cid})" stroke="{col}" stroke-width="{w}" opacity="{op}">{"".join(lines)}</g>')

    def raw(self, s):
        self.parts.append(s)



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



# ---- the digital world, the boundary and the real world ------------------------------------------------------------
def shore_y(x, yb):
    return yb + 7 * math.sin(x / 70) + 4 * math.sin(x / 23 + 1)


def shore_path(yb, below=False):
    pts = ' '.join(f'L{x} {shore_y(x, yb):.0f}' for x in range(0, W + 1, 20))
    return (f'M0 {H}{pts.replace("L0 ", "L0 ", 1)}L{W} {H}Z' if below else f'M0 0L0 {shore_y(0, yb):.0f}{pts}L{W} 0Z')
NEON_C, NEON_M, NIGHT = '#00E5FF', '#FF2BD6', '#140A2E'
DEEP_C, DEEP_M = '#0097B8', '#C21AA6'   # the neon, deepened, for light (daytime) digital bands on paper


def defs_for(level, yb):
    """gradients and clips a tile needs: the neon stroke, the wireframe sun, above/below the boundary"""
    c, m = (NEON_C, NEON_M) if level >= .8 else (DEEP_C, DEEP_M)
    return (f'<linearGradient id="neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{c}"/><stop offset="1" stop-color="{m}"/></linearGradient>'
            f'<linearGradient id="neonv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{m}"/><stop offset="1" stop-color="{c}"/></linearGradient>'
            '<linearGradient id="sunw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD23F"/><stop offset=".55" stop-color="#FF8A7A"/><stop offset="1" stop-color="#FF2BD6"/></linearGradient>'
            f'<clipPath id="above"><path d="{shore_path(yb)}"/></clipPath>'
            f'<clipPath id="below"><path d="{shore_path(yb, below=True)}"/></clipPath>'
            '<pattern id="stip" width="23" height="19" patternUnits="userSpaceOnUse">'
            '<circle cx="3" cy="4" r=".9" fill="#3E3B46"/><circle cx="14" cy="2" r=".7" fill="#3E3B46"/><circle cx="9" cy="12" r="1" fill="#3E3B46"/>'
            '<circle cx="19" cy="15" r=".8" fill="#3E3B46"/><circle cx="2" cy="16" r=".6" fill="#3E3B46"/></pattern>')


def both(p, yb, level, draw):
    """draw something that crosses the boundary: pencil below it, neon wireframe above it"""
    i = len(p.parts); draw(); seg = ''.join(p.parts[i:]); del p.parts[i:]
    p.raw(f'<g clip-path="url(#below)">{seg}</g>')
    if level > 0:
        import re
        digi = re.sub(r'stroke="#(3E3B46|6B6773)"', 'stroke="url(#neonv)"', seg)
        digi = re.sub(r'<clipPath id="(h\d+)"', r'<clipPath id="\1d"', digi).replace('url(#h', 'url(#hd').replace('url(#hdd', 'url(#hd')
        digi = re.sub(r'url\(#hd(\d+)\)', r'url(#h\1d)', digi)
        p.raw(f'<g clip-path="url(#above)" opacity="{.45 + .5 * level:.2f}">{digi}</g>')


def digital(p, hz, yb, level, vp, sun=None, peaks=True):
    """above the boundary: a wireframe world. level 1 = night synthwave (the top of the page); lower = a daytime
    band of deeper neon lines on paper, fading as the page goes down into the real world"""
    dark = level >= .8
    if dark:
        p.raw(f'<linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{NIGHT}"/>'
              f'<stop offset=".62" stop-color="#3A1252"/><stop offset=".9" stop-color="#7A1D78"/><stop offset="1" stop-color="#C2338F"/></linearGradient>'
              f'<rect width="{W}" height="{hz}" fill="url(#nsky)" stroke="none"/>'
              f'<path d="M0 {hz}' + ''.join(f'L{x} {shore_y(x, yb):.0f}' for x in range(0, W + 1, 20)).replace('L0 ', 'L0 ', 1) + f'L{W} {hz}Z" fill="#1A0C36" stroke="none"/>'
              f'<rect y="{hz - 30}" width="{W}" height="40" fill="{NEON_M}" opacity=".18" stroke="none"/>')
    else:
        p.raw(f'<linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8E0FA" stop-opacity="0"/>'
              f'<stop offset=".5" stop-color="#E6DDFA" stop-opacity="{.55 * level:.2f}"/><stop offset="1" stop-color="#F7DCEF" stop-opacity="{.7 * level:.2f}"/></linearGradient>'
              f'<rect width="{W}" height="{yb}" fill="url(#dsky)" stroke="none"/>')
    op = .85 if dark else .25 + .5 * level
    # a perspective grid in the sky (the "ceiling"), the most digital part
    if level >= .6:
        for k in range(1, 7):
            y = hz * (1 - (k / 7) ** 1.7) * .9
            p.raw(f'<path d="M0 {y:.0f}H{W}" stroke="url(#neon)" stroke-width=".8" opacity="{op * .35:.2f}"/>')
        for x in range(-1200, 2401, 160):
            p.raw(f'<path d="M{vp[0]} {hz}L{x} -40" stroke="url(#neon)" stroke-width=".7" opacity="{op * .22:.2f}"/>')
    # constellations and data columns
    r = p.r
    if level >= .4:
        stars = [(r.uniform(40, W - 40), r.uniform(20, hz * .8)) for _ in range(int(26 * level))]
        for (x, y) in stars:
            p.raw(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r.uniform(1, 2.2):.1f}" fill="{NEON_C if dark else DEEP_C}" opacity="{op:.2f}" stroke="none"/>')
        for a, b in zip(stars[:8], stars[1:9]):
            if math.dist(a, b) < 260:
                p.raw(f'<path d="M{a[0]:.0f} {a[1]:.0f}L{b[0]:.0f} {b[1]:.0f}" stroke="{NEON_C if dark else DEEP_C}" stroke-width=".7" opacity="{op * .5:.2f}"/>')
        for col in range(int(5 * level)):
            x = r.choice([r.uniform(60, 360), r.uniform(840, 1140)]); y0 = r.uniform(30, hz * .5)
            bits = ''.join(r.choice('01') for _ in range(10))
            p.raw(f'<text x="{x:.0f}" y="{y0:.0f}" font-family="ui-monospace,Menlo,monospace" font-size="11" fill="{NEON_C if dark else DEEP_C}" opacity="{op * .7:.2f}" '
                  f'writing-mode="tb" letter-spacing="3" stroke="none">{bits}</text>')
    # the wireframe sun: latitude chords and longitude ellipses, cut by the horizon
    if sun:
        sx, sr = sun
        p.raw(f'<clipPath id="sunc"><rect x="0" y="0" width="{W}" height="{hz}"/></clipPath><g clip-path="url(#sunc)" stroke="url(#sunw)" opacity="{min(1, op + .1):.2f}">')
        p.raw(f'<circle cx="{sx}" cy="{hz}" r="{sr}" stroke-width="2.2" fill="{NIGHT if dark else "none"}" fill-opacity=".5"/>')
        for k in range(1, 9):
            y = hz - sr * k / 9; hw = math.sqrt(sr * sr - (hz - y) ** 2)
            p.raw(f'<path d="M{sx - hw:.0f} {y:.0f}H{sx + hw:.0f}" stroke-width="1"/>')
        for k in range(1, 6):
            rx = sr * k / 6
            p.raw(f'<ellipse cx="{sx}" cy="{hz}" rx="{rx:.0f}" ry="{sr}" stroke-width=".9"/>')
        p.raw('</g>')
    # wireframe mountains on both sides: triangulated ridges
    if peaks:
        for side in (0, 1):
            xs = [0, 120, 230, 330, 430] if side == 0 else [770, 870, 980, 1090, 1200]
            pts = []
            for i, x in enumerate(xs):
                h_ = r.uniform(60, 170) * (1.1 if i in (1, 3) else .7) * (.6 + .5 * level)
                if i in (0, len(xs) - 1): h_ *= .25
                pts.append((x, hz - h_))
            base = [(x, hz) for x in xs]
            fill = 'fill="#1E0F3D" fill-opacity=".95"' if dark else f'fill="#EFE7FB" fill-opacity="{.6 * level:.2f}"'
            ridge = ' '.join(f'{x:.0f},{y:.0f}' for x, y in pts)
            p.raw(f'<polygon points="{xs[0]},{hz} {ridge} {xs[-1]},{hz}" {fill} stroke="url(#neon)" stroke-width="1.6" opacity="{op:.2f}"/>')
            for (a, b) in zip(pts, pts[1:]):  # facets: each peak to the valley floor below the next
                mx = (a[0] + b[0]) / 2
                p.raw(f'<path d="M{a[0]:.0f} {a[1]:.0f}L{mx:.0f} {hz}M{b[0]:.0f} {b[1]:.0f}L{mx:.0f} {hz}M{a[0]:.0f} {a[1]:.0f}L{a[0] + (b[0] - a[0]) * .3:.0f} {(a[1] + hz) / 2 + 8:.0f}" '
                      f'stroke="url(#neon)" stroke-width=".9" opacity="{op * .8:.2f}"/>')
            for k in range(1, 4):  # contour rings
                t = k / 4
                ring = ' '.join(f'{x:.0f},{hz - (hz - y) * t:.0f}' for x, y in pts)
                p.raw(f'<polyline points="{ring}" stroke="url(#neon)" stroke-width=".6" opacity="{op * .45:.2f}"/>')
    # the grid sea between the horizon and the boundary
    p.raw(f'<clipPath id="sea"><path d="M0 {hz}' + ''.join(f'L{x} {shore_y(x, yb):.0f}' for x in range(0, W + 1, 20)) + f'L{W} {hz}Z"/></clipPath><g clip-path="url(#sea)">')
    N = 12
    for k in range(1, N + 1):
        t = (k / N) ** 1.8; y = hz + (yb - hz) * t
        if t < .55:
            p.raw(f'<path d="M0 {y:.0f}H{W}" stroke="url(#neon)" stroke-width="{.6 + 1.2 * t:.1f}" opacity="{op:.2f}"/>')
            if dark:
                p.raw(f'<path d="M0 {y:.0f}H{W}" stroke="{NEON_M}" stroke-width="{3 + 4 * t:.1f}" opacity=".12"/>')
    for x in range(-1600, 2801, 110):
        p.raw(f'<path d="M{vp[0]} {hz}L{x} {yb + (yb - hz) * 2}" stroke="url(#neon)" stroke-width=".8" opacity="{op * .8:.2f}"/>')
    p.raw('</g>')


def boundary(p, hz, yb, level):
    """where the grid meets the shore: the grid breaks up into pencil, binary turns into foam"""
    r = p.r
    dark = level >= .8
    c = NEON_C if dark else DEEP_C
    # the last grid rows break up: dashes that wobble and turn graphite
    for k in range(4):
        y = yb - 26 + k * 9
        x = r.uniform(-20, 40)
        while x < W:
            L = r.uniform(30, 90) * (1 - k * .15)
            col = 'url(#neon)' if k < 2 else GRAPHITE
            p.stroke(p._seg((x, y + r.uniform(-2, 2)), (x + L, y + r.uniform(-2, 2)), 3), w=1.1 - k * .15, col=col, op=.75 - k * .1, amp=.6 + k * .5, double=False)
            x += L + r.uniform(10, 50) * (1 + k)
    # binary riding the boundary, then thinning out into pencil foam
    for i in range(int(46 + 30 * level)):
        x = r.uniform(10, W - 10); y = yb + r.uniform(-18, 10)
        bits = ''.join(r.choice('01') for _ in range(r.randint(2, 6)))
        fill = c if y < yb - 4 else '#3E3B46'
        p.raw(f'<text x="{x:.0f}" y="{y:.0f}" font-family="ui-monospace,Menlo,monospace" font-size="{r.choice([9, 10, 11, 12])}" fill="{fill}" '
              f'opacity="{(.55 if fill == c else .35) * (.6 + .4 * level):.2f}" stroke="none">{bits}</text>')
    # the shoreline itself, drawn in pencil, and the foam: curls, bubbles, broken lines
    pts = [(x, shore_y(x, yb) + r.uniform(-1.5, 1.5)) for x in range(0, W + 1, 40)]
    p.stroke(pts, w=1.7, col=GRAPHITE, op=.85)
    # grid squares turning into sand: the rays carry on a little below the shore as broken pencil, fading out
    for x in range(-1600, 2801, 110):
        vx = W / 2; t0 = 1.0
        a = (vx + (x - vx) * ((yb - hz) / ((yb - hz) * 3)), yb + 2)
        for k in range(3):
            ya, yb2 = yb + 8 + k * 16, yb + 18 + k * 16
            fx = lambda yy: vx + (x - vx) * (yy - hz) / ((yb - hz) * 3)
            if 0 < fx(ya) < W:
                p.line((fx(ya), ya), (fx(yb2), yb2), n=2, w=.8, col=GRAPHITE, op=.42 - k * .12, double=False)
    for k in range(3):
        pts = [(x, yb + 14 + k * 10 + 5 * math.sin(x / (50 + k * 15) + k)) for x in range(0, W + 1, 40)]
        p.stroke(pts, w=1 - k * .2, col=GRAPHITE, op=.6 - k * .12, double=False, dash=f'{30 + k * 10} {8 + k * 6}')
    for _ in range(140):
        x = r.uniform(0, W); y = yb + r.uniform(4, 44)
        if r.random() < .55:
            p.raw(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r.uniform(1.2, 3.4):.1f}" stroke="#3E3B46" stroke-width=".7" opacity=".55"/>')
        else:
            p.curve((x, y), (x + 4, y - 6), (x + 10, y - 5), (x + 12, y), n=4, w=.8, op=.6, double=False)


def waves(p, y0, y1, n=4):
    """breaking waves in pencil: crests with curls, hatched faces"""
    r = p.r
    for k in range(n):
        y = y0 + (y1 - y0) * k / n
        x = r.uniform(-60, 40)
        while x < W:
            L = r.uniform(120, 220)
            crest = [(x + L * t, y - 10 * math.sin(math.pi * t) * (1 + .3 * k)) for t in [i / 8 for i in range(9)]]
            p.stroke(crest, w=1.3, op=.75, amp=.8, double=False)
            cx, cy = crest[3]
            p.curve((cx, cy), (cx + 10, cy - 12), (cx + 22, cy - 4), (cx + 14, cy + 4), n=6, w=1.0, op=.7, double=False)  # the curl
            p.hatch([crest[0], crest[4], crest[8], (crest[8][0], y + 10), (crest[0][0], y + 10)], angle=70, gap=4, op=.3)
            x += L + r.uniform(20, 70)


def sand(p, y0, y1=1000, dens=.5):
    """dry sand: stipple, ripple marks"""
    p.raw(f'<rect x="0" y="{y0}" width="{W}" height="{y1 - y0}" fill="url(#stip)" opacity="{dens:.2f}" stroke="none"/>')
    r = p.r
    for _ in range(int(60 * dens)):
        x = r.uniform(20, W - 60); y = r.uniform(y0 + 10, y1 - 10)
        p.curve((x, y), (x + 12, y - 3), (x + 24, y + 3), (x + 36, y), n=5, w=.7, col=SOFT, op=.4, double=False)


def footprints(p, path, step=34, s=1.0):
    """a trail of bare footprints along a list of points"""
    pts = []
    for a, b in zip(path, path[1:]):
        n = max(1, int(math.dist(a, b) / step))
        pts += [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, math.atan2(b[1] - a[1], b[0] - a[0])) for i in range(n)]
    for i, (x, y, ang) in enumerate(pts):
        side = 1 if i % 2 else -1
        nx, ny = -math.sin(ang) * 7 * side * s, math.cos(ang) * 7 * side * s
        sc = s * (.55 + .45 * (y / 1000))
        p.raw(f'<ellipse cx="{x + nx:.0f}" cy="{y + ny:.0f}" rx="{6 * sc:.1f}" ry="{3 * sc:.1f}" transform="rotate({math.degrees(ang):.0f} {x + nx:.0f} {y + ny:.0f})" '
              f'stroke="#3E3B46" stroke-width=".8" fill="#3E3B46" fill-opacity=".12" opacity=".6"/>')


def rock(p, x, y, s=1.0):
    r = p.r
    n = 7
    pts = [(x + math.cos(2 * math.pi * i / n) * s * r.uniform(22, 34), y - abs(math.sin(2 * math.pi * i / n)) * s * r.uniform(14, 26) + s * 6) for i in range(n)]
    p.poly(pts, w=1.4)
    p.hatch(pts[:4] + [(x, y + s * 6)], angle=60, gap=3.5, op=.45)
    p.hatch([(x - s * 30, y + s * 6), (x + s * 40, y + s * 6), (x + s * 54, y + s * 16), (x - s * 18, y + s * 16)], angle=0, gap=3, op=.35)  # cast shadow


def cliff(p, x0, x1, top, base, side='left'):
    """a cliff: a jagged top, a broken outer face that steps down to the beach, strata, cross-hatching, a rock fall"""
    r = p.r
    edge = [(x0, top + r.uniform(-10, 10))]
    x = x0
    while x < x1 - 40:
        x += r.uniform(20, 40); edge.append((x, top + r.uniform(-24, 20) + (x - x0) * .2))
    # the outer face: steps down and out toward the sea, ledge by ledge
    fx, fy = edge[-1]; face_pts = []
    while fy < base - 20:
        fx += r.uniform(6, 26); fy += r.uniform(40, 80); face_pts.append((fx, min(fy, base)))
        fx -= r.uniform(0, 10); face_pts.append((fx, min(fy + r.uniform(4, 10), base)))
    outline = edge + face_pts + [(face_pts[-1][0] + 30, base), (x0, base)]
    p.poly(outline, w=1.9)
    for k in range(1, 8):  # strata, following the top
        t = k / 8
        row = [(ex * (1 - t * .05), ey + (base - ey) * t + r.uniform(-4, 4)) for ex, ey in edge]
        p.stroke(row, w=.9, op=.5, amp=1.5, double=False)
    p.hatch(outline, angle=84, gap=5, op=.32)
    p.hatch(face_pts + [(x0 + (x1 - x0) * .6, base), (x0 + (x1 - x0) * .6, top + 60)], angle=-35, gap=6, op=.3)   # shade near the face
    for _ in range(12):  # cracks
        cx = r.uniform(x0 + 10, x1 - 30); cy = r.uniform(top + 40, base - 30)
        p.line((cx, cy), (cx + r.uniform(-8, 8), cy + r.uniform(16, 40)), n=3, w=.8, op=.6, double=False)
    for _ in range(6):  # a rock fall at the foot
        rock(p, face_pts[-1][0] + r.uniform(10, 120), base + r.uniform(-4, 30), r.uniform(.3, .6))


def dim(p, a, b, label, off=24, col=BLUE):
    """an architect's dimension line: extension lines, ticks, the measure"""
    ang = math.atan2(b[1] - a[1], b[0] - a[0]); nx, ny = -math.sin(ang) * off, math.cos(ang) * off
    A = (a[0] + nx, a[1] + ny); B = (b[0] + nx, b[1] + ny)
    p.line(a, (A[0] + nx * .25, A[1] + ny * .25), n=2, w=.7, col=col, op=.6, double=False)
    p.line(b, (B[0] + nx * .25, B[1] + ny * .25), n=2, w=.7, col=col, op=.6, double=False)
    p.line(A, B, n=2, w=.9, col=col, op=.75, double=False)
    for P in (A, B):  # 45-degree architect ticks
        p.raw(f'<path d="M{P[0] - 5:.0f} {P[1] + 5:.0f}L{P[0] + 5:.0f} {P[1] - 5:.0f}" stroke="{col}" stroke-width="1.3" opacity=".8"/>')
    mx, my = (A[0] + B[0]) / 2, (A[1] + B[1]) / 2
    deg = math.degrees(ang)
    if deg > 90 or deg < -90: deg += 180
    p.raw(f'<text x="{mx:.0f}" y="{my - 4:.0f}" font-family="ui-monospace,Menlo,monospace" font-size="12" fill="{col}" opacity=".85" text-anchor="middle" '
          f'transform="rotate({deg:.0f} {mx:.0f} {my:.0f})" stroke="none">{label}</text>')


def frame2(name, level, hz, yb, parts):
    fade = ('<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            '<stop offset=".08" stop-color="#fff" stop-opacity="1"/><stop offset=".9" stop-color="#fff" stop-opacity="1"/>'
            '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            f'<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>'
            '<linearGradient id="fadeh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            '<stop offset=".08" stop-color="#fff" stop-opacity="1"/><stop offset=".92" stop-color="#fff" stop-opacity="1"/>'
            '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            f'<mask id="mh" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="url(#fadeh)"/></mask>'
            f'<linearGradient id="parch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E3C8" stop-opacity=".55"/><stop offset="1" stop-color="#F6E9D3" stop-opacity=".25"/></linearGradient>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" aria-hidden="true">'
            f'<!-- WyattWorldWide worldscape: {name}. Digital wireframe above the boundary, pencil sketch below (level {level}). '
            f'Drawn by scripts/ww_scenes.py; mood only from Wyatt\'s reference. -->'
            f'<defs>{fade}{defs_for(level, yb)}</defs><g mask="url(#m)"><g mask="url(#mh)">'
            f'<rect y="{yb - 16}" width="{W}" height="{H - yb + 16}" fill="url(#parch)"/>'
            f'<g fill="none" stroke-linecap="round" stroke-linejoin="round">{"".join(parts)}</g></g></g></svg>')


# ---- tiles, top of the page (most digital) to the bottom (most real) -------------------------------------------------
def shore():
    """level 1, the hero: night synthwave above, the road and the shore in pencil below, the phone at the roadside"""
    L = 1.0; p = Pencil(1); hz, yb = 330, 470; vp = (600, hz)
    digital(p, hz, yb, L, vp, sun=(600, 150))
    boundary(p, hz, yb, L)
    waves(p, yb + 48, yb + 100, n=2)
    sand(p, yb + 110, dens=.55)
    # the road: pencil on the shore, a neon line where it runs on into the grid
    def road():
        p.line((470, 1000), vp, w=2.0); p.line((730, 1000), vp, w=2.0)
        p.hatch([(470, 1000), (600, hz + 2), (520, 1000)], angle=-60, gap=8, op=.28)
        p.hatch([(730, 1000), (600, hz + 2), (690, 1000)], angle=60, gap=12, op=.18)
        y = hz + 12
        while y < 990:
            t = (y - hz) / (1000 - hz); Ld = 6 + 46 * t; wd = 2 + 9 * t
            p.raw(f'<path d="M{600 - wd:.1f} {y:.1f}h{2 * wd:.1f}l{wd * .4:.1f} {Ld:.1f}h{-2.8 * wd:.1f}z" stroke="#3E3B46" stroke-width="1" opacity=".6"/>')
            y += Ld * 2.1
    both(p, yb, L, road)
    both(p, yb, L, lambda: palm(p, 390, 940, 500, lean=-.18, scale=1.15))
    both(p, yb, L, lambda: palm(p, 850, 900, 420, lean=.16, scale=1.0))
    footprints(p, [(430, 990), (445, 860), (470, 760), (520, 640)], s=1.0)
    rock(p, 260, 780, 1.1); rock(p, 300, 820, .6); rock(p, 1010, 760, .9)
    # the phone: a box in perspective, hatched side, cast shadow; its screen is the digital world again
    fx, fy, fw, fh = 700, 730, 96, 180
    p.poly([(fx, fy), (fx + fw, fy - 8), (fx + fw + 6, fy + fh - 10), (fx + 6, fy + fh)], w=1.8)
    p.poly([(fx + fw, fy - 8), (fx + fw + 18, fy + 4), (fx + fw + 24, fy + fh), (fx + fw + 6, fy + fh - 10)], w=1.2)
    p.hatch([(fx + fw, fy - 8), (fx + fw + 18, fy + 4), (fx + fw + 24, fy + fh), (fx + fw + 6, fy + fh - 10)], angle=80, gap=3, op=.6)
    p.hatch([(fx + fw, fy - 8), (fx + fw + 18, fy + 4), (fx + fw + 24, fy + fh), (fx + fw + 6, fy + fh - 10)], angle=-10, gap=5, op=.35)
    p.hatch([(fx + 6, fy + fh), (fx + fw + 24, fy + fh), (fx + fw + 90, fy + fh + 34), (fx + 50, fy + fh + 40)], angle=15, gap=4, op=.42)
    p.raw(f'<polygon points="{fx + 10},{fy + 12} {fx + fw - 10},{fy + 4} {fx + fw - 6},{fy + fh - 18} {fx + 14},{fy + fh - 10}" fill="{NIGHT}" fill-opacity=".85" stroke="none"/>')
    for k in range(5):  # a tiny grid on the screen
        y = fy + 40 + k * 22
        p.raw(f'<path d="M{fx + 14} {y + 4}L{fx + fw - 8} {y}" stroke="url(#neon)" stroke-width="1" opacity=".9"/>')
    for k in range(4):
        x = fx + 22 + k * 20
        p.raw(f'<path d="M{x} {fy + 30}L{x + 4} {fy + fh - 16}" stroke="url(#neon)" stroke-width=".8" opacity=".7"/>')
    # dimensions
    dim(p, (470, 985), (730, 985), '6.00 m', off=-16)
    dim(p, (fx - 4, fy + fh), (fx - 4, fy), '1.80', off=22)
    dim(p, (180, 940), (180, 470), '4.70', off=0)
    return frame2('the shoreline (hero)', L, hz, yb, p.parts)


def hut():
    """level .7: a daytime digital band above, the beach hut in detailed pencil below"""
    L = .7; p = Pencil(2); hz, yb = 250, 370; vl, vr = (-500, hz), (1700, hz)
    digital(p, hz, yb, L, (600, hz), sun=None)
    boundary(p, hz, yb, L)
    waves(p, yb + 46, yb + 80, n=2)
    sand(p, yb + 90, dens=.5)
    fx, gy, ey = 560, 770, 530
    tw = lambda pt, vp, t: (pt[0] + (vp[0] - pt[0]) * t, pt[1] + (vp[1] - pt[1]) * t)
    gl, el = tw((fx, gy), vl, .17), tw((fx, ey), vl, .17)
    gr, er = tw((fx, gy), vr, .16), tw((fx, ey), vr, .16)
    for a, b in [((fx, gy), (fx, ey)), (gl, el), (gr, er), ((fx, gy), gl), ((fx, gy), gr), ((fx, ey), el), ((fx, ey), er)]:
        p.line(a, b, w=2.0)
    for pt in [(fx, gy), (fx, ey), gl, gr]:
        p.construction(pt, vl if pt[0] <= fx else vr, op=.25); p.construction(pt, vr if pt[0] <= fx else vl, op=.15)
    ridge_f = ((fx + el[0]) / 2 - 10, ey - 120); ridge_b = tw(ridge_f, vr, .16)
    p.line((fx - 12, ey + 8), ridge_f, w=1.9); p.line(ridge_f, (el[0] - 10, el[1] + 6), w=1.9)
    p.line(ridge_f, ridge_b, w=1.7); p.line(ridge_b, (er[0] + 14, er[1] + 8), w=1.7); p.line((fx - 12, ey + 8), (er[0] + 14, er[1] + 8), w=1.5)
    roof = [ridge_f, ridge_b, (er[0] + 14, er[1] + 8), (fx - 12, ey + 8)]
    p.hatch(roof, angle=-20, gap=6, op=.35)
    for k in range(1, 7):  # shingle rows
        t = k / 7
        a = (ridge_f[0] + ((fx - 12) - ridge_f[0]) * t, ridge_f[1] + ((ey + 8) - ridge_f[1]) * t)
        b = (ridge_b[0] + ((er[0] + 14) - ridge_b[0]) * t, ridge_b[1] + ((er[1] + 8) - ridge_b[1]) * t)
        p.line(a, b, w=.8, op=.55, double=False)
    p.hatch([(fx - 12, ey + 8), ridge_f, (el[0] - 10, el[1] + 6)], angle=40, gap=8, op=.2)  # gable
    for k in range(1, 10):  # planks, right face
        t = k / 10; a = (fx, gy - (gy - ey) * t); p.line(a, tw(a, vr, .16), w=.8, op=.55, double=False)
    for k in range(1, 8):  # planks, left face (shaded): vertical boards
        t = k / 8; a = tw((fx, gy), vl, .17 * t); b = tw((fx, ey), vl, .17 * t); p.line(a, b, w=.7, op=.5, double=False)
    p.hatch([(fx, gy), gl, el, (fx, ey)], angle=75, gap=4, op=.4)
    d1, d2 = tw((fx, gy), vl, .05), tw((fx, gy), vl, .12)
    p.poly([d1, (d1[0], d1[1] - 150), (d2[0], d2[1] - 138), d2], close=False, w=1.5)
    p.hatch([d1, (d1[0], d1[1] - 150), (d2[0], d2[1] - 138), d2], angle=90, gap=3, op=.45)
    p.circle(d2[0] - 6, d2[1] - 70, 2.5, n=8, w=1, double=False)  # door knob
    w1, w2 = tw((fx, 600), vr, .04), tw((fx, 600), vr, .11)
    p.poly([w1, w2, (w2[0], w2[1] + 58), (w1[0], w1[1] + 60)], w=1.3)
    p.line(((w1[0] + w2[0]) / 2, (w1[1] + w2[1]) / 2), ((w1[0] + w2[0]) / 2, (w1[1] + w2[1]) / 2 + 59), n=2, w=.9, double=False)
    p.raw(f'<polygon points="{w1[0]:.0f},{w1[1]:.0f} {w2[0]:.0f},{w2[1]:.0f} {w2[0]:.0f},{w2[1] + 58:.0f} {w1[0]:.0f},{w1[1] + 60:.0f}" fill="{WASH[1]}" fill-opacity=".28" stroke="none"/>')
    for k in range(3):  # steps
        p.line((fx - 60 + k * 6, gy + 12 + k * 14), (fx + 70 - k * 4, gy + 8 + k * 14), w=1.3)
    p.hatch([(fx, gy), gr, (gr[0] + 120, gr[1] + 40), (fx + 120, gy + 40)], angle=0, gap=4, op=.3)
    # a surfboard leaning on the hut: the pastel accent
    sb = [(fx + 150, gy + 2), (fx + 132, gy - 170), (fx + 146, gy - 200), (fx + 162, gy - 170)]
    p.raw(f'<path d="M{sb[0][0]} {sb[0][1]}Q{sb[1][0] - 14} {sb[1][1]} {sb[2][0]} {sb[2][1]}Q{sb[3][0] + 14} {sb[3][1]} {sb[0][0]} {sb[0][1]}Z" fill="{WASH[2]}" fill-opacity=".35" stroke="#3E3B46" stroke-width="1.5"/>')
    p.line((fx + 148, gy - 4), (fx + 146, gy - 190), w=.8, op=.6, double=False)
    both(p, yb, L, lambda: palm(p, 900, 810, 430, lean=-.12, scale=1.0))
    both(p, yb, L, lambda: palm(p, 250, 720, 330, lean=.15, scale=.85))
    footprints(p, [(380, 990), (420, 900), (470, 830), (500, 790)], s=.9)
    rock(p, 760, 880, .9); rock(p, 160, 900, .7)
    dim(p, (fx, gy + 52), gr, '2.40', off=26); dim(p, gl, (fx, gy + 0), '2.10', off=34)
    dim(p, (gr[0] + 20, gr[1]), (er[0] + 20, er[1]), '2.80', off=14)
    return frame2('the beach hut', L, hz, yb, p.parts)


def stall():
    """level .5: the boardwalk runs out of the grid into pencil; the stall in the same one-point perspective"""
    L = .5; p = Pencil(3); hz, yb = 230, 330; vp = (760, hz)
    digital(p, hz, yb, L, vp)
    boundary(p, hz, yb, L)
    sand(p, yb + 60, dens=.45)
    def walk():
        p.line((560, 1000), vp, w=2.0); p.line((1140, 1000), vp, w=2.0)
        y = hz + 6
        while y < 1000:
            t = (y - hz) / (1000 - hz)
            xl = vp[0] + (560 - vp[0]) * t; xr = vp[0] + (1140 - vp[0]) * t
            p.line((xl, y), (xr, y), n=4, w=.7 + 1.0 * t, op=.65, double=False)
            p.line((xl, y + 3 + 6 * t), (xr, y + 3 + 6 * t), n=4, w=.5, op=.3, double=False)
            y += 4 + 40 * t
        for t in (.2, .35, .55, .8, 1.0):
            for edge in (560, 1140):
                x = vp[0] + (edge - vp[0]) * t; ybb = hz + (1000 - hz) * t
                p.line((x, ybb), (x, ybb - 90 * t), w=1.0 + t, op=.75)
                p.hatch([(x, ybb), (x + 4 * t, ybb), (x + 4 * t, ybb - 90 * t), (x, ybb - 90 * t)], angle=90, gap=2, op=.5)
        p.line((vp[0] + (560 - vp[0]) * .2, hz + (1000 - hz) * .2 - 18), (560, 1000 - 90), w=1.0, op=.6)  # rope rail
        p.line((vp[0] + (1140 - vp[0]) * .2, hz + (1000 - hz) * .2 - 18), (1140, 1000 - 90), w=1.0, op=.6)
    both(p, yb, L, walk)
    tvp = lambda pt, t: (pt[0] + (vp[0] - pt[0]) * t, pt[1] + (vp[1] - pt[1]) * t)
    x0, x1, ybs, yc, yr = 150, 420, 820, 680, 520
    D = .16
    fb_l, fb_r, fc_l, fc_r = (x0, ybs), (x1, ybs), (x0, yc), (x1, yc)
    sb_r, sc_r = tvp(fb_r, D), tvp(fc_r, D)
    for a_, b_ in [(fb_l, fb_r), (fb_l, fc_l), (fb_r, fc_r), (fc_l, fc_r), (fb_r, sb_r), (fc_r, sc_r), (sb_r, sc_r)]:
        p.line(a_, b_, w=2.0)
    p.hatch([fb_r, sb_r, sc_r, fc_r], angle=80, gap=3, op=.55)
    p.hatch([fb_l, fb_r, fc_r, fc_l], angle=-45, gap=9, op=.22)
    for k in range(1, 6):  # counter boards
        y = yc + (ybs - yc) * k / 6; p.line((x0, y), (x1, y), w=.7, op=.5, double=False)
    for pt in (fb_r, fc_r, fb_l, fc_l):
        p.construction(pt, vp, op=.22)
    pr_l, pr_r = (x0, yr), (x1, yr)
    p.line(fc_l, pr_l, w=1.6); p.line(fc_r, pr_r, w=1.6); p.line(sc_r, tvp(pr_r, D), w=1.1, op=.7)
    a_fl, a_fr = (x0 - 24, yr + 26), (x1 + 24, yr + 26)
    a_bl, a_br = tvp((x0 - 24, yr - 40), D), tvp((x1 + 24, yr - 40), D)
    p.poly([a_fl, a_fr, a_br, a_bl], w=1.8)
    for k in range(7):
        t0, t1 = k / 7, (k + 1) / 7
        f0 = (a_fl[0] + (a_fr[0] - a_fl[0]) * t0, a_fl[1]); f1 = (a_fl[0] + (a_fr[0] - a_fl[0]) * t1, a_fl[1])
        b0 = (a_bl[0] + (a_br[0] - a_bl[0]) * t0, a_bl[1] + (a_br[1] - a_bl[1]) * t0); b1 = (a_bl[0] + (a_br[0] - a_bl[0]) * t1, a_bl[1] + (a_br[1] - a_bl[1]) * t1)
        if k % 2 == 0:
            p.raw(f'<polygon points="{f0[0]:.0f},{f0[1]:.0f} {f1[0]:.0f},{f1[1]:.0f} {b1[0]:.0f},{b1[1]:.0f} {b0[0]:.0f},{b0[1]:.0f}" fill="{WASH[2]}" fill-opacity=".32" stroke="none"/>')
            p.hatch([f0, f1, b1, b0], angle=-70, gap=5, op=.2)
        p.line(f1, b1, w=.9, op=.6, double=False)
    for k in range(7):
        xa = a_fl[0] + (a_fr[0] - a_fl[0]) * k / 7; xb = a_fl[0] + (a_fr[0] - a_fl[0]) * (k + 1) / 7
        p.curve((xa, a_fl[1]), (xa + 4, a_fl[1] + 18), (xb - 4, a_fl[1] + 18), (xb, a_fl[1]), n=6, w=1.1, op=.7, double=False)
    for k in range(9):  # string lights under the awning
        x = a_fl[0] + 20 + k * 36; y = a_fl[1] + 30 + 8 * math.sin(k / 8 * math.pi)
        p.raw(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3" fill="#FFD23F" fill-opacity=".5" stroke="#3E3B46" stroke-width=".8"/>')
    for k in range(3):
        p.raw(f'<rect x="{x0 + 30 + k * 76}" y="{yc - 18 - (k % 2) * 6}" width="56" height="16" rx="2" fill="{WASH[k % 3 + 1]}" fill-opacity=".38" stroke="#3E3B46" stroke-width="1.1" opacity=".85"/>')
    for k, (cx, cy) in enumerate([(x1 + 40, ybs - 10), (x1 + 80, ybs + 10)]):  # crates
        p.poly([(cx, cy), (cx + 50, cy), (cx + 50, cy - 44), (cx, cy - 44)], w=1.3)
        p.line((cx, cy), (cx + 50, cy - 44), w=.8, op=.6, double=False); p.line((cx + 50, cy), (cx, cy - 44), w=.8, op=.6, double=False)
        p.hatch([(cx + 50, cy), (cx + 62, cy - 8), (cx + 62, cy - 52), (cx + 50, cy - 44)], angle=90, gap=3, op=.5)
        p.poly([(cx + 50, cy), (cx + 62, cy - 8), (cx + 62, cy - 52), (cx + 50, cy - 44)], w=1.1)
    p.hatch([fb_l, fb_r, (x1 - 20, ybs + 50), (x0 - 70, ybs + 46)], angle=10, gap=4, op=.36)
    both(p, yb, L, lambda: palm(p, 500, 700, 330, lean=.1, scale=.85))
    footprints(p, [(120, 990), (160, 930), (210, 860)], s=.9)
    rock(p, 80, 760, .8)
    dim(p, fb_l, fb_r, '2.70', off=34); dim(p, (x0 - 30, ybs), (x0 - 30, yr), '3.00', off=0)
    dim(p, (vp[0] + (560 - vp[0]) * .7, hz + (1000 - hz) * .7), (vp[0] + (1140 - vp[0]) * .7, hz + (1000 - hz) * .7), '3.20', off=-14)
    return frame2('the boardwalk stall', L, hz, yb, p.parts)


def tower():
    """level .35: a thin digital band; a cliff and the lifeguard tower in pencil, waves breaking below"""
    L = .35; p = Pencil(4); hz, yb = 270, 360
    digital(p, hz, yb, L, (600, hz), sun=(980, 70))
    boundary(p, hz, yb, L)
    waves(p, yb + 44, yb + 120, n=3)
    sand(p, yb + 130, dens=.5)
    both(p, yb, L, lambda: cliff(p, 0, 250, 300, 760, side='left'))
    cx, base, top = 600, 900, 580
    legs = [(cx - 110, base), (cx + 110, base - 10), (cx - 70, base - 60), (cx + 70, base - 66)]
    for (x, y) in legs:
        p.line((x, y), (cx + (x - cx) * .55, top + 10), w=2.0 if y > base - 30 else 1.2, op=.85 if y > base - 30 else .55)
        p.hatch([(x, y), (x + 6, y), (cx + (x - cx) * .55 + 6, top + 10), (cx + (x - cx) * .55, top + 10)], angle=90, gap=2, op=.45)
    for yy, ww in [(base - 120, 95), (base - 230, 80)]:
        p.line((cx - ww, yy), (cx + ww, yy - 8), w=1.2)
    p.line((cx - 95, base - 120), (cx + 80, base - 236), w=.9, op=.6); p.line((cx + 95, base - 128), (cx - 80, base - 236), w=.9, op=.6)
    p.line((cx - 80, base - 230), (cx + 60, top + 14), w=.8, op=.5); p.line((cx + 80, base - 238), (cx - 60, top + 14), w=.8, op=.5)
    cab = [(cx - 110, top), (cx + 110, top - 6), (cx + 110, top - 120), (cx - 110, top - 114)]
    p.poly(cab, w=2.0)
    for k in range(1, 6):
        p.line((cx - 110, top - 114 + 22 * k), (cx + 110, top - 120 + 22 * k), w=.7, op=.45, double=False)
    p.poly([(cx + 110, top - 6), (cx + 150, top - 30), (cx + 150, top - 140), (cx + 110, top - 120)], w=1.4)
    p.hatch([(cx + 110, top - 6), (cx + 150, top - 30), (cx + 150, top - 140), (cx + 110, top - 120)], angle=80, gap=3, op=.5)
    p.raw(f'<polygon points="{cx - 80},{top - 95} {cx + 80},{top - 99} {cx + 80},{top - 45} {cx - 80},{top - 41}" fill="{WASH[0]}" fill-opacity=".3" stroke="#3E3B46" stroke-width="1.3" opacity=".8"/>')
    p.poly([(cx - 135, top - 112), (cx, top - 175), (cx + 175, top - 140), (cx + 135, top - 118)], w=1.8)
    p.hatch([(cx - 135, top - 112), (cx, top - 175), (cx + 175, top - 140), (cx + 135, top - 118)], angle=-15, gap=5, op=.35)
    p.line((cx, top - 175), (cx, top - 280), w=1.4)
    p.poly([(cx, top - 280), (cx + 70, top - 262), (cx, top - 240)], close=False, w=1.3)
    p.raw(f'<polygon points="{cx},{top - 280} {cx + 70},{top - 262} {cx},{top - 240}" fill="{WASH[2]}" fill-opacity=".4" stroke="none"/>')
    p.raw(f'<circle cx="{cx - 60}" cy="{top - 66}" r="20" fill="none" stroke="{WASH[2]}" stroke-width="9" opacity=".55"/>'
          f'<circle cx="{cx - 60}" cy="{top - 66}" r="25" stroke="#3E3B46" stroke-width="1.2"/><circle cx="{cx - 60}" cy="{top - 66}" r="15" stroke="#3E3B46" stroke-width="1.2"/>')
    p.line((cx - 30, base + 20), (cx - 60, top), w=1.3); p.line((cx + 10, base + 22), (cx - 20, top), w=1.3)
    for k in range(1, 10):
        t = k / 10
        p.line((cx - 30 + (-30) * t, base + 20 - (base + 20 - top) * t), (cx + 10 + (-30) * t, base + 22 - (base + 22 - top) * t), n=2, w=1.0, double=False)
    p.hatch([(cx - 120, base + 4), (cx + 120, base - 6), (cx + 220, base + 40), (cx - 40, base + 50)], angle=8, gap=4, op=.3)
    both(p, yb, L, lambda: palm(p, 1060, 900, 320, lean=-.1, scale=.85))
    footprints(p, [(760, 990), (720, 940), (660, 920)], s=1.0)
    rock(p, 300, 860, 1.2); rock(p, 360, 900, .6); rock(p, 900, 820, .8)
    dim(p, (cx - 110, base + 30), (cx + 110, base + 22), '2.20', off=18)
    dim(p, (cx + 190, base), (cx + 190, top - 175), '4.20', off=0)
    dim(p, (60, 760), (60, 300), '12.5 m', off=0)
    return frame2('the lifeguard tower', L, hz, yb, p.parts)


def dunes():
    """level .15: almost all real. A trace of grid at the horizon, then dunes, fence, grass, a towel and a sign"""
    L = .15; p = Pencil(5); hz, yb = 240, 300; vp = (900, hz)
    digital(p, hz, yb, L, vp, peaks=False)
    boundary(p, hz, yb, L)
    sand(p, yb + 40, dens=.55)
    for k, y in enumerate([420, 560, 720]):
        pts = [(x, y + 40 * math.sin(x / (160 + k * 40) + k) + p.r.uniform(-3, 3)) for x in range(0, W + 1, 50)]
        p.stroke(pts, w=1.3 + k * .3, op=.6 + k * .1)
        shade = pts + [(W, y + 60), (0, y + 60)]
        p.hatch(shade, angle=-70 + k * 10, gap=6, op=.18 + k * .05)
    for t in [i / 10 for i in range(1, 11)]:
        x = vp[0] + (80 - vp[0]) * t; ybb = hz + (900 - hz) * t
        p.line((x, ybb), (x - 4, ybb - 120 * t), w=.8 + 1.2 * t, op=.75)
        if t > .1:
            tp = t - .1; xp = vp[0] + (80 - vp[0]) * tp; ybp = hz + (900 - hz) * tp
            p.line((xp - 2, ybp - 80 * tp), (x - 3, ybb - 80 * t), n=3, w=.8, op=.5, double=False)
            p.line((xp - 2, ybp - 40 * tp), (x - 3, ybb - 40 * t), n=3, w=.7, op=.4, double=False)
    p.construction(vp, (80, 900), op=.25)
    for _ in range(40):
        x = p.r.uniform(40, W - 40); y = p.r.uniform(430, 960)
        for b in range(5):
            p.line((x, y), (x + p.r.uniform(-16, 16), y - p.r.uniform(18, 40)), n=2, w=.9, op=.55, double=False)
    tw_ = [(470, 790), (650, 770), (690, 840), (480, 868)]
    p.poly(tw_, w=1.5)
    for k in range(5):
        t0, t1 = k / 5, (k + 1) / 5
        q = lambda a_, b_, t: (a_[0] + (b_[0] - a_[0]) * t, a_[1] + (b_[1] - a_[1]) * t)
        a0, a1, b0, b1 = q(tw_[0], tw_[1], t0), q(tw_[0], tw_[1], t1), q(tw_[3], tw_[2], t0), q(tw_[3], tw_[2], t1)
        if k % 2 == 0:
            p.raw(f'<polygon points="{a0[0]:.0f},{a0[1]:.0f} {a1[0]:.0f},{a1[1]:.0f} {b1[0]:.0f},{b1[1]:.0f} {b0[0]:.0f},{b0[1]:.0f}" fill="{WASH[1]}" fill-opacity=".38" stroke="none"/>')
        p.line(a1, b1, w=.9, op=.6, double=False)
    p.line((760, 860), (764, 700), w=1.6); p.poly([(738, 700), (830, 692), (834, 730), (742, 738)], w=1.4)
    p.hatch([(764, 860), (800, 880), (806, 872), (768, 856)], angle=0, gap=3, op=.35)
    both(p, yb, L, lambda: palm(p, 700, 640, 260, lean=.1, scale=.7))
    footprints(p, [(1100, 990), (980, 900), (860, 860), (720, 850)], s=.9)
    rock(p, 300, 900, 1.0); rock(p, 1000, 700, .7)
    dim(p, tw_[3], tw_[2], '1.80', off=20)
    return frame2('the dunes', L, hz, yb, p.parts)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in [('shore', shore), ('hut', hut), ('stall', stall), ('tower', tower), ('dunes', dunes)]:
        svg = fn()
        (OUT / f'{name}.svg').write_text(svg)
        print(f'wrote ww/scene/{name}.svg ({len(svg) // 1024} KB)')


if __name__ == '__main__':
    main()
