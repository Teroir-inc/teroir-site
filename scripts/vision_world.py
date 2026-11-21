#!/usr/bin/env python3
"""teroir.com/vision: the Teroir world (investors and partners, due 11-27). One tall drawing: the digital agent world on
top (wireframe, customers' agents and Teroir's agents, data), .BOS as the glowing boundary, and the real world below in
pencil (a co-living house, a vendor's van, the owner's phone, the records). The path one request takes is drawn in
as <path id="route">, so the page can move the request along it. Same visual language as the wyattworldwide.com
worldscape (scripts/ww_scenes.py: pencil engine, wobble, hatching), in teroir.com's palette.

    python3 scripts/vision_world.py      # writes vision/world.svg

$0, in-house, deterministic (seeded). No text in the drawing: labels and cards are HTML on the page.
"""
from pathlib import Path
import math
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ww_scenes as S          # Pencil, hatch, wobble; the pencil look is shared with wyattworldwide.com

OUT = Path(__file__).resolve().parent.parent / 'vision' / 'world.svg'
W, H = 800, 2600
B = 1000                       # the boundary (.BOS) runs at this height
# palette: the brand sheet's boundary "sketch_variant" (palette.json), so /vision, the tour reel and
# wyattworldwide.com read as one world (pipeline-35 art direction, 11-21)
INK = '#3E3B46'                # graphite
SOFT = '#6B6773'
EMBER = '#FF2BD6'              # Horizon neon pink (the far end of the neon)
TEAL = '#00E5FF'               # Horizon neon cyan
NIGHT = '#140A2E'
CORAL = '#FF8A7A'              # the one v5 pastel accent (the request's paper state, the windows)
S.GRAPHITE, S.SOFT = INK, SOFT  # the pencil engine draws in teroir green

# where things are (also used by the page: keep in step with vision.js STOPS)
CUST = (150, 260)              # a customer's agent
TER = (640, 330)               # Teroir's agents
INBOX = (210, B)               # .BOS parts on the boundary
RULES = (400, B)
HANDOFF = (590, B)
PHONE = (600, 1300)            # the owner's phone
VAN = (220, 1640)              # the vendor's van
HOUSE = (560, 1980)            # the co-living house
RECORDS = (190, 2330)          # the records


