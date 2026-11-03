import { names, eventCopy, summaryLabel } from './copy.js';
import { assignChores } from './rotation.js';
const SPACES = ['kitchen', 'bathroom', 'living room', 'laundry', 'garbage'];
const DAYS = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const number = (v, fallback, min, max) => v === null || v === '' || !['number', 'string'].includes(typeof v) || !Number.isFinite(Number(v)) ? fallback : Math.min(max, Math.max(min, Number(v)));
const integer = (v, fallback, min, max) => Math.round(number(v, fallback, min, max));
const spaces = v => Array.isArray(v) ? [...new Set(v.filter(s => SPACES.includes(s)))] : [...SPACES];
function randomFor(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function simulateWeek(answers = {}, { seed = 1 } = {}) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const properties = integer(a.properties, 1, 1, 50);
  const totalRooms = integer(a.totalRooms, properties * integer(a.roomsPerProperty, 4, 2, 15), properties * 2, properties * 15);
  const portfolio = {
    properties, totalRooms,
    rentalType: ['rooms', 'sfr', 'multifamily', 'str'].includes(a.rentalType) ? a.rentalType : 'rooms',
    fine: { enabled: a.fine?.enabled === true, amount: number(a.fine?.amount, 0, 0, 100) },
    lateThreshold: number(a.lateThreshold, 300, 0, 1000000),
    rentPerRoomPerWeek: number(a.rentPerRoomPerWeek, 200, 0, 1000000),
    hoursPerWeek: number(a.hoursPerWeek, 0, 0, 168),
    channels: Array.isArray(a.channels) ? [...new Set(a.channels.filter(c => typeof c === 'string').map(c => c.slice(0, 100)))].slice(0, 20) : [],
    houses: [],
  };
  const random = randomFor(seed);
  const events = [];
  function emit(day, time, kind, house = null, actor = 'system', data = {}) {
    const event = { t: `${DAYS[day]} ${time}`, date: `2026-11-${String(6 + day).padStart(2, '0')}`, day, kind, house, actor, ...data, ...eventCopy(kind, data) };
    events.push(event);
    return event;
  }
  emit(0, '00:00', 'portfolio', null, 'system', { rooms: totalRooms, properties });
  for (let i = 0; i < Math.min(3, properties); i++) {
    const id = `house-${i + 1}`;
    const rooms = Math.floor(totalRooms / properties) + (i < totalRooms % properties ? 1 : 0);
    const shuffled = [...names];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(random() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const members = Array.from({ length: rooms }, (_, j) => ({ id: `${id}-member-${j + 1}`, room: j + 1, name: shuffled[j], example: true }));
    const sharedSpaces = spaces(Array.isArray(a.sharedSpaces?.[0]) ? a.sharedSpaces[i] : a.sharedSpaces);
    const previous = Object.fromEntries(sharedSpaces.map((s, j) => [s, members[j % rooms].id]));
    const assignments = assignChores(members, sharedSpaces, previous);
    portfolio.houses.push({ id, rooms, members, sharedSpaces, assignments, previous });
  }
  // Choose story locations once per portfolio, with repeatable variation by seed.
  const houses = [...portfolio.houses];
  for (let j = houses.length - 1; j > 0; j--) {
    const k = Math.floor(random() * (j + 1));
    [houses[j], houses[k]] = [houses[k], houses[j]];
  }
  const choreCandidates = houses.flatMap(house => house.assignments.map(assignment => ({house, assignment})));
  const missedChore = choreCandidates.length ? choreCandidates.splice(Math.floor(random() * choreCandidates.length), 1)[0] : null;
  const otherHouseChores = choreCandidates.filter(c => c.house !== missedChore?.house);
  const retryCandidates = otherHouseChores.length ? otherHouseChores : choreCandidates;
  const retryChore = retryCandidates.length ? retryCandidates[Math.floor(random() * retryCandidates.length)] : null;
  for (const house of portfolio.houses) {
    const {id, members, assignments} = house;
    for (const member of members) {
      const chores = assignments.filter(c => c.member === member.id);
      emit(0, '12:00', 'assignment', id, member.id, { room: member.room, assignments: chores, message: true });
      if (chores.length) emit(1, '09:00', 'reminder', id, member.id, { room: member.room, message: true });
    }
    for (const assignment of assignments) {
      if (assignment === missedChore?.assignment) continue;
      const data = { assignment, room: members.find(m => m.id === assignment.member).room };
      const retry = assignment === retryChore?.assignment;
      if (retry) emit(1, '10:00', 'photo_failed', id, assignment.member, { ...data, message: true });
      emit(1, retry ? '14:00' : '12:00', 'photo_passed', id, assignment.member, { ...data, resubmission: retry, message: true });
    }
    if (assignments.length) emit(1, '17:00', 'deadline', id);
    if (house === missedChore?.house) {
      const miss = missedChore.assignment;
      const data = { assignment: miss, room: members.find(m => m.id === miss.member).room };
      emit(1, '17:01', portfolio.fine.enabled ? 'fine' : 'missed_reminder', id, miss.member, { ...data, ...(portfolio.fine.enabled ? { money: portfolio.fine.amount } : {}), message: true });
      emit(1, '17:02', portfolio.fine.enabled ? 'dispute_packet' : 'owner_note', id, 'owner', data);
    }
  }
  // Only the first story crosses the threshold. The second starts with a promise.
  const keptHouse = houses[0], missedHouse = houses[1] || keptHouse;
  const keptMember = keptHouse.members[Math.floor(random() * keptHouse.members.length)];
  const missedMembers = missedHouse.members.filter(m => m.id !== keptMember.id);
  const missedMember = missedMembers[Math.floor(random() * missedMembers.length)];
  for (const [house, member, missed] of [[keptHouse, keptMember, false], [missedHouse, missedMember, true]]) {
    const money = Math.round((portfolio.lateThreshold + Math.max(1, portfolio.rentPerRoomPerWeek)) * 100) / 100;
    const data = { money, room: member.room, promisedDate: '2026-11-12' };
    const history = [];
    history.push(emit(3, missed ? '09:30' : '09:00', 'balance_message', house.id, member.id, { ...data, previousBalance: portfolio.lateThreshold, message: true }));
    for (const [day, time, kind] of [[3,'10:00','payment_promise'],[3,'10:01','promise_recorded'],[6,'09:00','promise_reminder']]) {
      history.push(emit(day, time, kind, house.id, member.id, { ...data, message: kind !== 'promise_recorded' }));
    }
    if (missed) {
      history.push(emit(6, '17:00', 'promise_missed', house.id, member.id, data));
      emit(6, '17:01', 'owner_decision', house.id, 'owner', { ...data, history: history.map(e => ({ kind: e.kind, date: e.date, t: e.t, money: e.money })), message: true });
      emit(6, '17:02', 'notice_preview', house.id, 'owner', { preview: true, autoSent: false, calendar: [{ day: 1, date: '2026-11-13' }, { day: 4, date: '2026-11-16' }, { day: 5, date: '2026-11-17' }] });
    } else emit(6, '15:00', 'payment_received', house.id, member.id, data);
  }
  const leakHouse = houses[2] || houses[0];
  const leakMember = leakHouse.members[Math.floor(random() * leakHouse.members.length)];
  emit(4, '10:00', 'member_message', leakHouse.id, leakMember.id, { room: leakMember.room, message: true });
  emit(4, '10:01', 'ticket_created', leakHouse.id, 'system', { room: leakMember.room });
  emit(4, '10:02', 'owner_alert', leakHouse.id, 'owner', { message: true });
  emit(9, '18:00', 'week_summary');
  events.sort((a, b) => a.day - b.day || a.t.slice(4).localeCompare(b.t.slice(4)));
  const scaleFactor = events.find(e => e.kind === 'portfolio').properties / portfolio.houses.length;
  const count = kind => events.filter(e => e.kind === kind).length * scaleFactor;
  const sum = kind => events.filter(e => e.kind === kind).reduce((n, e) => n + e.money, 0) * scaleFactor;
  const assigned = events.filter(e => e.kind === 'assignment').reduce((n, e) => n + e.assignments.length, 0) * scaleFactor;
  const done = count('photo_passed');
  const memberIds = new Set(portfolio.houses.flatMap(h => h.members.map(m => m.id)));
  const reached = new Set(events.filter(e => e.message && memberIds.has(e.actor)).map(e => e.actor));
  const summary = {
    scaleFactor, label: summaryLabel(scaleFactor !== 1),
    chores: { assigned, done, completionPercent: assigned ? done / assigned * 100 : 0 },
    fines: { count: count('fine'), amount: sum('fine') },
    messagesHandled: events.filter(e => e.message).length * scaleFactor,
    ticketsOpened: count('ticket_created'),
    collections: { balancesFlagged: count('balance_message'), promised: sum('promise_recorded'), recovered: sum('payment_received'), ownerDecisions: count('owner_decision') },
    membersReached: reached.size * scaleFactor,
  };
  return { portfolio, events, summary };
}
