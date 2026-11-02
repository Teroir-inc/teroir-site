import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateWeek } from '../engine.js';
import { assignChores } from '../rotation.js';

test('seeded simulation is pure, fictional, chronological, and complete', () => {
  const answers = { properties: 2, roomsPerProperty: 4, fine: { enabled: true, amount: 17 } };
  const before = structuredClone(answers);
  const a = simulateWeek(answers, { seed: 42 });
  assert.deepEqual(a, simulateWeek(answers, { seed: 42 }));
  assert.deepEqual(answers, before);
  assert.ok(a.portfolio.houses.flatMap(h => h.members).every(m => m.example));
  assert.deepEqual(a.events.map(e => e.day), [...a.events.map(e => e.day)].sort((a,b) => a-b));
  for (const kind of ['photo_failed', 'photo_passed', 'fine', 'dispute_packet', 'ticket_created', 'promise_recorded', 'payment_received', 'owner_decision', 'notice_preview', 'week_summary']) assert.ok(a.events.some(e => e.kind === kind), kind);
  assert.equal(a.summary.fines.amount, a.events.filter(e => e.kind === 'fine').reduce((n,e) => n+e.money,0));
  assert.equal(a.summary.chores.done, a.events.filter(e => e.kind === 'photo_passed').length);
  assert.ok(a.events.filter(e => e.kind === 'notice_preview').every(e => e.preview && !e.autoSent && e.calendar.length === 3));
});
test('rotation balances workload and avoids previous spaces when equally loaded', () => {
  const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const result = assignChores(members, ['kitchen','bathroom','laundry','garbage'], { kitchen: 'a' });
  const loads = members.map(m => result.filter(a => a.member === m.id).length);
  assert.ok(Math.max(...loads)-Math.min(...loads) <= 1);
  assert.notEqual(result[0].member, 'a');
  assert.ok(result.every(a => a.reason));
});
test('disabled fines, absent spaces, and single house have honest outcomes', () => {
  const a = simulateWeek({ fine: { enabled: false }, sharedSpaces: [] });
  assert.equal(a.summary.chores.assigned, 0);
  assert.equal(a.summary.chores.completionPercent, 0);
  assert.ok(!a.events.some(e => ['fine','owner_decision','photo_failed'].includes(e.kind)));
  const b = simulateWeek({ fine: { enabled: false } });
  assert.ok(b.events.some(e => e.kind === 'owner_note'));
  assert.ok(!b.events.some(e => e.kind === 'fine'));
});
test('validation clamps inputs and scales the largest three houses', () => {
  const a = simulateWeek({ properties: 100, totalRooms: 501, fine: { enabled: true, amount: 999 } });
  assert.equal(a.portfolio.properties, 50);
  assert.equal(a.portfolio.totalRooms, 501);
  assert.equal(a.portfolio.houses.length, 3);
  assert.equal(a.portfolio.houses[0].rooms, 11);
  assert.equal(a.portfolio.fine.amount, 100);
  assert.equal(a.summary.scaleFactor, 50/3);
  assert.equal(a.summary.hoursSaved.low, 501*3/60);
  assert.match(a.summary.label, /scaled/i);
  assert.doesNotThrow(() => simulateWeek(null, { seed: 0 }));
});
test('all portfolio sizes preserve rotation, event totals, and notice safety', () => {
  for (const properties of [1,2,3,4,50]) for (const roomsPerProperty of [2,3,15]) {
    const result = simulateWeek({ properties, roomsPerProperty, fine: { enabled: true, amount: 0 } }, { seed: 'edge' });
    const { events, summary, portfolio } = result;
    for (const house of portfolio.houses) {
      const loads = house.members.map(m => house.assignments.filter(a => a.member === m.id).length);
      assert.ok(Math.max(...loads)-Math.min(...loads) <= 1);
      assert.equal(events.filter(e => e.house === house.id && e.kind === 'assignment').length, house.rooms);
    }
    const scale = summary.scaleFactor;
    assert.equal(summary.messagesHandled, events.filter(e => e.message).length*scale);
    assert.equal(summary.ticketsOpened, events.filter(e => e.kind === 'ticket_created').length*scale);
    assert.equal(summary.collections.promised, events.filter(e => e.kind === 'promise_recorded').reduce((n,e) => n+e.money,0)*scale);
    assert.equal(summary.collections.recovered, events.filter(e => e.kind === 'payment_received').reduce((n,e) => n+e.money,0)*scale);
    assert.ok(events.filter(e => e.kind === 'balance_message').every(e => e.money > portfolio.lateThreshold));
    assert.ok(events.every(e => e.title && e.detail && /^\w{3} \d{2}:\d{2}$/.test(e.t)));
    assert.equal(events.at(-1).kind, 'week_summary');
  }
});
test('invalid input defaults safely and seed changes example identities', () => {
  const result = simulateWeek({ properties: 'bad', roomsPerProperty: -1, sharedSpaces: ['kitchen','kitchen','invalid'], rentalType: 'invalid', channels: [null, 'direct', 'direct'], lateThreshold: Infinity });
  assert.equal(result.portfolio.properties, 1);
  assert.equal(result.portfolio.totalRooms, 2);
  assert.deepEqual(result.portfolio.houses[0].sharedSpaces, ['kitchen']);
  assert.deepEqual(result.portfolio.channels, ['direct']);
  assert.equal(result.portfolio.lateThreshold, 300);
  assert.notDeepEqual(simulateWeek({}, { seed: 1 }).portfolio.houses[0].members, simulateWeek({}, { seed: 2 }).portfolio.houses[0].members);
  assert.deepEqual(assignChores([], ['kitchen']), []);
});
