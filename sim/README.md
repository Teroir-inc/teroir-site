# Weekly simulation logic

Dependency-free ES modules for browsers and Node 20+. All outcomes are fictional.

```js
import { simulateWeek } from './engine.js';
const { portfolio, events, summary } = simulateWeek({
  properties: 2, roomsPerProperty: 4,
  sharedSpaces: ['kitchen', 'bathroom', 'laundry'],
  fine: { enabled: true, amount: 10 },
  lateThreshold: 300, rentPerRoomPerWeek: 200,
  rentalType: 'rooms', channels: ['direct'], hoursPerWeek: 8,
}, { seed: 42 });
```

`totalRooms` overrides `roomsPerProperty`, is clamped to 2–15 rooms per property,
and spreads evenly, with the extra rooms in the first houses. Properties clamp to
1–50. Shared spaces may be one common array or an array of arrays per property;
unknown spaces and duplicates are removed. Omission defaults to all five spaces;
an empty array disables chores. Fines default off, with amount zero. Invalid
numbers use defaults; valid numbers clamp. Threshold and rent clamp to 0–1,000,000;
owner hours clamp to 0–168. Channels are retained as metadata. Rental type does not
silently override the owner's selected shared spaces.

`assignChores(members, spaces, previous)` in `rotation.js` accepts members with
unique `id` fields and a previous space-to-member-ID map. It always chooses among
the least-loaded members, preferring someone who did not do that space previously.
It returns `{space, member, reason}` assignments without mutating inputs. The engine
constructs fictional previous-week assignments. Names are invented placeholders,
not sourced from this repository; every member has `example: true`.

Events carry `t`, an illustrative ISO `date`, zero-based numeric `day`, `kind`,
`house` (null for portfolio events), `actor`, `title`, and `detail`. Member-specific
events include `room`; relevant events include `money`. Actor IDs reference example
members, `system`, or `owner`. `message: true` marks a simulated communication for
message counting; internal records are excluded. Assignment events hold all chores
for that member, including an empty list when no chore is assigned.

Event kinds: `portfolio`, `assignment`, `reminder`, `deadline`, `photo_failed`,
`photo_passed`, `fine`, `dispute_packet`, `missed_reminder`, `owner_note`,
`balance_message`, `payment_promise`, `promise_recorded`, `promise_reminder`,
`payment_received`, `promise_missed`, `owner_decision`, `notice_preview`,
`member_message`, `ticket_created`, `owner_alert`, `week_summary`.

Summary counts and money derive from events. Up to three largest houses are
simulated; event totals scale by total properties / detailed properties, so projected
counts can be fractional. Completion is accepted chores / assigned chores; a failed
photo is not a completion. Members reached counts distinct example member IDs with
at least one message event, then applies the same scale factor. Owner and system
events are excluded. All display sentences and assignment reasons are in `copy.js`.

## Assumptions and uncertainties

- Friday starts the story. The closing Sunday is nine days later so Monday–Thursday
  collections can precede it. Fixed November 2026 example dates make seeds repeatable.
- Story locations vary deterministically by seed. Across the detailed houses there
  is one missed chore and one failed photo followed by an approved resubmission.
  These use different assignments, preferring different houses. With only one
  chore, only the miss is shown; with none, no photo or penalty events are invented.
  All other chore photos are approved normally.
- One member crosses the balance threshold and keeps their promise. A second
  member's promise is missed, prompting an owner decision and notice preview.
  They live in different houses when possible, or are distinct members of the
  sole house. Only the first story emits a threshold-crossing message.
- One leak message creates one maintenance request and one owner alert.
- The notice calendar is an illustrative future preview, not a legal timetable.
  It has no send action. Humans decide notices. The decision event includes history.
- Scaling assumes detailed houses represent the portfolio; it is not a prediction.
  Maintenance uses the requested kitchen example even when kitchen is not a chore.
- Channel-specific delivery, actual photo inspection, and real payment processing
  are outside this logic layer. No network, storage, or production data is used.

Run: `node --test teroir/site/sim/test/`.
