/* The simulator owns its own clamping; this adapter translates the form's labels. */
function toSimInput(answers) {
  const spaces = {Kitchen:'kitchen',Bathrooms:'bathroom','Living room':'living room',Laundry:'laundry','Garbage & recycling':'garbage'};
  return {
    properties:Number(answers.properties), totalRooms:Number(answers.rooms),
    rentalType:({'Rooms in shared houses':'rooms','Single-family':'sfr',Apartments:'multifamily','Short-term':'str'})[answers.rentalType] || 'rooms',
    sharedSpaces:(answers.sharedSpaces || []).map(s=>spaces[s]).filter(Boolean),
    fine:{enabled:answers.fineEnabled === 'Yes',amount:Number(answers.fineAmount || 0)},
    lateThreshold:answers.lateThreshold === '' ? 300 : Number(answers.lateThreshold ?? 300),
    rentPerRoomPerWeek:answers.weeklyRent === '' ? 200 : Number(answers.weeklyRent ?? 200),
    channels:answers.channels || [], hoursPerWeek:Number(answers.hoursPerWeek || 0),
  };
}
(() => {
  'use strict';
  const $ = s=>document.querySelector(s);
  const form = $('#apply-form'), steps = [...document.querySelectorAll('.form-step')];
  const error = $('#form-error'), next = $('#next'), back = $('#back');
  const key = 'teroir-apply-v1', started = Date.now();
  const multi = ['sharedSpaces','channels','contactChannels','timeSinks'];
  let step = 0, submittedAnswers = null;
  function answers() {
    const data = new FormData(form), result = Object.fromEntries(data);
    multi.forEach(k=>{result[k]=data.getAll(k);});
    return result;
  }
  function save() {
    const a = answers(); delete a.website;
    try { localStorage.setItem(key,JSON.stringify({step,answers:a})); } catch { /* Storage may be unavailable. */ }
  }
  function show(focus = true) {
    steps.forEach((el,i)=>{el.hidden=i !== step;});
    $('#progress').textContent = `Step ${step + 1} of 4`;
    $('#progress-fill').style.width = `${(step+1)*25}%`;
    back.hidden=step === 0;
    next.textContent=step === 3 ? 'Send application →' : 'Next →';
    error.textContent='';
    if (focus) steps[step].querySelector('h2').focus();
  }
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && saved.answers && typeof saved.answers === 'object') {
      step = Number.isInteger(saved.step) ? Math.max(0,Math.min(3,saved.step)) : 0;
      for (const el of form.elements) {
        if (!el.name || el.name === 'website' || saved.answers[el.name] == null) continue;
        const value = saved.answers[el.name];
        if (el.type === 'checkbox') el.checked=Array.isArray(value) && value.includes(el.value);
        else if (el.type === 'radio') el.checked=value === el.value;
        else el.value=String(value).slice(0,el.maxLength > 0 ? el.maxLength : 4000);
      }
    }
  } catch { /* A corrupt draft must not prevent a fresh application. */ }
  const params = new URLSearchParams(location.search);
  for (const name of ['name','email']) if (params.has(name)) {
    const el = form.elements.namedItem(name); el.value=params.get(name).slice(0,el.maxLength);
  }
  if (params.has('name') || params.has('email')) {
    params.delete('name'); params.delete('email');
    history.replaceState(null,'',location.pathname + (params.size ? '?' + params : '') + location.hash);
    save();
  }
  show(false);
  form.addEventListener('input',save);
  form.addEventListener('change',ev=>{
    if (ev.target.name === 'timeSinks' && answers().timeSinks.length > 3) {
      ev.target.checked=false; error.textContent='Please choose up to three time sinks.';
    }
    save();
  });
  back.addEventListener('click',()=>{step--;show();save();});
  function validate(index) {
    const invalid = [...steps[index].querySelectorAll('input,textarea')].find(el=>!el.checkValidity() || (el.required && !el.value.trim()));
    if (invalid) {
      step=index;show();error.textContent=`Please fill in “${invalid.closest('label').querySelector('span').textContent.replace(' *','').trim()}” to continue.`;
      invalid.focus();return false;
    }
    if (index === 1 && answers().timeSinks.length > 3) {
      step=index;show();error.textContent='Please choose up to three time sinks.';return false;
    }
    return true;
  }
  function thanks() {
    form.hidden=true;$('#thanks').hidden=false;$('#thanks-title').focus();
  }
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    if (!validate(step)) return;
    if (step < 3) {step++;show();save();return;}
    for (let i=0;i<4;i++) if (!validate(i)) return;
    next.disabled=true;back.disabled=true;error.textContent='Sending…';
    const a=answers();
    try {
      const response=await fetch('/api/apply',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({...a,t:started})});
      const result=await response.json();
      if (!response.ok || !result.ok) throw new Error('Application failed');
      submittedAnswers=a;
      try {localStorage.removeItem(key);} catch { /* Submission still succeeded. */ }
      thanks();
    } catch {
      error.textContent='That did not go through. Please try again, or call Wyatt at (801) 835-9054.';
    } finally {next.disabled=false;back.disabled=false;}
  });
  if (params.get('submitted') === '1') {thanks();$('#simulate').hidden=true;}
  function add(parent,tag,text) {const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;}
  function render(result) {
    const summary=$('#summary'), timeline=$('#timeline');
    summary.replaceChildren();timeline.replaceChildren();
    const {portfolio,events,summary:s}=result;
    const whole=n=>Math.round(Number(n) || 0).toLocaleString('en-US');
    const dollars=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n) || 0);
    const dateLabel=value=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
    const members=new Map(), houses=new Map();
    portfolio.houses.forEach((house,i)=>{
      houses.set(house.id,`House ${i+1}`);
      house.members.forEach(member=>members.set(member.id,member));
    });
    // Engine copy includes machine dates and decimal currency; format these before display.
    const readable=value=>String(value ?? '')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g,dateLabel)
      .replace(/\$([\d,]+(?:\.\d+)?)/g,(_,n)=>dollars(Number(n.replace(/,/g,''))))
      .replace(/house-\d+-member-\d+/g,id=>members.get(id)?.name.split(' ')[0] || 'Example member')
      .replace(/house-\d+/g,id=>houses.get(id) || 'Example house');
    function card(label,value,note) {
      const dl=document.createElement('dl');
      add(dl,'dt',label);add(dl,'dd',value);
      if (note) add(dl,'dd',note).className='summary-note';
      summary.append(dl);
    }
    card('Chores done',`${whole(s.chores.done)} of ${whole(s.chores.assigned)}`,`${whole(s.chores.completionPercent)}% completion`);
    card('Fines',portfolio.fine.enabled ? dollars(s.fines.amount) : 'No fines — you don’t fine',
      portfolio.fine.enabled ? `${whole(s.fines.count)} fines, each with the record behind it` : '');
    card('Collections',`${dollars(s.collections.recovered)} recovered`,
      `of ${dollars(s.collections.promised)} promised · ${whole(s.collections.ownerDecisions)} decisions left for you`);
    card('Messages handled',whole(s.messagesHandled));
    card('Maintenance requests opened',whole(s.ticketsOpened));
    card('Members reached',whole(s.membersReached));
    add(summary,'p',readable(s.label)).className='summary-label';
    const alertKinds=new Set(['owner_decision','notice_preview','owner_alert','owner_note','dispute_packet']);
    let disclosureId=0;
    function toggle(parent,content,closed,open,className) {
      const button=add(parent,'button',closed);
      button.type='button';button.className=className;
      content.id=`sim-details-${++disclosureId}`;content.hidden=true;
      button.setAttribute('aria-controls',content.id);button.setAttribute('aria-expanded','false');
      button.addEventListener('click',()=>{
        content.hidden=!content.hidden;
        button.setAttribute('aria-expanded',String(!content.hidden));
        button.textContent=content.hidden ? closed : open;
      });
    }
    function clock(hhmm) {
      if (!hhmm) return '';
      let [h,m]=hhmm.split(':').map(Number);const ap=h >= 12 ? 'pm' : 'am';h=h % 12 || 12;
      return m ? `${h}:${String(m).padStart(2,'0')} ${ap}` : `${h} ${ap}`;
    }
    const GROUPS={assignment:['Chore assignments sent to','Hide chore assignments'],reminder:['Reminders sent to','Hide reminders']};
    function eventCard(parent,event) {
      const item=document.createElement('li');parent.append(item);
      const member=members.get(event.actor) || portfolio.houses.find(h=>h.id === event.house)?.members.find(m=>m.room === event.room);
      const actor=event.actor === 'owner' ? 'You' : event.actor === 'system' ? 'PM.BOS' : member?.name.split(' ')[0] || 'Example member';
      const room=event.room ?? member?.room;
      const isMemberMessage=event.message && member && event.actor !== 'owner';
      item.className=alertKinds.has(event.kind) ? 'sim-event sim-alert' : isMemberMessage ? 'sim-event sim-message' : 'sim-event';
      const time=event.kind === 'portfolio' ? '' : clock(event.t.match(/\d{2}:\d{2}/)?.[0] || '');
      add(item,'p',[time,houses.get(event.house),actor,room != null ? `Room ${whole(room)}` : ''].filter(Boolean).join(' · ')).className='event-meta';
      add(item,'h4',readable(event.title));add(item,'p',readable(event.detail));
      if (typeof event.money === 'number') add(item,'p',dollars(event.money)).className='event-money';
      if (event.kind === 'notice_preview') {
        add(item,'p','Preview — never sent automatically. You decide.').className='notice-warning';
        if (event.calendar?.length) {
          const calendar=document.createElement('ul');item.append(calendar);
          event.calendar.forEach(entry=>add(calendar,'li',`Day ${whole(entry.day)} · ${dateLabel(entry.date)}`));
        }
      }
    }
    const days=new Map();
    [...events].sort((a,b)=>a.day-b.day || a.t.localeCompare(b.t)).forEach(event=>{
      if (!days.has(event.date)) days.set(event.date,[]);
      days.get(event.date).push(event);
    });
    for (const [date,dayEvents] of days) {
      const section=document.createElement('section');section.className='sim-day';timeline.append(section);
      add(section,'h3',dateLabel(date));
      const entries=[], assignments=new Map();
      for (const event of dayEvents) {
        if (GROUPS[event.kind]) {
          const k=event.kind+'|'+event.house;
          if (!assignments.has(k)) {
            const group={house:event.house,kind:event.kind,t:event.t,events:[]};assignments.set(k,group);entries.push(group);
          }
          assignments.get(k).events.push(event);
        } else entries.push(event);
      }
      function renderEntry(parent,entry) {
        if (!entry.events) {eventCard(parent,entry);return;}
        const item=document.createElement('li');item.className='assignment-group';parent.append(item);
        add(item,'p',`${clock(entry.t.match(/\d{2}:\d{2}/)?.[0] || '')} · ${houses.get(entry.house)} · PM.BOS`).className='event-meta';
        const list=document.createElement('ol');list.className='assignment-details';
        toggle(item,list,`${GROUPS[entry.kind][0]} ${whole(entry.events.length)} members — show all`,GROUPS[entry.kind][1],'assignment-toggle');
        item.append(list);entry.events.forEach(event=>eventCard(list,event));
      }
      const first=document.createElement('ol');first.className='day-events';section.append(first);
      entries.slice(0,6).forEach(entry=>renderEntry(first,entry));
      if (entries.length > 6) {
        const rest=document.createElement('ol');rest.className='day-events';
        entries.slice(6).forEach(entry=>renderEntry(rest,entry));
        toggle(section,rest,`Show all ${whole(dayEvents.length)}`,'Show fewer events','day-toggle');
        section.append(rest);
      }
    }
    $('#simulation').hidden=false;$('#simulation h2').focus();
  }
  $('#simulate').addEventListener('click',async()=>{
    const button=$('#simulate');button.disabled=true;
    let engine;
    try {engine=await import('./sim/engine.js');} catch {
      button.hidden=true;$('#sim-status').textContent='The simulation is not available yet. Your application has been received.';return;
    }
    try {
      const seed=42;
      render(engine.simulateWeek(toSimInput(submittedAnswers),{seed}));
      button.hidden=true;
    } catch {
      $('#sim-status').textContent='The simulation could not load. Your application has been received.';
    } finally {button.disabled=false;}
  });
})();
