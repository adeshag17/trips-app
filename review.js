
// Served by the laptop, the data is embedded and this boots at once. Inside
// the phone app it arrives later, through __reviewBoot. Same cards either way.
let D = window.__REVIEW__ || null;
const el = s => document.querySelector(s);
const esc = s => String(s??'').replace(/[&<>"]/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function toast(msg, hold){
  const t = el('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t);
  if (!hold) toast.t = setTimeout(() => t.classList.remove('on'), 2600);
}

async function api(action, payload){
  // The app has no server behind it: it hands over its own writer, which
  // queues the change in the repository for the next sync to apply.
  if (window.__reviewApi) return window.__reviewApi(action, payload || {});
  const r = await fetch('/api/' + action, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Planner': '1'},
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}

/* A field is flagged when the parser left it empty, because that is what
   a person is here to fill in. */
function field(name, label, value, flag){
  return `<div><label>${esc(label)}</label>
    <input data-f="${esc(name)}" value="${esc(value ?? '')}"
      class="${flag && !value ? 'flag' : ''}"></div>`;
}

/* An ISO stamp is two things to a person: a date and a time. Splitting
   them means neither has to be typed around the other, and it lets
   departure and arrival line up in the same columns. */
function stamp(kind, iso, label){
  const [d, t] = String(iso || '').split('T');
  return `<div class="when" data-when="${kind}">
    <span class="rowlab">${esc(label)}</span>
    <input data-part="date" type="date" value="${esc(d || '')}"
      class="${d ? '' : 'flag'}">
    <input data-part="time" type="time" value="${esc(t || '')}"
      class="${t ? '' : 'flag'}">
  </div>`;
}

/* Chips for the names that are in play -- whoever the parser found, plus
   the two people on most bookings. The other dozen wait in the dropdown,
   because a wall of names nobody is travelling with is not a choice, it
   is something to read past. */
function travellerPicker(b){
  const on = new Set(b.passengers || []);
  const shown = [...new Set([...(D.regulars || []), ...on])].sort();
  const chips = shown.map(name => `<label class="who">
    <input type="checkbox" data-who value="${esc(name)}" ${on.has(name) ? 'checked' : ''}>
    ${esc(name)}</label>`).join('');
  const others = (D.people || []).filter(p => !shown.includes(p));
  const picker = others.length ? `<select data-addwho>
      <option value="">Add someone else…</option>
      ${others.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
    </select>` : '';
  return `<div class="people">
    <label>Travellers</label>
    <div class="chips">${chips}</div>
    <div class="addwho">${picker}
      <input data-newwho placeholder="or type a new name, comma separated">
    </div>
  </div>`;
}

function segmentBlock(s, i, kind){
  if (kind === 'other') return '';
  if (kind === 'hotel'){
    return `<div class="seg" data-seg="${i}">
      <div class="n">Stay</div>
      <div class="grid">
        ${field('airline', 'Property', s.airline, true)}
        ${field('origin', 'City (code)', s.origin)}
      </div>
      <div class="whengrid">
        <span class="colhead"></span><span class="colhead">Date</span>
        <span class="colhead">Time</span>
        ${stamp('depart', s.depart, 'Check in')}
        ${stamp('arrive', s.arrive, 'Check out')}
      </div></div>`;
  }
  return `<div class="seg" data-seg="${i}">
    <div class="n">Flight ${i + 1}
      <button class="tiny" data-delseg type="button">remove</button></div>
    <div class="grid">
      ${field('airline', 'Airline', s.airline, true)}
      ${field('flight_no', 'Flight', s.flight_no, true)}
      ${field('checked_kg', 'Checked bag', s.checked_kg)}
      ${field('cabin', 'Cabin', s.cabin)}
    </div>
    <div class="whengrid five">
      <span class="colhead"></span><span class="colhead">Date</span>
      <span class="colhead">Time</span><span class="colhead">Airport</span>
      <span class="colhead">Terminal</span>
      ${stamp('depart', s.depart, 'Departs')}
      <input data-f="origin" value="${esc(s.origin || '')}"
        class="${s.origin ? '' : 'flag'}">
      <input data-f="dep_terminal" value="${esc(s.dep_terminal || '')}">
      ${stamp('arrive', s.arrive, 'Arrives')}
      <input data-f="destination" value="${esc(s.destination || '')}"
        class="${s.destination ? '' : 'flag'}">
      <input data-f="arr_terminal" value="${esc(s.arr_terminal || '')}">
    </div></div>`;
}

function card(item){
  const b = item.booking;
  const kind = item.class;
  const where = b.segments && b.segments.length
    ? `${b.segments[0].origin || '?'} → ${b.segments[b.segments.length-1].destination || '?'}`
    : (item.subject || 'Something to enter');
  const title = kind === 'hotel'
    ? ((b.segments[0] && b.segments[0].airline) || 'Hotel')
    : kind === 'other' ? (item.subject || 'Other booking') : where;

  const when = b.segments && b.segments[0]
    ? (b.segments[0].depart || '').slice(0, 10) : '';
  const near = t => {
    if (!when || !t.start) return false;
    return Math.abs(new Date(when) - new Date(t.start)) < 60 * 86400000;
  };
  const tripOptions = D.trips
    .filter(t => t.named || near(t) || t.name === item.suggested_trip)
    .map(t =>
      `<option value="${esc(t.name)}" ${t.name === item.suggested_trip ? 'selected' : ''}>
         ${esc(t.name)}</option>`).join('')
    + `<option value="__new__" ${item.suggested_trip ? '' : 'selected'}>
         — name a new trip —</option>`;

  const docs = (b.files || []).filter(f => f.local || f.link).map(f =>
    `<a class="doc" target="_blank" rel="noopener"
       href="${esc(f.link || f.local)}">${esc(f.name || 'document')} ↗</a>`
  ).join('');

  const kinds = ['flight', 'hotel', 'other'].map(k =>
    `<button type="button" class="kind ${k === kind ? 'on' : ''}"
       data-kind="${k}">${k}</button>`).join('');

  return `<div class="card" data-id="${esc(item.id)}" data-class="${esc(kind)}">
    <div class="head">
      <div class="t">
        <h3>${esc(title)}</h3>
        <div class="sub">${esc(item.subject || '')}</div>
      </div>
      <div class="kinds">${kinds}</div>
      ${item.existing ? '<span class="pill dup">already on file</span>' : ''}
    </div>
    <div class="body">
      ${item.warnings.length ? `<div class="warn">Check:
        ${esc(item.warnings.join(' · '))}</div>` : ''}
      ${docs ? `<div class="docs">${docs}</div>` : ''}
      <div class="grid">
        ${field('pnrs', 'Reference', (b.pnrs || []).join(', '), true)}
        ${field('paid', 'Paid', b.paid, true)}
        ${field('currency', 'Currency', b.currency)}
        ${field('vendor', 'Booked via', b.vendor)}
        ${field('booked_on', 'Booked on', b.booked_on)}
        ${field('fare_type', kind === 'hotel' ? 'Room'
                : kind === 'other' ? 'What it is' : 'Fare', b.fare_type)}
        ${field('cancel_fee', 'Cancellation', b.cancel_fee)}
        ${kind !== 'flight' ? field('address', 'Address', b.address,
                                    kind === 'hotel') : ''}
      </div>
      ${travellerPicker(b)}
      <div class="segs">
        ${(b.segments || []).map((s, i) => segmentBlock(s, i, kind)).join('')}
      </div>
      ${kind === 'other' ? `<div class="grid">
        ${stampRow('other_when', (b.segments[0] || {}).depart, 'Date')}</div>` : ''}
      ${kind === 'flight' ? `<button class="tiny add" type="button"
        data-addseg>add a flight</button>` : ''}
      <div style="margin-top:10px"><label>Trip</label>
        <select data-trip>${tripOptions}</select>
        <input data-newtrip placeholder="Name this trip, e.g. Vietnam Dec 2026"
          style="margin-top:6px;display:${item.suggested_trip ? 'none' : 'block'}"></div>
    </div>
    <div class="foot">
      <label class="chk"><input type="checkbox" data-log checked>
        Log my changes to improve parsing</label>
      <div class="sp"></div>
      <button data-drop class="ghost">Drop</button>
      <button data-save class="primary">Save</button>
    </div></div>`;
}

/* 'Other' is a train, a ferry, a ticket to something. It has a date and a
   description, and none of the shape a flight has. */
function stampRow(name, iso, label){
  const [d, t] = String(iso || '').split('T');
  return `<div><label>${esc(label)}</label>
    <input data-part="date" data-other="1" type="date" value="${esc(d || '')}"></div>
   <div><label>Time</label>
    <input data-part="time" data-other="1" type="time" value="${esc(t || '')}"></div>`;
}

function collect(card){
  const b = {};
  card.querySelectorAll('.body > .grid [data-f]').forEach(i => {
    const name = i.dataset.f;
    let v = i.value.trim();
    if (name === 'pnrs')
      v = v ? v.split(',').map(x => x.trim()).filter(Boolean) : [];
    else if (name === 'paid') v = parseFloat(v) || 0;
    b[name] = v;
  });
  b.passengers = peopleOf(card);
  b.kind = card.dataset.class === 'flight' ? 'flight' : card.dataset.class;
  b.segments = [...card.querySelectorAll('[data-seg]')].map(seg => {
    const out = {};
    seg.querySelectorAll('[data-f]').forEach(i => out[i.dataset.f] = i.value.trim());
    // Date and time are two boxes to fill in and one value to store.
    seg.querySelectorAll('[data-when]').forEach(w => {
      const d = w.querySelector('[data-part=date]').value;
      const t = w.querySelector('[data-part=time]').value;
      out[w.dataset.when] = d ? (t ? `${d}T${t}` : d) : '';
    });
    return out;
  });
  if (b.kind === 'other'){
    const d = card.querySelector('[data-other][data-part=date]');
    const t = card.querySelector('[data-other][data-part=time]');
    const when = d && d.value ? (t && t.value ? `${d.value}T${t.value}` : d.value) : '';
    // One dateless row is still a booking; it just has nowhere to be on a
    // timeline until it has a date.
    b.segments = when ? [{airline: b.fare_type || 'Booking',
                          origin: '', destination: '',
                          depart: when, arrive: when}] : [];
  }
  return b;
}

/* Who is on this booking: whoever is ticked, plus anyone just typed in. */
function peopleOf(card){
  const picked = [...card.querySelectorAll('[data-who]:checked')]
    .map(i => i.value);
  const added = (card.querySelector('[data-newwho]').value || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  return [...new Set([...picked, ...added])];
}

/* A name added on one card is offered on the rest, in place, so edits
   already made elsewhere survive. */
function addPersonEverywhere(name){
  document.querySelectorAll('.chips').forEach(box => {
    if ([...box.querySelectorAll('[data-who]')].some(i => i.value === name))
      return;
    const label = document.createElement('label');
    label.className = 'who';
    label.innerHTML = `<input type="checkbox" data-who value="${esc(name)}"> `
      + esc(name);
    box.appendChild(label);
  });
}

/* Which trip this card is for: the one picked, or the one being named. */
function tripOf(node){
  const picked = node.querySelector('[data-trip]').value;
  if (picked !== '__new__') return picked;
  return node.querySelector('[data-newtrip]').value.trim();
}

/* Add a newly named trip to every other card's dropdown, in place, so the
   edits already made on those cards survive. */
function addTripEverywhere(name){
  document.querySelectorAll('[data-trip]').forEach(sel => {
    if ([...sel.options].some(o => o.value === name)) return;
    const opt = new Option(name, name);
    sel.insertBefore(opt, sel.querySelector('option[value="__new__"]'));
  });
}

function render(){
  const c = D.counts;
  el('#counts').textContent = c.waiting
    ? `${c.waiting} waiting · ${c.flights} flights, ${c.hotels} hotels, ${c.other} other`
    : `nothing waiting · ${D.on_file} bookings on file`;
  el('#list').innerHTML = D.items.length
    ? D.items.map(card).join('')
    : `<div class="empty">Nothing to review.<br>
       Press <b>Check email</b> to look for new confirmations.</div>`;

  el('#list').querySelectorAll('.card').forEach(node => {
    const id = node.dataset.id;
    // Switching what a booking is redraws the card, because a train has
    // no terminals and a hotel has no flight number. Edits made so far
    // are carried across rather than thrown away.
    node.querySelectorAll('[data-kind]').forEach(btn => btn.onclick = () => {
      const item = D.items.find(i => i.id === id);
      item.booking = {...item.booking, ...collect(node)};
      item.class = btn.dataset.kind;
      item.booking.kind = btn.dataset.kind;
      if (btn.dataset.kind !== 'flight' && item.booking.segments.length > 1)
        item.booking.segments = item.booking.segments.slice(0, 1);
      // Switching to something with a shape needs a row to fill in, or
      // the card offers nowhere to put the itinerary.
      if (btn.dataset.kind !== 'other' && !item.booking.segments.length)
        item.booking.segments = [{airline: '', flight_no: '', origin: '',
          destination: '', depart: '', arrive: '', dep_terminal: '',
          arr_terminal: '', checked_kg: '', cabin: ''}];
      render();
    });
    node.querySelectorAll('[data-delseg]').forEach(btn => btn.onclick = () => {
      const item = D.items.find(i => i.id === id);
      const at = +btn.closest('[data-seg]').dataset.seg;
      item.booking = {...item.booking, ...collect(node)};
      item.booking.segments.splice(at, 1);
      render();
    });
    const addSeg = node.querySelector('[data-addseg]');
    if (addSeg) addSeg.onclick = () => {
      const item = D.items.find(i => i.id === id);
      item.booking = {...item.booking, ...collect(node)};
      item.booking.segments.push({airline: '', flight_no: '', origin: '',
        destination: '', depart: '', arrive: '', dep_terminal: '',
        arr_terminal: '', checked_kg: '', cabin: ''});
      render();
    };

    const addWho = node.querySelector('[data-addwho]');
    if (addWho) addWho.onchange = () => {
      const name = addWho.value;
      addWho.value = '';
      if (!name) return;
      const box = node.querySelector('.chips');
      if ([...box.querySelectorAll('[data-who]')].some(i => i.value === name))
        return;
      const label = document.createElement('label');
      label.className = 'who';
      label.innerHTML = `<input type="checkbox" data-who checked `
        + `value="${esc(name)}"> ` + esc(name);
      box.appendChild(label);
      [...addWho.options].forEach(o => { if (o.value === name) o.remove(); });
    };

    const sel = node.querySelector('[data-trip]');
    const box = node.querySelector('[data-newtrip]');
    sel.onchange = () => {
      box.style.display = sel.value === '__new__' ? 'block' : 'none';
      if (sel.value === '__new__') box.focus();
    };
    node.querySelector('[data-save]').onclick = async (e) => {
      e.target.disabled = true;
      const trip = tripOf(node);
      const r = await api('review-save', {
        id, edits: collect(node), trip,
        log: node.querySelector('[data-log]').checked,
      });
      if (r.ok){
        toast(r.corrections ? `Saved with ${r.corrections} correction(s)` : 'Saved');
        // A trip named here is a trip the next card can be put in, without
        // waiting for a reload.
        peopleOf(node).forEach(n => {
          if (!D.people.includes(n)){ D.people.push(n); addPersonEverywhere(n); }
        });
        if (trip && !D.trips.some(t => t.name === trip)){
          D.trips.push({name: trip, start: '', named: true});
          addTripEverywhere(trip);
        }
        node.remove();
        D.items = D.items.filter(i => i.id !== id);
        D.counts.waiting = D.items.length;
        el('#counts').textContent = D.counts.waiting
          ? `${D.counts.waiting} waiting`
          : `nothing waiting · ${D.on_file} bookings on file`;
        if (!D.items.length) render();
      } else {
        toast(r.error || 'Could not save');
        e.target.disabled = false;
      }
    };
    node.querySelector('[data-drop]').onclick = async (e) => {
      e.target.disabled = true;
      const r = await api('review-drop', {id});
      if (r.ok){
        toast('Dropped');
        D.items = D.items.filter(i => i.id !== id);
        D.counts.waiting = D.items.length;
        render();
      } else { e.target.disabled = false; }
    };
  });
}

async function run(button, action, label){
  const b = el(button);
  b.disabled = true;
  const was = b.textContent;
  b.textContent = label;
  toast(label, true);
  const r = await api(action, {});
  b.disabled = false; b.textContent = was;
  toast(r.output || r.summary || 'Done');
  if (r.reload) location.reload();
}

// The laptop page has these buttons; the app's sheet does not.
if (el('#check'))
  el('#check').onclick = () => run('#check', 'check-mail', 'Reading the mailbox…');
if (el('#drive'))
  el('#drive').onclick = () => run('#drive', 'drive-update', 'Organising Drive…');

window.__reviewBoot = data => { D = data; render(); };
if (D) render();
