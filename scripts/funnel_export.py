#!/usr/bin/env python3
"""Guide-funnel export from Stripe (wyattworldwide.com). Runs on the server; never deployed (scripts/ is in .vercelignore).

Writes, outside any git repo:
  <out>/events.jsonl   one row per funnel event for the CRM (customer data: mode 0600, never commit or send it)
  <out>/funnel.json    per-source and daily counts for the dashboard (no personal data)

Event row (agreed with lead-developer-c6, 11-16):
  {event_id, kind, occurred_at, email, stripe_customer, src, item, amount_cents, currency, ref, ...extra}
kinds: claim, offer_sent, offer_used, checkout_started, checkout_abandoned, paid, refunded, unsub
(vip_click and nurture_step arrive with the nurture engine.)
Test rows are left out by rule and counted per day in funnel.json["excluded"].

usage: funnel_export.py [out dir]   (default /root/.local/share/site-95/crm). Stripe key from the vault.
"""
import base64, collections, hashlib, json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request
from datetime import datetime, timezone

OUT = sys.argv[1] if len(sys.argv) > 1 else '/root/.local/share/site-95/crm'
OFFER_SINCE = 1794523134  # 2026-11-12T21:38:54Z: claim emails carry the $29 offer from this commit on (556e01b)
CONSENT_VERSION = 'free-form-v1'  # the /free claim form wording; it has no checkbox
QA_EMAIL = re.compile(r'\+qa|opstest|@x\.co$', re.I)
QA_SRC = re.compile(r'^(qa.*|e2e.*|.*test.*|selfcheck|price-check|ww-check)$', re.I)

KEY = subprocess.run(['bao', 'kv', 'get', '-field=key', 'secret/org/teroir-finance/stripe'], capture_output=True, text=True, check=True).stdout.strip()

def stripe_list(path, params=None):
    out, after = [], None
    while True:
        q = dict(params or {}, limit=100, **({'starting_after': after} if after else {}))
        req = urllib.request.Request(f'https://api.stripe.com/v1/{path}?' + urllib.parse.urlencode(q, doseq=True))
        req.add_header('Authorization', 'Basic ' + base64.b64encode((KEY + ':').encode()).decode())
        j = json.load(urllib.request.urlopen(req, timeout=60))
        out += j['data']
        if not j.get('has_more'):
            return out
        after = j['data'][-1]['id']

