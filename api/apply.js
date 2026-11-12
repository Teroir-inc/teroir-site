const NOTIFY_TO = ['wyatt@teroir.com'];
const FROM = 'Teroir Beta <waitlist@teroir.com>';
const EMAIL_RE = /^[^\s@<>"]{1,100}@[^\s@<>"]{1,100}\.[^\s@<>"]{2,24}$/;
const clean = (v, n) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, '').trim().slice(0, n);
const CHOICES = {
  "rentalType": [
    "Rooms in shared houses",
    "Single-family",
    "Apartments",
    "Short-term"
  ],
  "sharedSpaces": [
    "Kitchen",
    "Bathrooms",
    "Living room",
    "Laundry",
    "Garbage & recycling",
    "Yard"
  ],
  "channels": [
    "PadSplit",
    "Airbnb",
    "Furnished Finder",
    "Facebook/Craigslist",
    "Direct leases",
    "Other"
  ],
  "software": [
    "AppFolio",
    "Buildium",
    "RentRedi",
    "DoorLoop",
    "Spreadsheets",
    "None",
    "Other"
  ],
  "contactChannels": [
    "PadSplit inbox",
    "Text",
    "WhatsApp",
    "Email",
    "Phone"
  ],
  "operator": [
    "Me",
    "A manager",
    "A VA",
    "A team"
  ],
  "timeSinks": [
    "Late rent & collections",
    "Member messages",
    "Repairs & maintenance",
    "Cleanliness & chores",
    "Move-ins/move-outs",
    "Fines & disputes",
    "Ratings & reviews"
  ],
  "choreSchedule": [
    "Yes",
    "No",
    "Sort of"
  ],
  "fineEnabled": [
    "No",
    "Yes"
  ],
  "pilot": [
    "Yes",
    "Maybe",
    "Not now"
  ],
  "start": [
    "This month",
    "Next month",
    "Later"
  ],
  "decisionMaker": [
    "Yes",
    "I share it",
    "No"
  ]
};
const MULTI = new Set(['sharedSpaces', 'channels', 'contactChannels', 'timeSinks']);
async function send(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`resend ${r.status}`);
  return r.json();
}
module.exports = async (req, res) => {
  const wantsJson = String(req.headers['content-type'] || '').includes('application/json');
  const reply = (status, body) => {
    if (wantsJson) return res.status(status).json(body);
    if (body.ok) { res.setHeader('Location', '/apply?submitted=1'); return res.status(303).end(); }
    return res.status(status).send('Something went wrong. Please email wyatt@teroir.com.');
  };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ok:false,error:'method'}); }
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const t = Number(b.t);
  if (clean(b.website, 200) || (t && Date.now() - t < 2500)) return reply(200, {ok:true});
  const a = {name:clean(b.name,120), email:clean(b.email,200).toLowerCase()};
  if (!a.name) return reply(400,{ok:false,error:'name'});
  if (!EMAIL_RE.test(a.email)) return reply(400,{ok:false,error:'email'});
  for (const [key,max] of [['properties',10000],['rooms',100000]]) {
    const n = Number(b[key]);
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return reply(400,{ok:false,error:key});
    a[key] = Math.min(n,max);
  }
  for (const [key,max] of [['phone',40],['cities',300],['rules',4000],['referral',300]]) a[key] = clean(b[key],max);
  for (const [key,options] of Object.entries(CHOICES)) {
    if (MULTI.has(key)) {
      const raw = Array.isArray(b[key]) ? b[key] : [b[key]];
      a[key] = [...new Set(raw.filter(v=> typeof v === 'string' && options.includes(v)))].slice(0,key === 'timeSinks' ? 3 : options.length);
    } else a[key] = options.includes(b[key]) ? b[key] : '';
  }
  for (const [key,max,fallback] of [['hoursPerWeek',168,null],['fineAmount',100,0],['lateThreshold',100000,300],['weeklyRent',100000,null]]) {
    const n = Number(b[key]);
    a[key] = b[key] === '' || b[key] == null || !Number.isFinite(n) ? fallback : Math.min(max,Math.max(0,n));
  }
  const tier = a.rooms >= 20 && a.decisionMaker === 'Yes' && a.start === 'This month' ? 'HOT' : a.rooms >= 5 || a.pilot === 'Yes' ? 'WARM' : 'NEW';
  if (!process.env.RESEND_API_KEY) { console.error('apply: RESEND_API_KEY missing'); return reply(500,{ok:false,error:'config'}); }
  const steps = [
    ['Portfolio',['name','email','phone','properties','rooms','cities','rentalType','sharedSpaces']],
    ['How it runs today',['channels','software','contactChannels','operator','hoursPerWeek','timeSinks']],
    ['Your rules',['choreSchedule','fineEnabled','fineAmount','lateThreshold','weeklyRent','rules']],
    ['Readiness',['pilot','start','decisionMaker','referral']],
  ];
  const LABELS = {name:'Name',email:'Email',phone:'Phone',properties:'Properties',rooms:'Rooms / units',cities:'Cities',rentalType:'Rental type',sharedSpaces:'Shared spaces',
    channels:'Lists on',software:'Software',contactChannels:'Members reach them by',operator:'Runs the week',hoursPerWeek:'Hours a week on operations',timeSinks:'Biggest time sinks',
    choreSchedule:'Chore schedule',fineEnabled:'Fines for missed chores',fineAmount:'Fine amount ($)',lateThreshold:'Acts on a late balance at ($)',weeklyRent:'Weekly rent per room ($)',rules:'House rules',
    pilot:'Free 4-week pilot',start:'Earliest start',decisionMaker:'Decision-maker',referral:'Heard about us'};
  const show = v => Array.isArray(v) ? v.join(', ') || '(not given)' : v === '' || v == null ? '(not given)' : v;
  const lines = steps.flatMap(([title,keys])=>[title.toUpperCase(),...keys.map(k=>`${LABELS[k]}: ${show(a[k])}`),'']);
  lines.push(`Tier: ${tier}`, 'Answers JSON:', JSON.stringify(a));
  try {
    await send({from:FROM,to:NOTIFY_TO,reply_to:a.email,
      subject:`Teroir beta [${tier}] · ${a.rooms} rooms · ${a.channels[0] || 'Not specified'} · ${a.start || 'Not specified'}`,text:lines.join('\n')});
  } catch { console.error('apply notify failed'); return reply(502,{ok:false,error:'send'}); }
  try {
    await send({from:FROM,to:[a.email],reply_to:'wyatt@teroir.com',subject:'Your Teroir beta application',
      text:"Thanks for applying to the Teroir beta.\n\nI read every application myself, and I'll reach out within two days to talk about your portfolio and what a pilot would look like.\n\nIf you want to talk sooner, text or call me at (801) 835-9054.\n\nWyatt Horton\nFounder, Teroir\nhttps://teroir.com"});
  } catch { console.error('apply confirmation failed'); }
  return reply(200,{ok:true});
};