def digital(p):
    r = p.r
    p.raw(f'<linearGradient id="vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{NIGHT}"/><stop offset=".6" stop-color="#3A1252"/>'
          f'<stop offset="1" stop-color="#7A1D78"/></linearGradient><rect width="{W}" height="{B}" fill="url(#vsky)" stroke="none"/>'
          f'<linearGradient id="vline" x1="0" x2="1"><stop offset="0" stop-color="{TEAL}"/><stop offset="1" stop-color="{EMBER}"/></linearGradient>')
    vp = (W / 2, 560)
    for k in range(1, 9):   # the sky grid (a ceiling) and the floor grid running to the boundary
        y = 560 * (1 - (k / 9) ** 1.6)
        p.raw(f'<path d="M0 {y:.0f}H{W}" stroke="url(#vline)" stroke-width=".7" opacity=".25"/>')
    for x in range(-800, 1601, 100):
        p.raw(f'<path d="M{vp[0]} {vp[1]}L{x} -40" stroke="url(#vline)" stroke-width=".6" opacity=".18"/>')
    for k in range(1, 12):
        t = (k / 12) ** 1.8; y = 560 + (B - 560) * t
        p.raw(f'<path d="M0 {y:.0f}H{W}" stroke="url(#vline)" stroke-width="{.6 + t:.1f}" opacity="{.25 + .45 * t:.2f}"/>')
    for x in range(-1600, 2401, 80):
        p.raw(f'<path d="M{vp[0]} {vp[1]}L{x} {B + 400}" stroke="url(#vline)" stroke-width=".7" opacity=".35"/>')
    p.raw(f'<rect x="0" y="548" width="{W}" height="24" fill="{TEAL}" opacity=".12" stroke="none"/>')
    # stars and data
    for _ in range(40):
        p.raw(f'<circle cx="{r.uniform(10, W - 10):.0f}" cy="{r.uniform(10, 520):.0f}" r="{r.uniform(.8, 2):.1f}" fill="#F2E9FF" opacity="{r.uniform(.3, .8):.2f}" stroke="none"/>')
    for _ in range(6):
        x = r.choice([r.uniform(20, 120), r.uniform(690, 780)]); y0 = r.uniform(40, 420)
        p.raw(f'<text x="{x:.0f}" y="{y0:.0f}" font-family="ui-monospace,Menlo,monospace" font-size="11" fill="{TEAL}" opacity=".45" writing-mode="tb" letter-spacing="3" stroke="none">'
              f'{"".join(r.choice("01") for _ in range(12))}</text>')
    # customers' agents: wireframe figures, left; Teroir's agents: hexagon cores, right; links between them
    custs = [CUST, (90, 420), (260, 160), (300, 400)]
    for i, (x, y) in enumerate(custs):
        s = 1.25 if i == 0 else .8
        p.raw(f'<g stroke="{TEAL}" fill="none" opacity="{.95 if i == 0 else .6}"><circle cx="{x}" cy="{y - 26 * s:.0f}" r="{12 * s:.0f}" stroke-width="1.6"/>'
              f'<path d="M{x} {y - 12 * s:.0f}L{x + 20 * s:.0f} {y + 10 * s:.0f}L{x} {y + 34 * s:.0f}L{x - 20 * s:.0f} {y + 10 * s:.0f}Z M{x - 20 * s:.0f} {y + 10 * s:.0f}H{x + 20 * s:.0f} M{x} {y - 12 * s:.0f}V{y + 34 * s:.0f}" stroke-width="1.2"/>'
              f'<ellipse cx="{x}" cy="{y + 46 * s:.0f}" rx="{26 * s:.0f}" ry="{6 * s:.0f}" stroke-width=".8" opacity=".6"/></g>')
    ters = [TER, (560, 180), (720, 470), (470, 450)]
    for i, (x, y) in enumerate(ters):
        s = 1.3 if i == 0 else .8
        pts = ' '.join(f'{x + 26 * s * math.cos(math.radians(60 * k + 30)):.0f},{y + 26 * s * math.sin(math.radians(60 * k + 30)):.0f}' for k in range(6))
        inner = ' '.join(f'{x + 13 * s * math.cos(math.radians(60 * k)):.0f},{y + 13 * s * math.sin(math.radians(60 * k)):.0f}' for k in range(6))
        p.raw(f'<g stroke="{EMBER}" fill="none" opacity="{.95 if i == 0 else .6}"><polygon points="{pts}" stroke-width="1.6"/><polygon points="{inner}" stroke-width="1"/>'
              f'<path d="M{x} {y - 26 * s:.0f}V{y + 26 * s:.0f}" stroke-width=".7"/><circle cx="{x}" cy="{y}" r="{3 * s:.1f}" fill="{EMBER}"/></g>')
    for a in custs:
        for b in ters:
            if r.random() < .5:
                p.raw(f'<path d="M{a[0]} {a[1]}Q{(a[0] + b[0]) / 2} {min(a[1], b[1]) - 60} {b[0]} {b[1]}" stroke="url(#vline)" stroke-width=".8" opacity=".35" stroke-dasharray="3 6"/>')


