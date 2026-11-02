import { reason } from './copy.js';
export function assignChores(members, spaces, previous = {}) {
  if (!members.length) return [];
  const loads = new Map(members.map(m => [m.id, 0]));
  return spaces.map(space => {
    const min = Math.min(...loads.values());
    const candidates = members.filter(m => loads.get(m.id) === min);
    const member = candidates.find(m => m.id !== previous[space]) ?? candidates[0];
    loads.set(member.id, loads.get(member.id) + 1);
    return { space, member: member.id, reason: reason(Boolean(previous[space]) && previous[space] !== member.id) };
  });
}
