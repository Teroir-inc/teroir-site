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
    const summary=$('#summary'), timeline=$('#timeline');summary.replaceChildren();timeline.replaceChildren();
    function metrics(object,prefix='') {
      for (const [key,value] of Object.entries(object || {})) {
        const label=(prefix + key.replace(/([a-z])([A-Z])/g,'$1 $2')).replace(/_/g,' ');
        if (value && typeof value === 'object' && !Array.isArray(value)) {metrics(value,label+' · ');continue;}
        const dl=document.createElement('dl');add(dl,'dt',label);add(dl,'dd',Array.isArray(value) ? value.join('–') : String(value ?? '—'));summary.append(dl);
      }
    }
    metrics(result.summary);
    // Preserve the engine's week order (Fri, Sat, Mon…Sun), including any repeated day groups.
    let day=null, list;
    for (const event of result.events || []) {
      if (event.day !== day) {day=event.day;add(timeline,'h3',day);list=document.createElement('ol');timeline.append(list);}
      const item=document.createElement('li');list.append(item);
      add(item,'small',[event.t,event.house != null ? `House ${event.house}` : '',event.room != null ? `Room ${event.room}` : ''].filter(Boolean).join(' · '));
      add(item,'h4',event.title);add(item,'p',event.detail);
      if (event.actor) add(item,'p',typeof event.actor === 'object' ? event.actor.name || 'Example member' : event.actor);
      if (typeof event.money === 'number') add(item,'p',new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(event.money));
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