def boundary(p):
    """.BOS: a glowing layer at the horizon of the real world, with the parts as nodes; below it the grid turns pencil"""
    p.raw(f'<linearGradient id="bos" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{TEAL}" stop-opacity="0"/>'
          f'<stop offset=".5" stop-color="{TEAL}" stop-opacity=".55"/><stop offset="1" stop-color="{EMBER}" stop-opacity="0"/></linearGradient>'
          f'<rect x="0" y="{B - 46}" width="{W}" height="92" fill="url(#bos)" stroke="none"/>'
          f'<path d="M0 {B}H{W}" stroke="{TEAL}" stroke-width="3"/><path d="M0 {B + 6}H{W}" stroke="{EMBER}" stroke-width="1.2" opacity=".8"/>')
    for (x, y) in (INBOX, RULES, HANDOFF):
        p.raw(f'<circle cx="{x}" cy="{y}" r="18" fill="{NIGHT}" stroke="{TEAL}" stroke-width="2"/><circle cx="{x}" cy="{y}" r="7" fill="{TEAL}"/>')
    # the grid turns to pencil: rays carry on below as broken graphite, fading
    vp = (W / 2, 560)
    for x in range(-1600, 2401, 80):
        fx = lambda yy: vp[0] + (x - vp[0]) * (yy - vp[1]) / (B + 400 - vp[1])
        for k in range(3):
            ya, yb = B + 14 + k * 18, B + 26 + k * 18
            if 0 < fx(ya) < W:
                p.line((fx(ya), ya), (fx(yb), yb), n=2, w=.8, op=.45 - k * .13, double=False)
    for _ in range(70):   # binary turning to pencil dots
        x = p.r.uniform(0, W); y = B + p.r.uniform(-24, 30)
        col = TEAL if y < B else INK
        p.raw(f'<text x="{x:.0f}" y="{y:.0f}" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="{col}" opacity="{.6 if col == TEAL else .3}" stroke="none">'
              f'{"".join(p.r.choice("01") for _ in range(p.r.randint(2, 5)))}</text>')


