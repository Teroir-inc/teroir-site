// wyattworldwide.com district passes. A pass is a signed link (no accounts): sign(`district:<id>`, email, days).
// Content lives here, server side, so a locked district's lessons and downloads never ship in the page.
// status: 'open' (live, sellable), 'soon' (shown as opening soon, never sold), 'link' (goes elsewhere).
// Prices in cents, USD. PROPOSED mapping, waiting on Wyatt's yes before the domain goes live.
const WW = 'https://wyattworldwide.com';
const DISTRICTS = [
  { id: 'free-street', key: 'free', name: 'Free Street', status: 'open', price: 0, kind: 'free day pass',
    line: 'your free day pass: a starter guide, sent to your inbox.', guides: [], lessons: [] },
  { id: 'the-lab', key: 'lab', name: 'The Lab', status: 'open', price: 9700, kind: 'upgrade',
    line: 'two deep guides: Make Claude build it, and Build the harness.', guides: ['claude-artifacts', 'harness-engineering'], lessons: [] },
  { id: 'the-studio', key: 'studio', name: 'The Studio', status: 'soon', price: 9700, kind: 'upgrade',
    line: 'content systems and pipelines, the way this channel is made.', guides: ['agent-engineering'], lessons: [] },
  { id: 'rooftop-hq', key: 'hq', name: 'Rooftop HQ', status: 'open', price: 24900, kind: 'all-access pass',
    line: 'all seven guides, and every open district.', guides: 'all', lessons: [] },
  { id: 'vip', key: 'vip', name: 'VIP', status: 'link', price: 20000, kind: 'vip tour',
    line: '1:1 with wyatt, by appointment.', href: 'https://teroir.com/talk?for=coaching&src=wyattworldwide-vip', guides: [], lessons: [] },
];
const BY_DISTRICT = Object.fromEntries(DISTRICTS.map(d => [d.id, d]));
const OPEN = DISTRICTS.filter(d => d.status === 'open').map(d => d.id);

// Does a pass for `held` open district `want`? Rooftop opens every open district; any pass opens Free Street.
const opens = (held, want) => held === want || held === 'rooftop-hq' || (want === 'free-street' && !!BY_DISTRICT[held]);

module.exports = { WW, DISTRICTS, BY_DISTRICT, OPEN, opens };
