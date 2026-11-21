#!/usr/bin/env python3
"""Builds teroir.com/vision (vision.html) from the world's coordinates (scripts/vision_world.py), so the request's
route, its stops and the hotspots always sit on the drawing. Copy lives here; it goes through copy review.

    python3 scripts/vision_world.py && python3 scripts/vision_build.py
"""
from pathlib import Path
import html
import json
import math
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vision_world as V

ROOT = Path(__file__).resolve().parent.parent
e = html.escape

# the stops: one short line each (≤8 words)
LINES = [
    "A member's AI asks: fix my leaking sink.",
    "It lands in your .BOS inbox.",
    "Your rules check what the AI may do.",
    "You approve it in one tap.",
    "A plumber gets the job card.",
    "The sink gets fixed.",
    "Every step leaves a record you own.",
    "Fixed. The member's AI hears back.",
]
# hotspots: (key, label, world x, y, card text ≤40 words)
HOTS = [
    ('agents', 'Agents', V.TER[0], V.TER[1] + 50, "Agents do the routine work: answer, book and follow up. Use ours, or bring your own. Every agent works inside your rules."),
    ('inbox', 'Inbox', V.INBOX[0], V.INBOX[1] + 40, "Every request lands in one inbox: texts, emails, forms, and other businesses' AI agents. You never have to log in to anything."),
    ('rules', 'Rules', V.RULES[0], V.RULES[1] + 40, "Your rules say what an agent may do on its own and what needs you. Risky steps always wait for a person."),
    ('handoff', 'Hand-off', V.HANDOFF[0], V.HANDOFF[1] + 40, "When it matters, the agent hands off to you. One tap to approve, change or say no."),
    ('jobs', 'Jobs', V.VAN[0] + 40, V.VAN[1] + 40, "A request becomes a job: the member's ask, your OK, the plumber's job card, then the loop closed with the member."),
    ('records', 'Records', V.RECORDS[0] - 60, V.RECORDS[1] + 100, "Every step leaves a record: who asked, who approved, what got done. Records give each client a before and after number."),
    ('data', 'Data', V.RECORDS[0] + 130, V.RECORDS[1] + 100, "You own your data. We use it to prove and improve your results. Patterns across clients only with consent, made anonymous. Never sold."),
]


# what the camera centres on at each stop, so the stop's subject sits fully in frame at 390 px
FOCUS = [V.CUST, (210, 960), (300, 980), (V.PHONE[0] - 20, V.PHONE[1] + 40), (V.VAN[0] + 30, V.VAN[1] - 40),
         (V.HOUSE[0] - 150, V.HOUSE[1] - 60), (V.RECORDS[0] + 40, V.RECORDS[1] - 20), V.CUST]
# overlays on the drawing that change with the story: the sink (leaking, then fixed) and the record cards
SINK = (V.HOUSE[0] - 230, V.HOUSE[1] - 230)
CARDS = (V.RECORDS[0] - 110, V.RECORDS[1] - 108)


def fractions():
    pts = V.ROUTE
    seg = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(seg); cum = [0]
    for d in seg: cum.append(cum[-1] + d)
    return [cum[i] / total for i in V.STOP_IDX]


def main():
    fr = fractions()
    stops = [{'at': round(f, 4), 'line': l, 'fx': fx, 'fy': fy} for f, l, (fx, fy) in zip(fr, LINES, FOCUS)]
    route_d = 'M' + ' L'.join(f'{x} {y}' for x, y in V.ROUTE)
    hots = '\n'.join(f'      <button class="vw-hot" type="button" style="left:calc({x}px * var(--s));top:calc({y}px * var(--s))" '
                     f'data-title="{e(lbl)}" data-text="{e(txt)}"><span>{e(lbl)}</span></button>' for k, lbl, x, y, txt in HOTS)
    stills = '\n'.join(f'    <figure class="vw-still"><div class="vw-still-img" style="background-position:{-(fx - 195)}px {-(fy - 210)}px"></div>'
                       f'<figcaption>{n + 1}. {e(l)}</figcaption></figure>' for n, (l, (fx, fy)) in enumerate(zip(LINES, FOCUS)))
    dots = ''.join('<i></i>' for _ in LINES)
    page = (ROOT / 'scripts' / 'vision_template.html').read_text()
    page = (page.replace('{{STOPS}}', json.dumps(stops)).replace('{{ROUTE}}', route_d).replace('{{HOTS}}', hots)
                .replace('{{STILLS}}', stills).replace('{{SINK_X}}', str(SINK[0])).replace('{{SINK_Y}}', str(SINK[1]))
                .replace('{{CARDS_X}}', str(CARDS[0])).replace('{{CARDS_Y}}', str(CARDS[1])).replace('{{DOTS}}', dots).replace('{{FIRST_LINE}}', e(LINES[0])))
    (ROOT / 'vision.html').write_text(page)
    print('wrote vision.html;', ', '.join(f"{s['at']:.2f}" for s in stops))


if __name__ == '__main__':
    main()