def house(p, x, y):
    """a two-storey co-living house in two-point perspective: rooms, windows, a porch, steps, hatched shade"""
    vl, vr = (-900, 1080), (1700, 1080)
    tw = lambda pt, vp, t: (pt[0] + (vp[0] - pt[0]) * t, pt[1] + (vp[1] - pt[1]) * t)
    g, e = (x, y), (x, y - 260)
    gl, el = tw(g, vl, .22), tw(e, vl, .22)
    gr, er = tw(g, vr, .2), tw(e, vr, .2)
    for a, b in [(g, e), (gl, el), (gr, er), (g, gl), (g, gr), (e, el), (e, er)]:
        p.line(a, b, w=2.1)
    for pt in (g, e, gl, gr):
        p.construction(pt, vl if pt[0] <= x else vr, op=.22)
    ridge = ((x + el[0]) / 2, e[1] - 130); ridge_b = tw(ridge, vr, .2)
    p.poly([(x + 10, e[1] + 6), ridge, (el[0] - 10, el[1] + 6)], close=False, w=2)
    p.line(ridge, ridge_b, w=1.8); p.line(ridge_b, (er[0] + 12, er[1] + 6), w=1.8); p.line((x + 10, e[1] + 6), (er[0] + 12, er[1] + 6), w=1.6)
    p.hatch([ridge, ridge_b, (er[0] + 12, er[1] + 6), (x + 10, e[1] + 6)], angle=-20, gap=6, op=.35)
    p.hatch([g, gl, el, e], angle=78, gap=4, op=.38)          # the shaded face
    mid = (g[1] + e[1]) / 2
    p.line((x, mid), tw((x, mid), vr, .2), w=1.1, op=.7); p.line((x, mid), tw((x, mid), vl, .22), w=1.1, op=.6)  # floor line
    for row in (0, 1):            # six windows on the right face: the rooms
        for c in range(3):
            t0, t1 = .025 + c * .062, .065 + c * .062
            top = g[1] - 100 - row * 130
            a, b2 = tw((x, top), vr, t0), tw((x, top), vr, t1)
            quad = [a, b2, (b2[0], b2[1] + 60), (a[0], a[1] + 62)]
            p.poly(quad, w=1.2)
            p.raw(f'<polygon points="{" ".join(f"{q[0]:.0f},{q[1]:.0f}" for q in quad)}" fill="#FFC8A2" fill-opacity=".45" stroke="none"/>')
            p.line(((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2), ((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2 + 61), n=2, w=.7, double=False)
    d1, d2 = tw(g, vl, .06), tw(g, vl, .13)          # the front door + porch
    p.poly([d1, (d1[0], d1[1] - 110), (d2[0], d2[1] - 104), d2], close=False, w=1.5)
    p.hatch([d1, (d1[0], d1[1] - 110), (d2[0], d2[1] - 104), d2], angle=90, gap=3, op=.45)
    for k in range(3):
        p.line((d1[0] + 12 - k * 4, g[1] + 10 + k * 12), (d2[0] - 20 - k * 4, d2[1] + 10 + k * 12), w=1.2)
    p.hatch([g, gr, (gr[0] + 140, gr[1] + 40), (x + 140, g[1] + 46)], angle=0, gap=4, op=.3)   # cast shadow


def van(p, x, y):
    """the vendor's box van, in perspective, with a job card on the dash"""
    body = [(x - 120, y), (x + 70, y), (x + 70, y - 110), (x - 120, y - 110)]
    cab = [(x + 70, y), (x + 140, y), (x + 140, y - 60), (x + 110, y - 90), (x + 70, y - 90)]
    side = [(x + 140, y), (x + 170, y - 18), (x + 170, y - 72), (x + 140, y - 60)]
    p.poly(body, w=2); p.poly(cab, w=2); p.poly(side, w=1.4)
    p.line((x - 120, y - 110), (x - 92, y - 128), w=1.4); p.line((x - 92, y - 128), (x + 98, y - 128), w=1.4); p.line((x + 98, y - 128), (x + 70, y - 110), w=1.4)
    p.hatch(side, angle=80, gap=3, op=.5); p.hatch([(x - 120, y - 110), (x - 92, y - 128), (x + 98, y - 128), (x + 70, y - 110)], angle=0, gap=4, op=.3)
    p.poly([(x + 82, y - 82), (x + 106, y - 82), (x + 128, y - 58), (x + 82, y - 58)], w=1.1)       # windscreen
    p.raw(f'<rect x="{x - 90}" y="{y - 82}" width="120" height="44" rx="6" fill="#FFC8A2" fill-opacity=".45" stroke="{INK}" stroke-width="1.2"/>')  # job card panel
    for k in range(3):
        p.line((x - 80, y - 72 + k * 12), (x - 80 + [90, 70, 50][k], y - 72 + k * 12), n=2, w=1.2, col=EMBER, double=False)
    for cx in (x - 80, x + 100):
        p.circle(cx, y, 20, n=18, w=1.8); p.circle(cx, y, 8, n=10, w=1, double=False)
    p.hatch([(x - 140, y + 6), (x + 180, y + 6), (x + 220, y + 26), (x - 100, y + 26)], angle=0, gap=3, op=.3)


def phone(p, x, y):
    """the owner's phone, held up: a job card waiting for one tap"""
    fw, fh = 150, 290
    fx, fy = x - fw / 2, y - fh / 2
    p.raw(f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="24" fill="#F6F4EE" stroke="{INK}" stroke-width="2.4"/>')
    p.poly([(fx + fw, fy + 16), (fx + fw + 16, fy + 28), (fx + fw + 16, fy + fh + 6), (fx + fw, fy + fh - 10)], w=1.4)
    p.hatch([(fx + fw, fy + 16), (fx + fw + 16, fy + 28), (fx + fw + 16, fy + fh + 6), (fx + fw, fy + fh - 10)], angle=80, gap=3, op=.5)
    p.raw(f'<rect x="{fx + 14}" y="{fy + 40}" width="{fw - 28}" height="96" rx="10" fill="#fff" stroke="{INK}" stroke-width="1.2"/>'
          f'<rect x="{fx + 26}" y="{fy + 52}" width="60" height="8" rx="4" fill="{SOFT}" opacity=".5"/>'
          f'<rect x="{fx + 26}" y="{fy + 68}" width="90" height="10" rx="5" fill="{INK}"/>'
          f'<rect x="{fx + 26}" y="{fy + 104}" width="46" height="22" rx="8" fill="{INK}"/><rect x="{fx + 78}" y="{fy + 104}" width="46" height="22" rx="8" fill="none" stroke="{INK}" stroke-width="1"/>')
    p.raw(f'<circle cx="{x}" cy="{fy + fh - 18}" r="5" fill="none" stroke="{INK}" stroke-width="1.2"/>')
    p.hatch([(fx + 10, fy + fh + 14), (fx + fw + 40, fy + fh + 10), (fx + fw + 70, fy + fh + 30), (fx + 30, fy + fh + 34)], angle=0, gap=3, op=.3)


def records(p, x, y):
    """the records: a pencil desk the record cards land on (the cards themselves are on the page, so they stay readable)"""
    top = [(x - 150, y - 20), (x + 170, y - 20), (x + 210, y + 30), (x - 110, y + 30)]
    p.poly(top, w=2)
    p.line((x - 110, y + 30), (x - 110, y + 150), w=1.8); p.line((x + 210, y + 30), (x + 210, y + 150), w=1.8)
    p.line((x - 150, y - 20), (x - 150, y + 100), w=1.2, op=.6); p.line((x + 170, y - 20), (x + 170, y + 100), w=1.2, op=.6)
    p.hatch([(x - 110, y + 30), (x + 210, y + 30), (x + 210, y + 44), (x - 110, y + 44)], angle=0, gap=2.5, op=.5)
    p.hatch([(x - 120, y + 150), (x + 230, y + 150), (x + 270, y + 170), (x - 80, y + 170)], angle=0, gap=3, op=.3)
    p.raw(f'<path d="M{x + 120} {y - 6}c10-14 30-14 40 0" stroke="{INK}" stroke-width="1.4"/>')   # a mug ring, a pen
    p.line((x - 120, y + 6), (x - 60, y - 6), n=2, w=1.6, double=False)


def real(p):
    p.raw(f'<linearGradient id="parch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E3C8" stop-opacity=".95"/><stop offset="1" stop-color="#F6EEDD" stop-opacity=".7"/></linearGradient>'
          f'<rect y="{B}" width="{W}" height="{H - B}" fill="url(#parch)" stroke="none"/>')
    p.raw(f'<rect x="0" y="{B + 60}" width="{W}" height="{H - B - 60}" fill="url(#stip)" opacity=".35" stroke="none"/>')
    phone(p, *PHONE)
    # the street the van drives on, then the house's lot
    p.stroke([(0, 1700), (200, 1690), (400, 1700), (800, 1690)], w=1.3, op=.6)
    p.stroke([(0, 1760), (300, 1750), (800, 1762)], w=1.1, op=.5, double=False)
    for k in range(9):
        p.line((40 + k * 90, 1726), (80 + k * 90, 1726), n=2, w=1.6, op=.5, double=False)
    van(p, *VAN)
    house(p, *HOUSE)
    for (tx, ty, h) in ((120, 2080, 160), (760, 1900, 120)):     # trees: trunk + scribbled crown
        p.line((tx, ty), (tx + 4, ty - h), w=1.8)
        p.raw(f'<ellipse cx="{tx + 4}" cy="{ty - h - 40}" rx="56" ry="46" fill="none" stroke="{INK}" stroke-width="1.2" opacity=".7"/>')
        p.hatch([(tx - 50, ty - h - 50), (tx + 58, ty - h - 70), (tx + 50, ty - h), (tx - 40, ty - h + 4)], angle=40, gap=5, op=.3)
    tx, ty = HOUSE[0] - 150, HOUSE[1] + 40          # a plumber's toolbox by the door
    p.poly([(tx, ty), (tx + 70, ty), (tx + 70, ty - 34), (tx, ty - 34)], w=1.6)
    p.raw(f'<path d="M{tx + 20} {ty - 34}v-10h30v10" stroke="{INK}" stroke-width="1.4"/><rect x="{tx}" y="{ty - 34}" width="70" height="12" fill="{CORAL}" fill-opacity=".45" stroke="none"/>')
    p.hatch([(tx + 70, ty), (tx + 82, ty - 8), (tx + 82, ty - 42), (tx + 70, ty - 34)], angle=80, gap=2.5, op=.5)
    p.poly([(tx + 70, ty), (tx + 82, ty - 8), (tx + 82, ty - 42), (tx + 70, ty - 34)], w=1.1)
    p.line((tx + 90, ty + 2), (tx + 140, ty - 30), n=2, w=1.8, double=False)        # a wrench
    p.circle(tx + 144, ty - 33, 6, n=10, w=1.4, double=False)
    records(p, *RECORDS)
    # more pencil life (the same procedural pieces as the wyattworldwide.com beach, here on the street and the lot)
    S.footprints(p, [(80, 1260), (160, 1420), (300, 1560)], s=1.0)
    S.footprints(p, [(700, 2180), (640, 2260), (520, 2330)], s=.9)
    for (gx, gy) in [(60, 1480), (740, 1560), (330, 2120), (720, 2300), (80, 2520), (480, 2540)]:
        S.grass(p, gx, gy, 1.0)
    for (rx, ry, rs) in [(700, 1450, .8), (40, 1880, .7), (640, 2470, .9)]:
        S.rock(p, rx, ry, rs)
    p.stroke([(0, 2140), (300, 2128), (520, 2150), (800, 2136)], w=1.2, op=.55)          # the lot's edge, a low fence
    for k in range(16):
        x = 20 + k * 50; y = 2140 + 6 * math.sin(k)
        p.line((x, y), (x + 1, y - 34), w=1.1, op=.7, double=False)
    p.line((0, 2120), (800, 2116), w=.9, op=.5, double=False); p.line((0, 2132), (800, 2128), w=.9, op=.5, double=False)
    S.dim(p, (HOUSE[0], HOUSE[1] + 70), (HOUSE[0] + 160, HOUSE[1] + 30), '9.60 m', off=0, col='#5B7DB1')
    S.dim(p, (HOUSE[0] + 200, HOUSE[1] - 20), (HOUSE[0] + 200, HOUSE[1] - 300), '6.20 m', off=0, col='#5B7DB1')
    S.dim(p, (VAN[0] - 120, VAN[1] + 40), (VAN[0] + 170, VAN[1] + 40), '5.40 m', off=0, col='#5B7DB1')
    S.ghosts(p, n=14)


# the request's path. Stops (vision_build.py): CUST, INBOX, RULES, PHONE, VAN, HOUSE, RECORDS, then back up to CUST.
ROUTE = [CUST, (190, 600), INBOX, RULES, HANDOFF, (620, 1140), PHONE, (420, 1450), VAN, (420, 1820), HOUSE, (380, 2200), RECORDS, (90, 1700), (90, 1100), (120, 700), CUST]
STOP_IDX = [0, 2, 3, 6, 8, 10, 12, 16]


def main():
    p = S.Pencil(11)
    digital(p); boundary(p); real(p)
    route = 'M' + ' L'.join(f'{x} {y}' for x, y in ROUTE)
    defs = (f'<pattern id="stip" width="23" height="19" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".9" fill="{INK}"/><circle cx="14" cy="2" r=".7" fill="{INK}"/>'
            f'<circle cx="9" cy="12" r="1" fill="{INK}"/><circle cx="19" cy="15" r=".8" fill="{INK}"/></pattern>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" aria-hidden="true">'
           f'<!-- The Teroir world for /vision. Drawn by scripts/vision_world.py. -->'
           f'<defs>{defs}</defs><g fill="none" stroke-linecap="round" stroke-linejoin="round">{"".join(p.parts)}</g>'
           f'<path id="route" d="{route}" fill="none" stroke="{EMBER}" stroke-width="2" stroke-dasharray="2 10" opacity=".55"/></svg>')
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(svg)
    print(f'wrote vision/world.svg ({len(svg) // 1024} KB)')


if __name__ == '__main__':
    main()
