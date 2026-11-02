export const names = ['Avery Q.', 'Blair V.', 'Casey X.', 'Drew Z.', 'Ellis J.', 'Finley U.', 'Gray W.', 'Harper Y.', 'Indigo C.', 'Jules K.', 'Kit F.', 'Lane B.', 'Morgan D.', 'Noel G.', 'Quinn H.'];
export const reason = avoided => avoided ? "different from last week" : 'fewest chores this week';
export const summaryLabel = scaled => scaled ? 'Simulation: totals scaled from up to three example houses to the whole portfolio.' : 'Simulation: example outcomes only.';
export const hoursLabel = () => "Estimate, based on one portfolio's team: 3–6 minutes per room per week.";
export function eventCopy(kind, d = {}) {
  const money = n => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const date = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '';
  const copy = {
    portfolio: ['Your example portfolio', 'Every member and outcome below is a made-up example.'],
    assignment: ['This week\'s chores', d.assignments?.length ? d.assignments.map(a => `${a.space[0].toUpperCase()}${a.space.slice(1)} (${a.reason})`).join(', ') : 'No chore this week. Your turn comes next week.'],
    reminder: ['Friendly reminder', 'Your chore photo is due Saturday by 5 pm.'],
    deadline: ['Chore deadline', 'Photos close at 5 pm. Anything missing is marked as missed.'],
    photo_failed: ['Almost there', 'The counter still has dishes on it. Clear it and send another photo.'],
    photo_passed: ['Photo approved', 'Thanks, this one checks out.'],
    fine: ['Missed chore', `${money(d.money)} fine under your house rules. No photo came in by the deadline, and that record is kept.`],
    dispute_packet: ['Ready if they dispute it', 'The assignment, your rule, every reminder with its time, the deadline, and the missing-photo record, in one packet.'],
    missed_reminder: ['Photo still missing', 'We still need your chore photo. Please send it when you can.'],
    owner_note: ['Missed chore', 'No photo came in by the deadline. You don\'t fine, so this is for your records.'],
    balance_message: ['Balance reminder', `Hi, your balance is ${money(d.money)}. Can you reply with the date and amount you can pay?`],
    payment_promise: ['Member replied', `I can pay ${money(d.money)} on ${date(d.promisedDate)}.`],
    promise_recorded: ['Promise saved', `${money(d.money)} promised for ${date(d.promisedDate)}. A reminder goes out that morning.`],
    promise_reminder: ['Payment reminder', `Just a reminder: you said you'd pay ${money(d.money)} today.`],
    payment_received: ['Promise kept', `${money(d.money)} paid, right on time.`],
    promise_missed: ['Promise missed', 'The promised payment didn\'t come in.'],
    owner_decision: ['Your call: payment plan or notice?', 'Here\'s the full history: the balance, the reminder, the promise and the miss. Nothing happens until you decide.'],
    notice_preview: ['Notice timeline (preview)', 'If you choose a notice, these are the dates we\'d track for you. Example dates only, not legal advice.'],
    member_message: ['Member texted', 'Hey, the kitchen sink is leaking.'],
    ticket_created: ['Repair ticket opened', 'Kitchen sink leak, logged from the member\'s text.'],
    owner_alert: ['New repair ticket', 'Kitchen sink leak. The member has been told it\'s logged.'],
    week_summary: ['That\'s your week', 'Example outcomes only. The totals are at the top.'],
  };
  const [title, detail] = copy[kind];
  return { title, detail };
}
