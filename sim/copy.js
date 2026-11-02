export const names = ['Avery Q.', 'Blair V.', 'Casey X.', 'Drew Z.', 'Ellis J.', 'Finley U.', 'Gray W.', 'Harper Y.', 'Indigo C.', 'Jules K.', 'Kit F.', 'Lane B.', 'Morgan D.', 'Noel G.', 'Quinn H.'];
export const reason = avoided => avoided ? "didn't do this space last week" : 'fewest chores this week';
export const summaryLabel = scaled => scaled ? 'Simulation: totals scaled from up to three example houses to the whole portfolio.' : 'Simulation: example outcomes only.';
export const hoursLabel = () => "Estimate, based on one portfolio's team: 3–6 minutes per room per week.";
export function eventCopy(kind, d = {}) {
  const money = n => `$${Number(n).toFixed(2)}`;
  const copy = {
    portfolio: ['Example portfolio', 'All members and outcomes are fictional examples.'],
    assignment: ['Your weekly chores', d.assignments?.length ? d.assignments.map(a => `${a.space}: ${a.reason}`).join('; ') : 'No chore assigned this week.'],
    reminder: ['Chore reminder', 'Send a photo by Saturday at 17:00.'],
    deadline: ['Chore deadline', 'Photo review closes at 17:00.'],
    photo_failed: ['Photo needs another try', 'Checklist item failed: the surface is not clear. Please clear it and send another photo.'],
    photo_passed: ['Photo accepted', 'The photo passes the example checklist.'],
    fine: ['Missed chore', `${money(d.money)} under your example policy; photo proof: none received by deadline.`],
    dispute_packet: ['Example dispute packet', 'Would contain the assignment, policy and amount, reminder timestamps, deadline, missing-photo record, and member reply history.'],
    missed_reminder: ['Photo still missing', 'Please send your chore photo. No fine is enabled.'],
    owner_note: ['Missed chore for review', 'Photo proof: none received by deadline. Fines are disabled.'],
    balance_message: ['Balance crossed your threshold', `Your example balance is ${money(d.money)}.`],
    payment_promise: ['Member payment promise', `I will pay ${money(d.money)} on ${d.promisedDate}.`],
    promise_recorded: ['Promise recorded', `${money(d.money)} promised for ${d.promisedDate}.`],
    promise_reminder: ['Payment reminder', `${money(d.money)} is promised today, ${d.promisedDate}.`],
    payment_received: ['Promise kept', `${money(d.money)} received in this simulation.`],
    promise_missed: ['Promise missed', 'No payment received by the promised deadline in this simulation.'],
    owner_decision: ['Payment plan or notice', 'Review the balance, message, dated promise, reminder, and missed payment history. Humans decide notices.'],
    notice_preview: ['PREVIEW: notice calendar', 'Day 1: human review. Day 4: review status. Day 5: human decision. Illustrative dates only; not a legal schedule. Humans decide notices; nothing is auto-sent.'],
    member_message: ['Member message', 'kitchen sink is leaking'],
    ticket_created: ['Maintenance ticket created', 'Kitchen sink leak recorded for follow-up.'],
    owner_alert: ['Maintenance alert', 'Review the kitchen sink leak ticket.'],
    week_summary: ['Your simulated week', 'Example outcomes only. Review the computed summary.'],
  };
  const [title, detail] = copy[kind];
  return { title, detail };
}
