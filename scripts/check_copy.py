#!/usr/bin/env python3
"""Fail if any served page carries copy the decisions rule out.

Sources: teroir-hq docs/ops/DECISIONS.md (2026-11-02 to 11-07) and FACTS.md (NEVER USE); the checked deck's copy check
(teroir-hq pitch-v3, docs/pitch/v3/build.py) for the network-tense patterns.

Every pattern is first run on a positive control (it must hit) and on clean, approved lines (it must not), so a pass
means "absent", not "the check is broken". The approved one-liner and the official stack description must also appear
word for word.

    python3 scripts/check_copy.py              # check the working tree
    python3 scripts/check_copy.py --rev main   # check a commit instead (the old site is a second positive control)
"""
from pathlib import Path
import argparse
import html
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
TEXT = ('.html', '.js', '.json', '.vcf', '.txt', '.md')
SKIP = ('api/', 'scripts/')  # serverless code and this script; neither is served as a page

ONE_LINER = ("Built for small businesses: a network where your AI agents can do business with anyone else's, "
             "safely, on the record, with no middleman.")
STACK = [  # DECISIONS 2026-11-07, split at the layer names as the checked deck does
    "Teroir builds an open network where businesses' AI agents do business with each other "
    "(post jobs, place orders, agree prices, pay) with no middleman.",
    ".BOS is the open framework a business builds its own operating system on. It keeps every agent inside the rules "
    "its owner signed and leaves proof the other side can check.",
    "XX.BOS packs, like PM.BOS for property management, add one industry's tools: its job types, proof rules and "
    "privacy levels.",
]
REQUIRED = {'index.html': [ONE_LINER, *STACK], 'network.html': [ONE_LINER]}

FORBIDDEN = {
    # Home-page lines retired by the re-scope (PITCH_IMPROVEMENTS #10).
    'adversaries or hacks': r'securely transact|without worry|adversar|\bhacks?\b|hack-?proof',
    'network pays the invoice': r'paid invoice|invoices? (?:is |are |gets? )?paid|paid automatically|pays? (?:the )?invoices?',
    'old title': r'AI operating system for every business',
    # FACTS: outcomes in the past or present perfect.
    'present-tense outcome': r'\brunning a real|\bruns a real|runs today|already runs?\b|\bis running\b|\b(?:PM\.BOS|it) runs (?:the|its) (?:operations )?week\b|\bPM\.BOS runs\b',
    # Teroir is the company, not the network; each owner signs its own rules.
    'Teroir is the network': r'\bTeroir(?:\s+in development)?\s*(?:is|=|:|—)?\s*(?:the|an|a|our)\s+(?:open\s+)?network\b',
    'Teroir network': r"\bTeroir(?:'s)? network\b",
    'Teroir runs the network': r'\bTeroir (?:runs|owns|operates|controls) the network\b',
    'network policy': r'network polic(?:y|ies)',
    # The network holds no money; only "will hold no money" may say so.
    'network holds money': r'escrow|held by the network|\b(?:hold|keep)(?:s|ing)? (?:your |the |their )?(?:funds|money|payments)\b',
    # The network is in development: future tense.
    'record stays yours (present)': r'(?<!will )(?<!to )\b(?:stays?|belongs?) (?:yours|to (?:you|the owner))',
    'every act is checked (present)': r'\bevery (?:act|exchange|agent|job|deal) (?:is|gets) (?:checked|signed|verified)',
    'both sign every deal (present)': r'(?<!will )\bsigns? (?:every|each) deal',
    'the network holds (present)': r'\bthe network (?:holds|verifies|checks|connects|runs|keeps|pays)\b',
    'this is the network (present)': r"\b(?:this|that) is the network\b(?! we)|\bthat's the network\b(?! we)",
    # bos SPEC §2.8.5: a text-link confirmation is never "signed by both".
    'text-link path': r'text[- ]link|one-time code',
    'witnessed': r'witnessed',
    # People and scope (DECISIONS 2026-11-02, 11-07).
    'Robert': r'\bRobert\b',
    'second founder': r'co-?founder|silent partner',
    'retired scope line': r'everything but collections|collections and handyman booking',
    'hours saved': r'hours? (?:saved|back)|\bsaves? \d+|\d+\s*[–-]\s*\d+\s*h(?:ours)?\b|minutes per room',
    # FACTS NEVER USE and the deck's list.
    '490 of 901': r'490 of 901|\b54%',
    'repair tickets': r'repair tickets',
    'cities': r'Houston|Dallas|Fort Worth',
    'revenue label': r'pre-revenue|revenue status',
    '70-second demo': r'70[- ]?s(?:ec(?:ond)?)?\b',
    'first-project platform': r'PadSplit',  # allowed only as a public market option, see MARKET_OPTIONS
}
# PadSplit as a listing channel or host role (DECISIONS 2026-11-04) is fine; these exact spots are the only ones.
MARKET_OPTIONS = ['Co-living or PadSplit host', 'value="PadSplit"', '<span>PadSplit</span>', 'PadSplit inbox']

