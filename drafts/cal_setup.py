# Cal.com setup for the outreach call (site-a5). Usage:
#   CAL_KEY=... CAL_HOOK_SECRET=... python3 cal_setup.py check|apply
# check = read-only (me, event types, schedules, calendars, webhooks). apply = make the changes. Never prints secrets.
import json, os, sys, urllib.request, urllib.error
K = os.environ['CAL_KEY']; B = 'https://api.cal.com/v2'
V = {'event-types': '2026-06-12', 'schedules': '2024-06-11', 'bookings': '2026-02-25'}
def call(m, path, body=None, ver='2024-08-13'):
    r = urllib.request.Request(B + path, method=m, data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + K, 'cal-api-version': ver, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=30) as f: return f.status, json.loads(f.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, (json.loads(e.read() or b'{}') if True else None)
mode = sys.argv[1]
s, me = call('GET', '/me'); print('me', s, (me.get('data') or {}).get('username'), (me.get('data') or {}).get('timeZone'))
if s != 200: sys.exit('key refused: %s %s' % (s, json.dumps(me)[:300]))
s, et = call('GET', '/event-types', ver=V['event-types']); ets = et.get('data') or []
print('event-types', s, [(e['id'], e['slug'], e.get('lengthInMinutes')) for e in ets])
s, sc = call('GET', '/schedules', ver=V['schedules']); print('schedules', s, [(x['id'], x['name'], x.get('isDefault')) for x in sc.get('data') or []])
s, ca = call('GET', '/calendars'); d = ca.get('data') or {}
print('calendars', s, 'destination:', json.dumps(d.get('destinationCalendar'))[:200], 'connected:', len(d.get('connectedCalendars') or []))
s, wh = call('GET', '/webhooks'); print('webhooks', s, [(w.get('id'), w.get('subscriberUrl'), w.get('triggers')) for w in wh.get('data') or []])
if mode != 'apply': sys.exit(0)
ev = next(e for e in ets if e['slug'] == '15min')
s, sch = call('POST', '/schedules', {'name': 'Outreach calls', 'timeZone': 'America/Denver', 'isDefault': False,
    'availability': [{'days': ['Monday', 'Tuesday', 'Wednesday'], 'startTime': '08:00', 'endTime': '12:00'}]}, ver=V['schedules'])
print('schedule create', s); sid = sch['data']['id']
fields = [f for f in ev.get('bookingFields') or [] if f.get('slug') not in ('attendeePhoneNumber', 'ref')]
fields += [{'type': 'phone', 'slug': 'attendeePhoneNumber', 'label': 'Wyatt will call you at this number at the time you pick', 'required': True, 'hidden': False},
           {'type': 'text', 'slug': 'ref', 'label': 'ref', 'required': False, 'hidden': True}]
patch = {'title': '15-minute intro call', 'lengthInMinutes': 15, 'slug': '15min',
    'description': 'A short phone call with Wyatt. Wyatt will call you at the number you enter.',
    'locations': [{'type': 'attendeePhone'}], 'bookingFields': fields, 'scheduleId': sid,
    'minimumBookingNotice': 720, 'afterEventBuffer': 15,
    'bookingWindow': {'type': 'calendarDays', 'value': 21, 'rolling': True}}
s, r = call('PATCH', '/event-types/%d' % ev['id'], patch, ver=V['event-types']); print('event patch', s, json.dumps(r)[:600])
s, r = call('POST', '/webhooks', {'active': True, 'subscriberUrl': 'https://teroir.com/api/booking',
    'triggers': ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'], 'secret': os.environ['CAL_HOOK_SECRET']})
print('webhook create', s, json.dumps({k: v for k, v in (r.get('data') or {}).items() if k != 'secret'})[:300])