// Run offline regression checks with: node teroir/site/api/apply.js
// Kept here to preserve the specification’s six-file scope. Never runs on import.
if (require.main === module) {
  const assert = require('node:assert/strict');
  const handler = module.exports;
  process.env.RESEND_API_KEY = require('node:crypto').randomUUID();
  const base = {name:'Example Applicant',email:'example@example.com',properties:3,rooms:24,decisionMaker:'Yes',start:'This month',channels:['PadSplit'],pilot:'Yes',t:Date.now()-10000};
  let sent=[],fail=0;
  global.fetch=async (_,o)=>{sent.push(JSON.parse(o.body));return {ok:sent.length!==fail,status:500,json:async()=>({}),text:async()=> 'stub failure'};};
  async function call(body=base,method='POST',type='application/json') {sent=[];let result={};const res={status(n){result.status=n;return this},json(b){result.body=b;return this},send(b){result.body=b;return this},end(){return this},setHeader(k,v){result[k]=v}};await handler({method,headers:{'content-type':type},body},res);return result;}
  (async()=>{
  assert.equal((await call()).status,200);assert.equal(sent.length,2);assert.match(sent[0].subject,/\[HOT\]/);assert.match(sent[1].text,/within two days/);
  for(const [extra,tier] of [[{rooms:5},'WARM'],[{rooms:1,pilot:'Not now'},'NEW']]){await call({...base,...extra});assert.match(sent[0].subject,new RegExp('\\['+tier+'\\]'));}
  for(const extra of [{name:''},{email:'bad'},{rooms:0},{properties:'bad'},{rooms:Infinity}]) assert.equal((await call({...base,...extra})).status,400);
  assert.equal((await call(base,'GET')).status,405);
  for(const extra of [{website:'bot'},{t:Date.now()}]){assert.equal((await call({...base,...extra})).status,200);assert.equal(sent.length,0);}
  await call({...base,rooms:1e9,channels:['bogus','PadSplit','PadSplit'],rules:'x'.repeat(5000),sharedSpaces:['bad'],fineAmount:999});
  let answers=JSON.parse(sent[0].text.split('\n').at(-1));assert.equal(answers.rooms,100000);assert.deepEqual(answers.channels,['PadSplit']);assert.equal(answers.rules.length,4000);assert.deepEqual(answers.sharedSpaces,[]);assert.equal(answers.fineAmount,100);
  fail=1;assert.equal((await call()).status,502);fail=2;assert.equal((await call()).status,200);fail=0;
  assert.equal((await call(base,'POST','application/x-www-form-urlencoded')).status,303);
  console.log('PASS: API validation, tiers, sanitization, bot checks, JSON/form responses, notification failures');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