CONTROL = (
    'The ecosystem where AI agents can securely transact without worry of adversaries or hacks. The invoice is paid '
    'automatically, from posting to paid invoice. The AI operating system for every business. Running a real portfolio '
    'since May 2026. PM.BOS runs today and already runs the week; it is running. It runs the week for operators. '
    'Teroir is the network. Teroir in development An open network. Teroir runs the network. The Teroir network '
    'holds your funds. Payments are held in escrow by the network. The network policy. Your record stays yours. '
    'Identity belongs to the owner. Every act is checked against its rules. Both sides sign every deal. The network '
    'holds no money. That is the network. By text link or one-time code. Witnessed. Robert Lin, co-founder; a silent '
    'partner. Everything but collections and handyman booking. 10-20 h of hours saved. 490 of 901. 901 repair tickets. '
    'Houston. Pre-revenue. Watch the 70-second demo. A PadSplit portfolio.'
)
CLEAN = (
    f'{ONE_LINER} {" ".join(STACK)} The network — Teroir ¶ A network where agents meet. Your agent, meet theirs. '
    'PM.BOS has run a real portfolio since May 2026. The first pack has run a real business. Your identity, record and '
    'rating will stay yours when you switch. Both sides will sign each deal and keep the receipt. Every act will be '
    "checked against its owner's rules. The owner pays the way they already do. The network will hold no money. "
    'Ready to run as it is. Soon, connect the agent you already use with one sign-in. Three examples cycle: one runs, '
    'one waits for a person. Before it runs your week. Who runs the week? How you work today. Hours a week on operations. '
    "Wyatt Horton, Founder & CEO. Play demo · 1:01. Receipt signed by both. Ticket from a member's text. Teroir's "
    'own agent will get no head start. The owner will pay as usual, outside the network. One repair, start to finish. '
    '2.8× the weekly workload. 900+ tickets tracked.'
)


def self_test():
    for label, pat in FORBIDDEN.items():
        assert re.search(pat, CONTROL, re.I), f'control failed for {label}'
        assert not re.search(pat, CLEAN, re.I), f'false positive for {label}: {re.search(pat, CLEAN, re.I).group(0)!r}'
    # The whole scan on a page with one bad line must fail, and on the same page without it must pass.
    good = f'<html><head><meta name="description" content="x"></head><body><p>{ONE_LINER}</p></body></html>'
    bad = good.replace('</body>', '<p>Both sides sign every deal.</p></body>')
    assert scan_text('control.html', bad) and not scan_text('control.html', good), 'page-level control failed'
    return len(FORBIDDEN)


def visible(name, text):
    """Visible text plus the attribute text people see in previews, tooltips and screen readers."""
    if not name.endswith('.html'):
        return text
    # ¶ separates texts that are never read together (title, meta tags), so a pattern cannot run across them.
    attrs = ' ¶ '.join(re.findall(r'\b(?:content|alt|aria-label|title|placeholder)="([^"]*)"', text))
    body = re.sub(r'<(script|style)\b.*?</\1>', ' ', text, flags=re.S | re.I)
    body = re.sub(r'<title>(.*?)</title>', r' ¶ \1 ¶ ', body, flags=re.S)
    # A status tag ("In development") beside a layer name is a label, not part of the sentence.
    body = re.sub(r'<span class="status[^"]*">(?:<span[^>]*></span>)?[^<]*</span>', ' ', body)
    body = re.sub(r'<[^>]+>', ' ', body)
    return re.sub(r'\s+', ' ', html.unescape(body + ' ¶ ' + attrs).replace('’', "'"))


def scan_text(name, text):
    raw = text
    for ok in MARKET_OPTIONS:
        raw = raw.replace(ok, '')
    seen = visible(name, raw)
    hits = []
    for label, pat in FORBIDDEN.items():
        # PadSplit is checked in the source too, so a link or file name cannot carry it either.
        for where in ([seen, raw] if label == 'first-project platform' else [seen]):
            m = re.search(pat, where, re.I)
            if m:
                hits.append(f'{label}: "{where[max(0, m.start() - 40):m.end() + 40].strip()}"')
                break
    flat = visible(name, text)
    for line in REQUIRED.get(name, []):
        if line not in flat:
            hits.append(f'missing word for word: "{line[:60]}..."')
    if ONE_LINER[:28] in flat and ONE_LINER not in flat:
        hits.append('one-liner altered')
    return hits


def files(rev):
    git = ['git', '-C', str(ROOT)]
    rules = subprocess.run(git + ['show', f'{rev}:.vercelignore'], capture_output=True, text=True).stdout if rev \
        else (ROOT / '.vercelignore').read_text()
    ignore = [l.strip().rstrip('/') for l in rules.splitlines() if l.strip()]
    names = subprocess.run(git + (['ls-tree', '-r', '--name-only', rev] if rev else ['ls-files', '-co', '--exclude-standard']),
                           capture_output=True, text=True, check=True).stdout.split()
    for n in sorted(names):
        if not n.endswith(TEXT) or n.startswith(SKIP) or any(n == i or n.startswith(i + '/') for i in ignore):
            continue
        if rev:
            yield n, subprocess.run(git + ['show', f'{rev}:{n}'], capture_output=True, text=True, check=True).stdout
        elif (ROOT / n).exists():
            yield n, (ROOT / n).read_text()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rev', help='check this commit instead of the working tree')
    args = ap.parse_args()
    n = self_test()
    print(f'controls: {n} patterns hit the positive control, none hit the approved lines; page-level control ok')
    failed = 0
    count = 0
    for name, text in files(args.rev):
        count += 1
        for hit in scan_text(name, text):
            print(f'FAIL {name}: {hit}')
            failed += 1
    print(f'{count} served files checked{" at " + args.rev if args.rev else ""}: {failed} problem(s)')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
