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
  assert.ok(!a.events.some(e => ['fine','photo_failed'].includes(e.kind)));
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
  assert.equal(Object.hasOwn(a.summary, 'hoursSaved'), false);
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

test('each story happens once across the portfolio, with distinct payment members', () => {
  for (const properties of [1, 2, 3, 7, 50]) for (const seed of [1, 2, 42, 'quiet']) {
    const result = simulateWeek({properties, fine:{enabled:true,amount:25}}, {seed});
    const {events,portfolio,summary} = result;
    const of = kind => events.filter(e => e.kind === kind);
    for (const kind of ['payment_received','promise_missed','owner_decision','notice_preview',
      'member_message','ticket_created','owner_alert','photo_failed','fine','dispute_packet']) assert.equal(of(kind).length,1,kind);
    for (const kind of ['balance_message','payment_promise','promise_recorded','promise_reminder']) assert.equal(of(kind).length,2,kind);
    const kept=of('payment_received')[0], missed=of('promise_missed')[0];
    assert.notEqual(kept.actor,missed.actor);
    assert.equal(kept.house === missed.house, properties === 1);
    assert.deepEqual(of('balance_message').map(e=>e.actor).sort(),[kept.actor,missed.actor].sort()); // every promise follows a balance reminder
    const failed=of('photo_failed')[0];
    assert.equal(of('photo_passed').filter(e=>e.resubmission).length,1);
    assert.ok(of('photo_passed').some(e=>e.actor===failed.actor && e.assignment.space===failed.assignment.space && e.resubmission));
    assert.equal(summary.chores.done,(of('assignment').reduce((n,e)=>n+e.assignments.length,0)-1)*summary.scaleFactor);
    const ids=new Set(portfolio.houses.flatMap(h=>h.members.map(m=>m.id)));
    const reached=new Set(events.filter(e=>e.message && ids.has(e.actor)).map(e=>e.actor));
    assert.equal(summary.membersReached,reached.size*summary.scaleFactor);
    assert.equal(Object.hasOwn(summary,'hoursSaved'),false);
    assert.deepEqual(result,simulateWeek({properties,fine:{enabled:true,amount:25}},{seed}));
  }
});
test('one missed chore respects disabled fines and scarce shared spaces', () => {
  for (const sharedSpaces of [[],['kitchen'],['kitchen','bathroom']]) {
    const {events,summary}=simulateWeek({properties:1,sharedSpaces});
    const count=kind=>events.filter(e=>e.kind===kind).length;
    assert.equal(count('fine'),0);
    assert.equal(count('owner_note'),sharedSpaces.length ? 1 : 0);
    assert.equal(count('photo_failed'),sharedSpaces.length > 1 ? 1 : 0);
    assert.equal(summary.chores.done,Math.max(0,sharedSpaces.length-1));
  }
  const {events}=simulateWeek({properties:3,fine:{enabled:false}});
  assert.equal(events.filter(e=>e.kind==='owner_note').length,1);
  assert.equal(events.filter(e=>e.kind==='missed_reminder').length,1);
});

test('seed varies story locations without repeating incidents in quiet houses', () => {
  const locations = new Set();
  for (const seed of [1,2,3,4,5]) {
    const {events} = simulateWeek({properties:3}, {seed});
    const balance = events.find(e=>e.kind==='balance_message');
    const leak = events.find(e=>e.kind==='member_message');
    const missed = events.find(e=>e.kind==='promise_missed');
    assert.equal(new Set([balance.house,leak.house,missed.house]).size,3);
    locations.add([balance.house,leak.house,missed.house].join(','));
    const retry=events.find(e=>e.kind==='photo_failed');
    const choreMiss=events.find(e=>e.kind==='missed_reminder');
    assert.notEqual(retry.house,choreMiss.house);
  }
  assert.ok(locations.size > 1);
});