iso = lambda t: datetime.fromtimestamp(int(t), timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def iso_s(s):  # an ISO string from metadata -> normalised Z form
    try: return datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception: return None
h = lambda *p: 'sha256:' + hashlib.sha256('|'.join(map(str, p)).encode()).hexdigest()
norm = lambda e: str(e or '').strip().lower()

def test_rule(email, src):
    if QA_EMAIL.search(email or ''): return 'qa-email'
    if QA_SRC.match(src or ''): return 'qa-src'
    return None

events, excluded = [], collections.Counter()
def emit(ev, src_for_rule=None):
    rule = test_rule(ev['email'], src_for_rule if src_for_rule is not None else ev.get('src'))
    if rule:
        excluded[(ev['occurred_at'][:10], rule)] += 1
        return
    events.append({'currency': None, 'amount_cents': None, 'ref': None, 'stripe_customer': None, 'item': None, 'src': None, **ev})

# claims, offer sent, opt-outs: Stripe customer metadata
customers = stripe_list('customers')
claim_src = {}
for c in customers:
    m, email = c.get('metadata') or {}, norm(c.get('email'))
    if m.get('free_guide'):
        at = iso_s(m.get('free_at', '')) or iso(c['created'])
        src = m.get('free_src') or 'direct'
        claim_src.setdefault(email, src)
        emit({'event_id': h('claim', email, at), 'kind': 'claim', 'occurred_at': at, 'email': email, 'stripe_customer': c['id'],
              'src': src, 'item': m['free_guide'], 'consent_wording_version': CONSENT_VERSION, 'box_checked': False})
        if datetime.fromisoformat(at.replace('Z', '+00:00')).timestamp() >= OFFER_SINCE:
            emit({'event_id': h('offer_sent', email, at), 'kind': 'offer_sent', 'occurred_at': at, 'email': email, 'stripe_customer': c['id'],
                  'src': src, 'item': 'offer29', 'amount_cents': 2900, 'currency': 'usd'})
    if m.get('unsub') == 'true':
        at = iso_s(m.get('unsub_at', '')) or iso(c['created'])
        emit({'event_id': h('unsub', email, at), 'kind': 'unsub', 'occurred_at': at, 'email': email, 'stripe_customer': c['id'],
              'channel': 'email', 'how': m.get('unsub_how', 'link')}, src_for_rule='')

# checkouts: started, abandoned, paid, offer used
sessions = [s for s in stripe_list('checkout/sessions', {'expand[]': ['data.payment_intent']})
            if (s.get('metadata') or {}).get('brand') == 'wyattworldwide' or (s.get('metadata') or {}).get('guides')]
pi_to_session = {}
for s in sessions:
    m = s.get('metadata') or {}
    email = norm(m.get('email') or s.get('customer_email') or (s.get('customer_details') or {}).get('email'))
    src = m.get('src') or 'direct'
    item = f"district:{m['district']}" if m.get('district') else ('guides:' + m.get('guides', ''))
    base = {'email': email, 'stripe_customer': s.get('customer'), 'src': src, 'item': item, 'amount_cents': s.get('amount_total'),
            'currency': s.get('currency'), 'ref': s['id']}
    emit({**base, 'event_id': s['id'], 'kind': 'checkout_started', 'occurred_at': iso(s['created'])})
    if s['status'] == 'expired':
        emit({**base, 'event_id': s['id'] + ':expired', 'kind': 'checkout_abandoned', 'occurred_at': iso(s.get('expires_at') or s['created'])})
    pi = s.get('payment_intent')
    if s.get('payment_status') == 'paid' and isinstance(pi, dict):
        pi_to_session[pi['id']] = (base, s)
        paid_at = iso(pi.get('created') or s['created'])
        emit({**base, 'event_id': pi['id'], 'kind': 'paid', 'occurred_at': paid_at, 'ref': s['id'], 'first_src': claim_src.get(email)})
        if m.get('offer'):
            emit({**base, 'event_id': pi['id'] + ':offer', 'kind': 'offer_used', 'occurred_at': paid_at, 'ref': s['id']})

# refunds of our payments
for r in stripe_list('refunds'):
    if r.get('payment_intent') in pi_to_session and r.get('status') in ('succeeded', 'pending'):
        base, s = pi_to_session[r['payment_intent']]
        emit({**base, 'event_id': r['id'], 'kind': 'refunded', 'occurred_at': iso(r['created']), 'amount_cents': r['amount'], 'ref': r['payment_intent']})

events.sort(key=lambda e: (e['occurred_at'], e['event_id']))

# counts for the dashboard: per source (claims attributed to the claim's src; sales to the buyer's claim src when they claimed first)
by_src = collections.defaultdict(lambda: collections.Counter())
daily = collections.defaultdict(lambda: collections.Counter())
for e in events:
    k, d = e['kind'], e['occurred_at'][:10]
    src = (e.get('first_src') or e['src'] or 'direct') if k == 'paid' else (e['src'] or 'direct')
    for bucket in (by_src[src], daily[(d, src)]):
        bucket[k] += 1
        if k == 'paid': bucket['revenue_cents'] += e['amount_cents'] or 0
        if k == 'refunded': bucket['refunded_cents'] += e['amount_cents'] or 0
funnel = {
    'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'note': 'test rows excluded (see excluded); paid is attributed to the claim src when the buyer claimed first',
    'totals': dict(sum((c for c in by_src.values()), collections.Counter())),
    'by_src': {s: dict(c) for s, c in sorted(by_src.items())},
    'daily': [{'date': d, 'src': s, **dict(c)} for (d, s), c in sorted(daily.items())],
    'excluded': [{'date': d, 'rule': r, 'rows': n} for (d, r), n in sorted(excluded.items())],
}

os.makedirs(OUT, mode=0o700, exist_ok=True)
def write(name, text, mode):
    fd, tmp = tempfile.mkstemp(dir=OUT)
    with os.fdopen(fd, 'w') as f: f.write(text)
    os.chmod(tmp, mode); os.replace(tmp, os.path.join(OUT, name))
write('events.jsonl', ''.join(json.dumps(e, separators=(',', ':')) + '\n' for e in events), 0o600)
write('funnel.json', json.dumps(funnel, indent=1) + '\n', 0o600)
print(f"events {len(events)} ({', '.join(f'{k} {v}' for k, v in sorted(collections.Counter(e['kind'] for e in events).items()))}); "
      f"excluded {sum(excluded.values())}; wrote {OUT}/events.jsonl and funnel.json")
