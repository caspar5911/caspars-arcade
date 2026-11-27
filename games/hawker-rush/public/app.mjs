import * as E from './engine.mjs';
import * as Art from './art.mjs';
import * as F from './feel.mjs';
import * as Co from './coop.mjs';
import { challengeUrl, parseChallenge, readBoard, startRankedRun, submitScore } from './competition.mjs';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'hawker-rush-save';
const pages = ['home', 'intro', 'shift', 'shop', 'boards', 'coop'];
const stationActions = { toaster: 'Toast bread', pot: 'Boil eggs', grill: 'Grill satay' };
const people = Object.fromEntries(E.PEOPLE.map(person => [person.id, person.name]));
const ingredientLabels = { milk: 'Milk', soy: 'Soy', peanut: 'Peanut' };
const cents = value => Math.round(value * 100);
const money = value => '$' + (value % 1 ? value.toFixed(2) : value.toFixed(0));
const duration = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const scoreText = (mode, value) => mode === 'speed' ? `${(value / 100).toFixed(2)} s` : money(value / 100);
const starsText = count => '★'.repeat(count) + '☆'.repeat(3 - count);

function boundedInt(value, min, max, fallback = min) {
  return Number.isSafeInteger(value) ? Math.max(min, Math.min(value, max)) : fallback;
}

function loadSave() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    raw = null;
  }
  // V1 story days, wallet, and shop ownership carry over. V1 daily scores used different rules.
  // (story days restart for first-version players: the dishes are all new, so they get the recipe cards and the guide)
  const day = raw?.version === 2 ? boundedInt(raw?.day, 1, Number.MAX_SAFE_INTEGER - 1) : 1;
  const best = {};
  for (const [id, stars] of Object.entries(raw?.version === 2 ? raw?.best ?? {} : {})) {
    if (/^[1-9]\d*$/.test(id) && Number(id) <= day) best[id] = boundedInt(stars, 0, 3);
  }
  const upgrades = {};
  for (const [id, upgrade] of Object.entries(E.UPGRADES)) {
    const level = boundedInt(raw?.upgrades?.[id], 0, upgrade.costs.length);
    if (level) upgrades[id] = level;
  }
  const decor = {};
  for (const id of Object.keys(E.DECOR)) {
    if (raw?.decor?.[id] === true) decor[id] = true;
  }
  const records = { daily: {}, speed: {} };
  for (const mode of Object.keys(records)) {
    if (raw?.version !== 2) break;
    for (const [key, value] of Object.entries(raw?.records?.[mode] ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isSafeInteger(value) && value >= 0) records[mode][key] = value;
    }
  }
  return {
    version: 2, day, best, upgrades, decor, records,
    wallet: Number.isFinite(raw?.wallet) && raw.wallet > 0 ? raw.wallet : 0,
    guided: raw?.guided === true || day > 1,
    nickname: typeof raw?.nickname === 'string' ? raw.nickname.slice(0, 16) : '',
    totals: Object.fromEntries(['served', 'shifts'].map(key => [
      key, boundedInt(raw?.totals?.[key], 0, Number.MAX_SAFE_INTEGER),
    ])),
  };
}

const save = loadSave();
let page = 'home';
let pending = null;
let run = null;
let shift = null;
let result = null;
let drag = null;
let suppressClick = null;
let hintOverride = null;
let boardMode = 'speed';
let boardRequest = 0;
let shopReturn = 'home';

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be disabled. The current visit still retains progress.
  }
}

function button(label, className = '') {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  if (className) el.className = className;
  return el;
}

function show(next, title, subtitle = '') {
  page = next;
  for (const id of pages) $(id).hidden = id !== next;
  document.body.classList.toggle('in-shift', next === 'shift');
  $('pause').hidden = next !== 'shift';
  $('hudTitle').textContent = title;
  $('hudSub').textContent = subtitle;
  window.scrollTo(0, 0);
}

function focusHeading(el) {
  el.tabIndex = -1;
  el.focus({ preventScroll: true });
}

function closeDialog(id) {
  if ($(id).open) $(id).close();
}

function openDialog(id) {
  if (!$(id).open) $(id).showModal();
}

function setContent(el, html) {
  if (el.html !== html) {
    el.html = html;
    el.innerHTML = html;
  }
}

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function stopShift() {
  if (run) cancelAnimationFrame(run.frame);
  clearDrag();
  run = null;
  shift = null;
  $('fx').replaceChildren();
}

function stall(decor) {
  return Art.stallTop(decor) + (decor.plants
    ? '<span class="plant left">🪴</span><span class="plant right">🪴</span>' : '');
}

function activeKey(mode) {
  return mode === 'speed' ? E.speedRun().key : E.dayKey();
}

function home({ focus = true } = {}) {
  if (Co.current()) {
    stopListening?.();
    Co.leave();
  }
  $('team').hidden = true;
  try {
    screen.orientation?.unlock?.();
  } catch {
    // (nothing locked)
  }
  closeDialog('results');
  closeDialog('paused');
  closeDialog('recipes');
  stopShift();
  result = null;
  pending = null;
  if (F.musicPlaying() && !F.musicCalm()) F.musicStop();
  F.musicStart(true);
  show('home', 'Hawker Rush');
  $('homeStall').innerHTML = stall(save.decor) +
    `<div class="home-portraits">${Art.person('auntie', 'happy')}${Art.cat('cheer')}${Art.dish('cup', ['kopi', 'milk'], { face: true })}${Art.person('uncle', 'happy')}</div>`;
  $('play').textContent = save.day > E.DAYS ? `Play endless day ${save.day}` : `Play day ${save.day}`;
  $('wallet').textContent = money(save.wallet);
  const today = E.daily();
  const dailyBest = save.records.daily[today.key];
  const speedBest = save.records.speed[activeKey('speed')];
  $('dailyBest').textContent = dailyBest === undefined ? 'A new shift every day' : `Best ${scoreText('daily', dailyBest)}`;
  $('speedBest').textContent = speedBest === undefined ? `Serve ${E.SPEED_CUSTOMERS} customers` : `Best ${scoreText('speed', speedBest)}`;
  const grid = $('days');
  grid.replaceChildren();
  // Keep all story days and a bounded window of unlocked endless days.
  const count = Math.max(E.DAYS, save.day);
  const days = Array.from({ length: E.DAYS }, (_, index) => index + 1);
  for (let d = Math.max(E.DAYS + 1, count - 9); d <= count; d++) days.push(d);
  for (const day of days) {
    const unlocked = day <= save.day;
    const stars = save.best[day] ?? 0;
    const item = button('');
    item.disabled = !unlocked;
    item.classList.toggle('next', day === save.day);
    item.innerHTML = `<span>${day}</span><small>${unlocked ? starsText(stars) : 'Locked'}</small>`;
    item.setAttribute('aria-label', `Day ${day}, ${unlocked ? stars + ' of 3 stars' : 'locked'}`);
    item.addEventListener('click', () => prepare('day', day));
    grid.append(item);
  }
  if (focus) focusHeading($('homeTitle'));
}

const dishArt = (id, opts = {}) => Art.dish(E.DISHES[id].base, E.DISHES[id].has, { cooked: Boolean(E.DISHES[id].cook), ...opts });
const VERB = { toaster: 'Toast', grill: 'Grill', pot: 'Boil', wok: 'Fry', griddle: 'Cook' };

function recipeCard(id) {
  const recipe = E.DISHES[id];
  const steps = recipe.has.map(part => {
    const ing = E.INGREDIENTS[part];
    return ing.cooked ? `${ing.name} from the ${E.STATIONS[ing.cooked].name.toLowerCase()}` : ing.name;
  });
  if (recipe.cook) steps.push(`🔥 then into the ${E.STATIONS[recipe.cook].name.toLowerCase()}` + (E.STATIONS[recipe.cook].flip ? ' (flip it halfway!)' : ''));
  return `<article class="recipe"><span class="recipe-art">${dishArt(id)}</span>
    <div><strong>${recipe.name}</strong><span>${E.BASES[recipe.base].name} · ${steps.join(' · ')}</span></div></article>`;
}

function prepare(mode, day = save.day, challenge = null, previous = null) {
  closeDialog('results');
  stopShift();
  result = null;
  const competition = mode === 'daily' ? E.daily(challenge?.key) : mode === 'speed' ? E.speedRun() : null;
  const key = challenge?.key ?? previous?.key ?? competition?.key;
  const spec = challenge?.spec ?? previous?.spec ?? competition?.spec ?? {
    day, seed: `day-${day}`, mode: 'day', upgrades: { ...save.upgrades },
  };
  const title = mode === 'speed' ? 'Speed Run'
    : mode === 'daily' ? `Daily Rush #${E.daily(key).number}`
      : day > E.DAYS ? `Endless day ${day}` : `Day ${day}`;
  pending = { mode, spec, title, day, key, challenge };
  show('intro', title, key ?? '');
  $('introTitle').textContent = title;
  const briefing = $('introChallenge');
  briefing.hidden = !challenge;
  briefing.textContent = challenge ? `Friend’s target · ${scoreText(mode, challenge.value)}` : '';
  const fresh = mode === 'day' ? E.newOn(day) : [];
  $('introNew').hidden = !fresh.length;
  $('introNew').innerHTML = fresh.length ? `<h3>${day === 1 ? 'Your first order' : 'New on the menu'}</h3>${fresh.map(recipeCard).join('')}` : '';
  const orders = E.schedule(spec);
  $('introGoals').textContent = mode === 'speed'
    ? `${E.SPEED_CUSTOMERS} customers · 10 s penalty per missed customer`
    : E.goals(orders).map((goal, index) => `${'★'.repeat(index + 1)} ${money(goal)}`).join('   ·   ');
  $('introTip').textContent = mode === 'day'
    ? day === 1 ? 'Build a kopi from scratch and serve it to your first customer.'
      : `${orders.length} customers in this shift. Earn one star to unlock the next day.`
    : mode === 'daily' ? 'Two minutes, the full menu and a standard stall. Earn as much as you can.'
      : 'Clear the orders as quickly as you can. Everyone gets the same queue this week.';
  focusHeading($('introTitle'));
}

function buildSeats() {
  const seats = $('seats');
  seats.replaceChildren();
  seats.style.setProperty('--seats', shift.seats.length);
  seats.classList.toggle('many', shift.seats.length >= 5); // (a busy co-op stall: orders as pictures only)
  return shift.seats.map((_, index) => {
    const el = button('', 'seat empty');
    el.dataset.seat = index;
    el.innerHTML = '<span class="orders"></span><span class="portrait"></span><span class="patience" aria-hidden="true"><span></span></span>';
    el.addEventListener('click', () => serveSeat(index));
    seats.append(el);
    return {
      el, orders: el.querySelector('.orders'), portrait: el.querySelector('.portrait'),
      patience: el.querySelector('.patience span'),
    };
  });
}

function buildCounter() {
  const counter = $('counter');
  counter.replaceChildren();
  counter.style.setProperty('--spots', shift.prep.length);
  const views = shift.prep.map((_, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'prep';
    wrap.dataset.prep = index;
    const el = button('', 'prep-item');
    el.innerHTML = '<span class="prep-art"></span><span class="prep-name"></span>';
    el.addEventListener('click', () => selectPrep(index));
    bindDrag(el, () => shift.prep[index] && {
      kind: 'dish', value: index, html: Art.dish(shift.prep[index].base, shift.prep[index].has, { cooked: shift.prep[index].cooked }),
      canServe: Boolean(E.dishOf(shift.prep[index])),
    });
    const bin = button('×', 'prep-bin');
    bin.setAttribute('aria-label', `Bin dish in spot ${index + 1}`);
    bin.title = `Bin dish (costs ${money(E.WASTE_COST)})`;
    bin.addEventListener('click', () => action('bin-dish', index));
    wrap.append(el, bin);
    counter.append(wrap);
    return { wrap, el, bin, art: el.querySelector('.prep-art'), name: el.querySelector('.prep-name') };
  });
  return views;
}

function stockButton(kind, id, name) {
  const el = button('', 'stock ' + ({ cup: 'cupfam', plate: 'platefam', bowl: 'bowlfam', pastry: 'pastryfam', dough: 'doughfam' })[kind === 'base' ? id : E.INGREDIENTS[id].base]);
  const html = Art.icon(id);
  el.dataset.stock = id;
  el.innerHTML = `${html}<span>${ingredientLabels[id] ?? name}</span>`;
  el.setAttribute('aria-label', name);
  el.addEventListener('click', () => useStock(kind, id));
  bindDrag(el, () => ({ kind, value: id, html }));
  return el;
}

function buildStations() {
  return shift.kitchen.stations.map(id => {
    const station = E.STATIONS[id];
    const el = button('', 'station');
    el.dataset.station = id;
    el.innerHTML = `<span class="station-picture"></span><span class="station-name">${station.name}</span><span class="station-track"></span><span class="station-info"></span>`;
    // one tap does the obvious thing: add what's ready, else start cooking, else bin what burnt
    el.addEventListener('click', () => stationTap(id));
    // (ingredient stations: drag what's ready onto a dish; the wok and griddle plate up with a tap)
    bindDrag(el, () => !station.dishes && shift.stations[id].slots.some(slot => slot?.state === 'ready') && {
      kind: 'add',
      value: station.makes,
      html: Art.dish(E.INGREDIENTS[station.makes].base, [station.makes]),
    });
    const track = el.querySelector('.station-track');
    const meters = shift.stations[id].slots.map(() => {
      const node = document.createElement('span');
      node.innerHTML = '<i></i>';
      track.append(node);
      return { node, fill: node.firstElementChild };
    });
    return { id, el, meters, info: el.querySelector('.station-info'), art: el.querySelector('.station-picture') };
  });
}

function stationTap(id) {
  if (!playing()) return false;
  if (E.STATIONS[id].dishes) return dishStationTap(id);
  const slots = shift.stations[id].slots;
  const make = E.STATIONS[id].makes;
  const base = E.INGREDIENTS[make].base;
  const ready = slots.some(slot => slot?.state === 'ready');
  if (ready) {
    const item = shift.prep[run.selected];
    const fits = item && item.base === base && !item.has.includes(make) &&
      E.couldBe({ base, has: [...item.has, make] }).length > 0;
    const spot = fits ? run.selected : E.autoSpot(shift, make);
    if (spot >= 0) return action('add', make, spot);
  }
  if (slots.includes(null)) return action('cook', id);
  if (slots.some(slot => slot?.state === 'burnt')) return action('bin-burnt', id);
  F.sfx.nope();
  transient(ready ? `Put a ${E.BASES[base].name.toLowerCase()} on the counter first.` : `The ${E.STATIONS[id].name.toLowerCase()} is full. Wait for it.`);
  return false;
}

// The kitchen, one row per dish (like the stations of a real stall): its cup, plate or bowl first, then what goes in.
const LINES = [
  { label: '☕ Drinks', family: 'cupfam', base: 'cup', dishes: ['kopi', 'kopiO', 'teh', 'kopiPeng', 'tehPeng'] },
  { label: '🍞 Kaya toast', family: 'platefam', base: 'plate', dishes: ['toast'] },
  { label: '🍗 Chicken rice', family: 'platefam', base: 'plate', dishes: ['rice', 'riceChilli'] },
  { label: '🥚 Eggs', family: 'bowlfam', base: 'bowl', dishes: ['eggs'] },
  { label: '🍢 Satay', family: 'platefam', base: 'plate', dishes: ['satay'] },
  { label: '🥟 Curry puff', family: 'pastryfam', base: 'pastry', dishes: ['curryPuff'] },
  { label: '🫓 Prata', family: 'doughfam', base: 'dough', dishes: ['prata', 'rotiTelur'] },
];

function buildKitchen() {
  const lines = $('lines');
  lines.replaceChildren();
  run.stations = buildStations();
  // the stove line: every fire and pot of the day, big, where you can see the food cooking
  const stove = $('stove');
  stove.replaceChildren();
  for (const id of ['toaster', 'grill', 'pot', 'wok', 'griddle']) {
    const view = run.stations.find(v => v.id === id);
    if (view) stove.append(view.el);
  }
  stove.hidden = !run.stations.length;
  stove.style.setProperty('--n', run.stations.length);
  const menu = E.menuFor(run.spec.mode === 'speed' ? E.DAYS : run.spec.day ?? 1);
  run.menu = menu;
  let shown = 0;
  for (const line of LINES) {
    const dishes = line.dishes.filter(d => menu.includes(d));
    if (!dishes.length) continue;
    const parts = [];
    for (const d of dishes) for (const ing of E.DISHES[d].has) if (!parts.includes(ing)) parts.push(ing);
    const row = document.createElement('div');
    const raw = parts.filter(i => !E.INGREDIENTS[i].cooked).length;
    row.style.setProperty('--n', raw + 1);
    row.className = 'line ' + line.family + (raw + 1 >= 4 ? ' wide' : '');
    row.innerHTML = `<span class="line-label" title="${line.label.slice(2).trim()}">${line.label.split(' ')[0]}</span>`;
    row.setAttribute('aria-label', line.label.slice(2).trim());
    const items = document.createElement('div');
    items.className = 'line-items';
    items.append(stockButton('base', line.base, E.BASES[line.base].name));
    for (const ing of parts) if (!E.INGREDIENTS[ing].cooked) items.append(stockButton('add', ing, E.INGREDIENTS[ing].name));
    row.append(items);
    lines.append(row);
    shown++;
  }
  lines.classList.toggle('roomy', shown <= 2);
}

/** What the dishes on the counter need next: those buttons glow. */
function renderNext() {
  const wanted = E.wanted(shift).map(w => w.dish);
  const next = new Set();
  for (const item of shift.prep) {
    if (!item || (E.dishOf(item) && wanted.includes(E.dishOf(item)))) continue;
    const toCook = E.readyToCook(item);
    if (toCook) {
      next.add(E.DISHES[toCook].cook);
      continue;
    }
    const target = E.couldBe(item).find(d => wanted.includes(d));
    if (!target) continue;
    for (const ing of E.DISHES[target].has) if (!item.has.includes(ing)) next.add(E.INGREDIENTS[ing].cooked ?? ing);
  }
  for (const el of $('lines').querySelectorAll('[data-stock], [data-station]')) {
    el.classList.toggle('next', next.has(el.dataset.stock ?? el.dataset.station));
  }
}

function buildGoals() {
  const marks = $('goalMarks');
  marks.replaceChildren();
  $('goalbar').hidden = run.mode === 'speed';
  $('servedCount').hidden = run.mode !== 'speed';
  if (run.mode === 'speed') return;
  const top = Math.max(1, shift.goal[2]) * 1.07;
  for (const [index, value] of shift.goal.entries()) {
    const mark = document.createElement('span');
    mark.className = 'goal-mark';
    mark.style.left = 100 * value / top + '%';
    mark.textContent = '★';
    mark.title = `${index + 1} star${index === 0 ? '' : 's'} at ${money(value)}`;
    marks.append(mark);
  }
}

function startShift() {
  if (!pending || (page !== 'intro' && !pending.coop)) return;
  const config = pending;
  pending = null;
  F.unlock();
  shift = E.createShift(config.spec);
  run = {
    ...config, actions: [], frame: 0, last: null, acc: 0, selected: -1,
    guided: config.mode === 'day' && config.day === 1 && !save.guided && !config.coop, rushShown: false,
    ticket: config.mode !== 'day' && config.key === activeKey(config.mode)
      ? startRankedRun(config.mode, config.key) : Promise.resolve(null),
  };
  hintOverride = null;
  $('awning').innerHTML = stall(save.decor);
  $('backdrop').innerHTML = Art.backdrop();
  $('cat').html = null;
  $('fx').replaceChildren();
  show('shift', run.title, run.key ?? '');
  run.seats = buildSeats();
  $('team').hidden = !run.coop;
  if (run.coop) renderTeam();
  run.prep = buildCounter();
  buildKitchen();
  buildGoals();
  F.musicStop();
  F.sfx.start();
  render();
  run.frame = requestAnimationFrame(tick);
  $('pause').focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------------------------------- 👫 co-op
let stopListening = null;
let coopDay = null; // (the day the host picked, as a friend sees it)
const AVATARS = ['auntie', 'office', 'student', 'tourist'];
const nameOf = seat => Co.current()?.players?.find(p => p.seat === seat)?.name ?? `Cook ${seat + 1}`;

function coopPage(code = '') {
  closeDialog('results');
  closeDialog('paused');
  stopShift();
  result = null;
  pending = null;
  $('team').hidden = true;
  show('coop', 'Play with friends');
  if (!$('coopName').value) $('coopName').value = save.nickname;
  if (code) $('coopCode').value = code;
  coopNote('');
  renderRoom();
}

function coopNote(text, bad = false) {
  setText($('coopNote'), text);
  $('coopNote').classList.toggle('bad', bad);
}

function renderRoom() {
  const room = Co.current();
  $('coopStart').hidden = Boolean(room);
  $('coopRoom').hidden = !room;
  if (!room) return;
  const host = room.seat === 0;
  setText($('coopCodeShow'), room.code);
  const list = $('coopPlayers');
  list.replaceChildren();
  for (const p of room.players ?? []) {
    const li = document.createElement('li');
    li.style.setProperty('--c', Co.COLOURS[p.seat]);
    li.innerHTML = Art.person(AVATARS[p.seat], 'happy');
    const label = document.createElement('span');
    label.textContent = p.name + (p.seat === 0 ? ' · host' : '') + (p.seat === room.seat ? ' (you)' : '');
    li.append(label);
    list.append(li);
  }
  $('coopHost').hidden = !host;
  if (host && !$('coopDay').options.length) {
    for (let d = 1; d <= Math.min(Math.max(1, save.day), E.DAYS); d++) {
      const option = document.createElement('option');
      option.value = d;
      option.textContent = `Day ${d}` + (E.newOn(d).length ? ` · ${E.newOn(d).map(id => E.DISHES[id].name).join(', ')}` : '');
      $('coopDay').append(option);
    }
    $('coopDay').value = String(Math.min(Math.max(1, save.day), E.DAYS));
  }
  const n = room.players?.length ?? 1;
  setText($('coopWait'), host
    ? (n < 2 ? 'Waiting for friends to join… (send them the code)' : `${n} cooks ready. Start when everyone is here!`)
    : `Waiting for ${nameOf(0)} to start the shift…` + (coopDay ? ` (Day ${coopDay})` : ''));
}

async function coopOpen(code) {
  const name = $('coopName').value.trim();
  if (code !== null && !/^[A-Za-z0-9]{5}$/.test(String(code).trim())) {
    coopNote('Type the 5-letter stall code your friend sent you.', true);
    return;
  }
  coopNote(code === null ? 'Opening your stall…' : 'Joining…');
  try {
    const room = code === null ? await Co.create(name) : await Co.join(code, name);
    save.nickname = room.players.find(p => p.seat === room.seat)?.name ?? save.nickname;
    persist();
    stopListening?.();
    stopListening = Co.listen({ messages: coopMessages, info: coopInfo, closed: coopClosed });
    coopNote('');
    $('coopDay').replaceChildren();
    renderRoom();
    if (room.seat === 0) Co.send({ t: 'day', day: Number($('coopDay').value) });
  } catch (error) {
    coopNote(error.message, true);
  }
}

async function coopShare() {
  const room = Co.current();
  if (!room) return;
  const url = new URL(location.href);
  url.search = new URLSearchParams({ room: room.code }).toString();
  url.hash = '';
  const text = `Come help at my hawker stall in Hawker Rush! Stall code ${room.code}\n${url.href}`;
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      coopNote('Copied! Send it to your friends.');
    }
  } catch {
    // (share sheet closed)
  }
}

function coopGo() {
  const room = Co.current();
  if (!room || room.seat !== 0) return;
  const upgrades = {};
  for (const [id, level] of Object.entries(save.upgrades)) if (level) upgrades[id] = level;
  const spec = {
    day: Number($('coopDay').value) || 1, seed: 'coop-' + Math.random().toString(36).slice(2, 10),
    mode: 'day', upgrades, players: Math.max(1, Math.min(E.MAX_PLAYERS, room.players.length)),
  };
  Co.send({ t: 'start', spec });
  startCoopShift(spec);
}

function startCoopShift(spec) {
  const room = Co.current();
  if (!room) return;
  closeDialog('results');
  closeDialog('paused');
  stopShift();
  result = null;
  pending = {
    mode: 'day', spec, title: `Day ${spec.day} 👫`, day: spec.day, key: null, challenge: null,
    coop: { role: room.seat === 0 ? 'host' : 'guest', seat: room.seat, out: [], incoming: [], remote: [],
      upTo: 0, sentAt: 0, sentTicks: -1, heard: performance.now() },
  };
  startShift();
}

function coopMessages(list) {
  const room = Co.current();
  if (!room) return;
  for (const m of list) {
    if (m.t === 'emote') showEmote(m.from, m.e);
    else if (room.seat === 0) {
      if (m.t === 'act') remoteAct(m);
    } else if (m.t === 'day') {
      coopDay = m.day;
      if (page === 'coop') renderRoom();
    } else if (m.t === 'start') startCoopShift(m.spec);
    else if (m.t === 'frames' && run?.coop) {
      run.coop.incoming.push(...m.actions);
      run.coop.upTo = Math.max(run.coop.upTo, m.upTo);
      run.coop.heard = performance.now();
    }
  }
}

function coopInfo() {
  if (page === 'coop') renderRoom();
  if (run?.coop) renderTeam();
}

function coopClosed(reason) {
  if (page === 'shift' && shift?.phase === 'running') {
    coopPage();
    coopNote(reason || 'The stall has closed.', true);
  } else if (page === 'coop') {
    renderRoom();
    coopNote(reason || 'The stall has closed.', true);
  }
}

/** The host plays a friend's tap (and sends it on with the next frame). */
const OPERANDS = { base: E.BASES, add: E.INGREDIENTS, cook: E.STATIONS, 'bin-burnt': E.STATIONS };
function remoteAct(m) {
  if (!run?.coop || run.coop.role !== 'host' || shift.phase !== 'running') return;
  // (only real kitchen things: a name like "constructor" must not reach the rules)
  if (OPERANDS[m.kind] ? !Object.hasOwn(OPERANDS[m.kind], m.a) : !Number.isInteger(m.a)) return;
  if (!playing()) {
    run.coop.remote.push(m);
    return;
  }
  const mark = shift.events.length;
  if (E.act(shift, m.kind, m.a, m.b)) {
    run.actions.push([shift.ticks, m.kind, m.a, m.b]);
    run.coop.out.push([shift.ticks, m.kind, m.a, m.b, m.from]);
    tagMoves(m.from, mark);
    hostFrame(performance.now(), true); // (back to everyone at once: the friend sees their own move sooner)
  } else shift.events.length = mark; // (a friend's slip: no buzz on this phone)
  render();
  handleEvents();
}

function hostFrame(now, force = false) {
  const c = run.coop;
  if (!force && now - c.sentAt < 150) return;
  if (!force && !c.out.length && c.sentTicks === shift.ticks) return;
  c.sentAt = now;
  c.sentTicks = shift.ticks;
  Co.send({ t: 'frames', upTo: shift.ticks, actions: c.out.splice(0) });
}

/** A friend's phone: replay the host's shift, never ahead of it (and catch up quickly when behind). */
function guestTick(now) {
  const c = run.coop;
  const dt = run.last === null ? 0 : Math.min(.25, (now - run.last) / 1000);
  run.last = now;
  const behind = c.upTo - shift.ticks;
  const quiet = behind > 60; // (far behind: jump to the present without every sound on the way)
  // (catch up briskly, especially when a move is waiting to be shown)
  const keen = c.incoming.length ? 3 : 6;
  const budget = quiet ? behind : Math.ceil(dt * 30 * (1 + Math.max(0, behind - keen) / 8));
  const target = Math.min(c.upTo, shift.ticks + budget);
  const before = shift.ticks;
  while (shift.ticks < target && shift.phase === 'running') {
    while (c.incoming.length && c.incoming[0][0] <= shift.ticks) {
      const [, kind, a, b, who] = c.incoming.shift();
      const mark = shift.events.length;
      if (E.act(shift, kind, a, b) && !quiet) tagMoves(who, mark);
    }
    E.step(shift);
  }
  if (quiet) shift.events.length = 0;
  if (before !== shift.ticks) {
    render();
    handleEvents();
  }
  const waiting = performance.now() - c.heard > 1500;
  if (waiting !== c.waiting) {
    c.waiting = waiting;
    hintOverride = waiting ? { text: '📶 Waiting for the host’s phone…', until: Infinity } : null;
    renderHint();
  }
  if (shift.phase === 'over') {
    finish();
    return;
  }
  run.frame = requestAnimationFrame(tick);
}

/** Show who did what: a little name tag in their colour where a friend's move landed. */
function tagMoves(who, mark) {
  if (who === run.coop?.seat) return;
  for (const e of shift.events.slice(mark)) {
    const anchor = e.spot >= 0 && run.prep[e.spot] ? run.prep[e.spot].wrap
      : e.seat >= 0 && run.seats[e.seat] ? run.seats[e.seat].el
        : e.station ? run.stations.find(view => view.id === e.station)?.el : null;
    if (anchor) {
      float(nameOf(who), anchor, `team team-${who}`);
      return;
    }
  }
}

function renderTeam() {
  const room = Co.current();
  const names = $('teamNames');
  names.replaceChildren();
  const players = room?.players ?? [];
  for (const p of players) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (p.seat === room.seat ? ' me' : '');
    chip.style.setProperty('--c', Co.COLOURS[p.seat]);
    chip.textContent = players.length > 2 ? p.name.slice(0, 4) : p.name;
    chip.title = p.name + (p.seat === room.seat ? ' (you)' : '');
    names.append(chip);
  }
}

let sayTimer = 0;
function showEmote(seat, e) {
  const text = Co.EMOTES[e];
  if (!text) return;
  const say = $('teamSay');
  say.textContent = `${nameOf(seat)}: ${text}`;
  say.style.setProperty('--c', Co.COLOURS[seat] ?? '#fff');
  say.classList.remove('show');
  void say.offsetWidth;
  say.classList.add('show');
  if (seat !== Co.current()?.seat) F.sfx.arrive();
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => say.classList.remove('show'), 2600);
}

function finishCoop() {
  clearDrag();
  F.musicStop();
  if (run.coop.role === 'host') {
    hostFrame(performance.now(), true);
    Co.send({ t: 'over' });
  }
  const stars = E.starsFor(shift.coins, shift.goal);
  save.wallet = (cents(save.wallet) + cents(shift.coins)) / 100; // (everyone in the team earns the shift's takings)
  save.totals.served += shift.served;
  save.totals.shifts++;
  persist();
  result = { coop: true, mode: 'day', title: run.title, day: run.day };
  F.sfx.stars(stars);
  $('resTitle').textContent = stars ? 'Great teamwork!' : 'Shift over';
  $('resStars').hidden = false;
  $('resStars').textContent = starsText(stars);
  $('resStars').setAttribute('aria-label', `${stars} out of 3 stars`);
  $('resMoney').textContent = money(shift.coins) + ' earned together';
  $('resRecord').hidden = true;
  const rows = [['Cooks', (Co.current()?.players ?? []).map(p => p.name).join(', ') || '—'], ['Customers served', shift.served],
    ['Left or walked past', shift.lost + shift.passed], ['Tips and combos', money(shift.tips)]];
  if (shift.early) rows.push(['Closed early', `${shift.early} s early · +${money(shift.earlyBonus)}`]);
  if (shift.bestCombo > 1) rows.push(['Best combo', shift.bestCombo]);
  rows.push(['Your wallet', money(save.wallet)]);
  const list = $('resList');
  list.replaceChildren();
  for (const [label, value] of rows) {
    const li = document.createElement('li');
    const a = document.createElement('span');
    a.textContent = label;
    const b = document.createElement('b');
    b.textContent = value;
    li.append(a, b);
    list.append(li);
  }
  for (const id of ['resNext', 'resChallenge', 'resShop', 'saveScore', 'shareLink', 'rankNotice']) $(id).hidden = true;
  $('resRetry').textContent = 'Back to the stall';
  setText($('saveNote'), '');
  setText($('shareNote'), '');
  openDialog('results');
}

const upright = () => matchMedia('(orientation: portrait)').matches && !document.body.classList.contains('upright');

/** On phones: go full screen and sideways when a shift starts (where the browser allows it; iPhones don't). */
async function goSideways() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {
    // (not allowed here: the "turn your phone" card asks instead)
  }
  showFullscreen();
}

function playing() {
  if (run?.coop?.role === 'guest') return Boolean(shift?.phase === 'running' && !document.hidden); // (the host keeps time)
  return run && shift?.phase === 'running' && !upright() && !$('paused').open && !$('recipes').open && !document.hidden;
}

function tutorialWaiting() {
  return run.guided && shift.next > 0 && shift.served === 0;
}

function tick(now) {
  if (!run || shift.phase !== 'running') return;
  if (run.coop?.role === 'guest') {
    guestTick(now);
    return;
  }
  if (playing() && run.coop?.remote.length) for (const m of run.coop.remote.splice(0)) remoteAct(m);
  if (playing()) {
    const ticks = shift.ticks;
    F.musicStart(false);
    if (run.last !== null) run.acc += Math.min(0.25, (now - run.last) / 1000);
    run.last = now;
    while (run.acc >= E.TICK && shift.phase === 'running' && !tutorialWaiting()) {
      E.step(shift);
      run.acc -= E.TICK;
    }
    if (tutorialWaiting()) run.acc = 0;
    if (run.coop) hostFrame(now);
    if (ticks !== shift.ticks) {
      render();
      handleEvents();
    }
    if (shift.phase === 'over') {
      finish();
      return;
    }
  } else {
    run.last = null;
    run.acc = 0;
  }
  run.frame = requestAnimationFrame(tick);
}

function action(kind, a, b = -1) {
  if (!playing()) return false;
  if (run.coop?.role === 'guest') {
    // a friend's tap goes to the host's phone, which plays it; it shows here a moment later
    Co.send({ t: 'act', kind, a, b });
    if ((kind === 'bin-dish' || kind === 'serve') && a === run.selected) run.selected = -1;
    render();
    return true;
  }
  const ok = E.act(shift, kind, a, b);
  if (ok) {
    run.actions.push([shift.ticks, kind, a, b]);
    run.coop?.out.push([shift.ticks, kind, a, b, 0]);
    hintOverride = null;
    if (run.guided && shift.served > 0) {
      run.guided = false;
      run.acc = 0;
      run.last = null;
      save.guided = true;
      persist();
      hintOverride = { text: 'First order served! Keep an eye on the next customers.', until: shift.t + 4 };
    }
    if ((kind === 'bin-dish' || kind === 'serve') && a === run.selected) run.selected = -1;
  }
  render();
  handleEvents();
  renderHint();
  return ok;
}

function useStock(kind, id) {
  const selected = run.selected;
  const canPlace = selected >= 0 && !shift.prep[selected];
  const canAdd = selected >= 0 && shift.prep[selected];
  if (kind === 'base') action('base', id, canPlace ? selected : -1);
  else action('add', id, canAdd ? selected : -1);
}

function selectPrep(index) {
  if (!playing()) return;
  if (E.readyToCook(shift.prep[index])) {
    action('cook-dish', index);
    return;
  }
  const dish = E.dishOf(shift.prep[index]);
  if (dish && (run.selected === index || E.servingFor(shift, dish) >= 0)) {
    action('serve', index);
    return;
  }
  run.selected = run.selected === index ? -1 : index;
  hintOverride = null;
  render();
}

function serveSeat(index) {
  if (!playing()) return;
  const customer = shift.seats[index];
  if (!customer || customer.leaving) return;
  if (run.selected >= 0) {
    action('serve', run.selected, index);
    return;
  }
  const match = shift.prep.findIndex(item => {
    const dish = E.dishOf(item);
    return dish && E.servingFor(shift, dish, index) === index;
  });
  if (match !== -1) action('serve', match, index);
  else transient('Build a dish from this order first.');
}

function renderSeats() {
  run.seats.forEach(({ el, orders, portrait, patience }, index) => {
    const customer = shift.seats[index];
    const waiting = Boolean(customer && !customer.leaving);
    el.disabled = !waiting;
    el.classList.toggle('empty', !customer);
    el.classList.toggle('happy', customer?.leaving === 'happy');
    el.classList.toggle('angry', customer?.leaving === 'angry');
    if (el.dataset.cid !== String(customer?.id ?? '')) {
      el.dataset.cid = String(customer?.id ?? '');
      el.classList.remove('arrive');
      if (customer) {
        void el.offsetWidth;
        el.classList.add('arrive');
      }
    }
    if (!customer) {
      el.setAttribute('aria-label', `Seat ${index + 1} empty`);
      setContent(orders, '');
      setContent(portrait, '<span class="stool"></span>');
      patience.style.width = '0%';
      return;
    }
    const remaining = customer.left / customer.patience;
    const mood = customer.leaving === 'happy' ? 'eating' : customer.leaving || (remaining < .35 ? 'cross' : 'ok');
    const wanted = customer.order.filter((_, i) => !customer.got[i]).map(id => E.DISHES[id].name);
    const was = `${people[customer.who]} · seat ${index + 1}`;
    el.setAttribute('aria-label', `${was}: ${waiting ? wanted.join(', ') : customer.leaving === 'happy' ? 'served' : 'leaving'}`);
    setContent(orders, customer.order.map((id, i) => {
      const dish = E.DISHES[id];
      return `<span class="order${customer.got[i] ? ' done' : ''}">${dishArt(id)}<span>${dish.name}</span></span>`;
    }).join(''));
    setContent(portrait, Art.person(customer.who, mood));
    const mark = run.selected >= 0 ? E.dishOf(shift.prep[run.selected]) : null;
    el.classList.toggle('eligible', Boolean(waiting && mark && E.servingFor(shift, mark, index) === index));
    patience.style.width = `${Math.max(0, remaining) * 100}%`;
    patience.dataset.state = remaining < .22 ? 'urgent' : remaining < .45 ? 'low' : '';
  });
}

function renderPrep() {
  run.prep.forEach(({ wrap, el, art, name, bin }, index) => {
    const item = shift.prep[index];
    const found = E.dishOf(item);
    const dish = found && run.menu?.includes(found) ? found : null; // (only today's dishes count as finished)
    const ready = Boolean(dish && E.servingFor(shift, dish) >= 0);
    const label = dish ? E.DISHES[dish].name : item ? E.BASES[item.base].name : 'Empty';
    const ingredients = item?.has.map(ing => E.INGREDIENTS[ing].name) ?? [];
    wrap.classList.toggle('occupied', Boolean(item));
    wrap.classList.toggle('selected', index === run.selected);
    wrap.classList.toggle('ready', ready);
    el.setAttribute('aria-pressed', String(index === run.selected));
    el.setAttribute('aria-label', `Prep spot ${index + 1}: ${label}${ingredients.length ? ', ' + ingredients.join(', ') : ''}${ready ? ', ready to serve' : ''}`);
    const toCook = E.readyToCook(item);
    wrap.classList.toggle('to-cook', Boolean(toCook));
    setContent(art, item ? Art.dish(item.base, item.has, { face: Boolean(dish), cooked: item.cooked }) +
      (toCook ? `<span class="cook-badge">🔥 ${VERB[E.DISHES[toCook].cook]}</span>` : '') : '<span class="prep-dash">+</span>');
    setText(name, ready ? `${label} ✓` : label);
    bin.hidden = !item;
  });
}

/** The wok and the griddle: flip what needs flipping, plate what's ready, else cook the dish you built. */
function dishStationTap(id) {
  const slots = shift.stations[id].slots;
  if (slots.some(slot => slot?.state === 'flip')) return action('flip', id);
  if (slots.some(slot => slot?.state === 'ready')) {
    const spot = run.selected >= 0 && !shift.prep[run.selected] ? run.selected : -1;
    return action('take', id, spot);
  }
  const mine = index => { const d = E.readyToCook(shift.prep[index]); return d && E.DISHES[d].cook === id; };
  const spot = mine(run.selected) ? run.selected : shift.prep.findIndex((_, index) => mine(index));
  if (spot >= 0 && slots.includes(null)) return action('cook-dish', spot);
  if (slots.some(slot => slot?.state === 'burnt')) return action('bin-burnt', id);
  F.sfx.nope();
  const names = E.menuFor(run.spec.mode === 'speed' ? E.DAYS : run.spec.day ?? 1).filter(d => E.DISHES[d].cook === id).map(d => E.DISHES[d]);
  transient(slots.includes(null) && names.length
    ? `Build it first: ${names.map(d => [E.BASES[d.base].name, ...d.has.map(i => E.INGREDIENTS[i].name)].join(' + ')).join(' / ')}`
    : `The ${E.STATIONS[id].name.toLowerCase()} is full. Wait for it.`);
  return false;
}

function renderStations() {
  for (const view of run.stations) {
    const { id, el, art, meters, info } = view;
    const slots = shift.stations[id].slots;
    const count = { cooking: 0, ready: 0, burnt: 0, empty: 0, flip: 0 };
    const shapes = slots.map((slot, index) => {
      const state = slot?.state ?? 'empty';
      count[state]++;
      const p = slot ? E.progress(shift, id, slot) : 0;
      meters[index].node.dataset.state = state;
      meters[index].fill.style.width = `${p * 100}%`;
      return slot ? { state, p: Math.round(p * 8) / 8, ...(slot.item ? { has: slot.item.has } : {}) } : null;
    });
    const key = JSON.stringify(shapes);
    if (key !== view.key) {
      view.key = key;
      art.innerHTML = Art.station(id, shapes);
    }
    el.classList.toggle('has-burnt', count.burnt > 0);
    el.classList.toggle('has-ready', count.ready > 0);
    el.classList.toggle('danger', shapes.some(s => (s?.state === 'ready' || s?.state === 'flip') && s.p > .55));
    el.classList.toggle('needs-flip', count.flip > 0);
    const verb = VERB[id] ?? 'Cook';
    const dishes = E.STATIONS[id].dishes;
    const [short, text] = count.flip ? ['Flip!', 'flip it now: tap'] : count.ready ? ['Ready!', dishes ? 'ready, tap to plate it' : 'ready, tap to add it']
      : count.empty ? [verb, `tap to ${verb.toLowerCase()}`] : count.burnt ? ['Burnt!', 'burnt, tap to bin it'] : ['Cooking…', 'cooking'];
    setText(info, short);
    el.setAttribute('aria-label', `${E.STATIONS[id].name}: ${text}`);
  }
}

function clearGuide() {
  for (const el of $('shift').querySelectorAll('.guide')) el.classList.remove('guide');
}

function tutorialHint() {
  if (!shift.next) return 'Your first customer is on the way.';
  const complete = shift.prep.findIndex(item => E.dishOf(item) === 'kopi');
  if (complete >= 0) {
    run.prep[complete].wrap.classList.add('guide');
    run.seats[0].el.classList.add('guide');
    return 'Kopi done! Tap it to serve (or drag it to the customer).';
  }
  const cup = shift.prep.findIndex(item => item?.base === 'cup');
  if (cup < 0) {
    $('kitchen').querySelector('[data-stock="cup"]').classList.add('guide');
    return 'Start with a cup. Tap Cup or drag it to an empty prep spot.';
  }
  const id = shift.prep[cup].has.includes('kopi') ? 'milk' : 'kopi';
  $('kitchen').querySelector(`[data-stock="${id}"]`).classList.add('guide');
  return `Add ${E.INGREDIENTS[id].name.toLowerCase()}. Tap it or drag it onto the cup.`;
}

/** Mochi the stall cat: cheers when you do well, worries when someone storms off, naps when it's quiet. */
function catMood() {
  if (shift.t < (run.cheerUntil ?? 0)) return 'cheer';
  if (shift.t < (run.worryUntil ?? 0)) return 'worried';
  if (!shift.seats.some(c => c && !c.leaving)) return 'sleep';
  return 'idle';
}

function renderHint() {
  clearGuide();
  const guided = run.guided ? tutorialHint() : null;
  const item = shift.prep[run.selected];
  const found = E.dishOf(item);
  const dish = found && run.menu?.includes(found) ? found : null;
  let message = 'Tap a cup, plate or bowl, then its ingredients. Tap a finished dish to serve it.';
  if (run.selected >= 0) {
    if (dish) message = `Tap a customer to serve ${E.DISHES[dish].name}, or tap the dish again.`;
    else message = item ? 'Add an ingredient to the selected dish.' : 'Choose a cup, plate or bowl for this spot.';
  }
  const flipping = Object.keys(shift.stations).find(id => shift.stations[id].slots.some(slot => slot?.state === 'flip'));
  const toCook = shift.prep.map(x => E.readyToCook(x)).find(Boolean);
  if (flipping) message = `Flip it! Tap the ${E.STATIONS[flipping].name.toLowerCase()} before it burns.`;
  else if (toCook) message = `${E.DISHES[toCook].name} built! Tap it to ${VERB[E.DISHES[toCook].cook].toLowerCase()} it 🔥`;
  else if (run.mode !== 'speed' && shift.next >= shift.arrivals.length) {
    message = 'Last customers! Serve them all to close early for a bonus.';
  }
  setText($('hint'), hintOverride && shift.t < hintOverride.until ? hintOverride.text : guided ?? message);
}

function render() {
  setText($('money'), money(shift.coins));
  const time = run.mode === 'speed' ? shift.t : Math.max(0, Math.ceil(E.SHIFT - shift.t));
  setText($('clock'), duration(time));
  $('clock').classList.toggle('late', run.mode !== 'speed' && time <= 10);
  $('clock').setAttribute('aria-label', `${run.mode === 'speed' ? 'Elapsed' : 'Time left'} ${duration(time)}`);
  if (run.mode === 'speed') {
    setText($('servedCount'), `${shift.served} / ${E.SPEED_CUSTOMERS} served`);
  } else {
    $('goalFill').style.width = `${Math.min(100, 100 * shift.coins / (Math.max(1, shift.goal[2]) * 1.07))}%`;
    for (const [index, mark] of [...$('goalMarks').children].entries()) mark.classList.toggle('got', shift.coins >= shift.goal[index]);
  }
  const queued = shift.queue.length;
  const queue = queued ? `${queued} waiting` : shift.next < shift.arrivals.length ? 'Customers are on the way' : 'Last orders';
  setText($('queue'), queue + (shift.combo > 1 ? ` · ${shift.combo}× combo` : ''));
  renderSeats();
  renderPrep();
  renderStations();
  renderNext();
  renderHint();
  setContent($('cat'), Art.cat(catMood()));
  const wave = E.WAVES[shift.wave]?.[2];
  $('shift').classList.toggle('rush', wave === 'lunch' || wave === 'dinner');
  F.musicRush(Math.max(shift.seats.filter(c => c && !c.leaving).length / shift.seats.length, run.mode !== 'speed' && time <= 10 ? 1 : 0));
}

function transient(text) {
  hintOverride = { text, until: shift.t + 3 };
  renderHint();
}

function float(text, anchor, tone = '') {
  if (!anchor || !run) return;
  const rect = anchor.getBoundingClientRect();
  const node = document.createElement('span');
  node.textContent = text;
  node.className = `pop ${tone}`;
  node.style.left = rect.left + rect.width / 2 + 'px';
  node.style.top = rect.top + rect.height / 3 + 'px';
  $('fx').append(node);
  window.setTimeout(() => node.remove(), 1000);
}

/** Coins fly from the customer to your money. */
function coins(from, n) {
  if (!from || !run) return;
  const a = from.getBoundingClientRect(), b = $('money').getBoundingClientRect();
  for (let k = 0; k < Math.min(8, n); k++) {
    const c = document.createElement('span');
    c.className = 'coin';
    c.style.left = a.left + a.width / 2 - 17 + (k % 3) * 8 + 'px';
    c.style.top = a.top + a.height / 3 - Math.floor(k / 3) * 6 + 'px';
    document.body.append(c);
    window.setTimeout(() => {
      c.style.left = b.left + b.width / 2 - 9 + 'px';
      c.style.top = b.top + b.height / 2 - 9 + 'px';
      c.style.opacity = '.3';
    }, 30 + k * 45);
    window.setTimeout(() => c.remove(), 750 + k * 45);
  }
}

/** Food flying across the kitchen (into the wok, out onto the counter). */
function fly(fromEl, toEl, html) {
  if (!fromEl || !toEl || !run) return;
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'flying';
  f.innerHTML = html;
  f.style.left = a.left + a.width / 2 - 26 + 'px';
  f.style.top = a.top + a.height / 2 - 26 + 'px';
  document.body.append(f);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    f.style.left = b.left + b.width / 2 - 26 + 'px';
    f.style.top = b.top + b.height / 2 - 30 + 'px';
    f.style.transform = 'scale(.8) rotate(-12deg)';
  }));
  window.setTimeout(() => f.remove(), 420);
}

/** A little burst of hearts or sparkles. */
function burst(anchor, char, n, kind) {
  if (!anchor || !run) return;
  const r = anchor.getBoundingClientRect();
  for (let k = 0; k < n; k++) {
    const p = document.createElement('span');
    p.className = 'particle ' + kind;
    p.textContent = char;
    const a = (Math.PI * 2 * k) / n + Math.random() * .7;
    p.style.left = r.left + r.width / 2 + 'px';
    p.style.top = r.top + r.height / 3 + 'px';
    p.style.setProperty('--dx', Math.cos(a) * (26 + Math.random() * 20) + 'px');
    p.style.setProperty('--dy', Math.sin(a) * (20 + Math.random() * 14) - 22 + 'px');
    document.body.append(p);
    window.setTimeout(() => p.remove(), 900);
  }
}

function banner(text, tone = '') {
  const b = document.createElement('div');
  b.className = 'banner ' + tone;
  b.textContent = text;
  document.body.append(b);
  window.setTimeout(() => b.remove(), 1300);
}

function handleEvents() {
  for (const event of shift.events.splice(0)) {
    const seat = run.seats[event.seat]?.el;
    const station = run.stations.find(view => view.id === event.station)?.el;
    const spot = run.prep[event.spot]?.wrap;
    switch (event.type) {
      case 'arrive':
        F.sfx.arrive();
        break;
      case 'wave': {
        const text = { lunch: 'Lunch rush!', breather: 'Phew… a breather', dinner: 'Dinner rush!', closing: 'Last orders!' }[event.wave];
        if (text) banner(text, event.wave === 'breather' ? '' : 'bad');
        if (event.wave === 'lunch' || event.wave === 'dinner') F.sfx.start();
        break;
      }
      case 'closed-early':
        F.sfx.ding();
        banner(`Closed early! +${money(event.amount)}`);
        run.cheerUntil = shift.t + 3;
        break;
      case 'base': F.sfx.base(); break;
      case 'add':
        F.sfx.add(E.INGREDIENTS[event.ingredient]?.base === 'cup' && event.ingredient !== 'ice');
        if (event.dish) {
          float(E.DISHES[event.dish].name + ' ✓', spot, 'good');
          burst(spot, '✦', 6, 'spark');
        }
        break;
      case 'cook': F.sfx.cook(); break;
      case 'cook-dish':
        F.sfx.cook();
        fly(run.prep[event.spot]?.wrap, station, dishArt(event.dish, { cooked: false }).replace(/<svg/, '<svg style="opacity:.95"'));
        break;
      case 'flip-me': F.sfx.ready(); float('Flip!', station, 'bad'); break;
      case 'flip': F.sfx.base(); float('Flipped!', station, 'good'); break;
      case 'take':
        F.sfx.base();
        fly(station, run.prep[event.spot]?.wrap, dishArt(event.dish));
        break;
      case 'ready': F.sfx.ready(); float('Ready!', station, 'good'); break;
      case 'serve': F.sfx.serve(); break;
      case 'paid':
        F.sfx.paid(event.combo);
        float('+' + money(event.amount), seat, 'good');
        coins(seat, Math.ceil(event.amount));
        burst(seat, '♥', 7, 'heart');
        if (event.combo >= 3 || event.perfect) run.cheerUntil = shift.t + 1.6;
        if (event.perfect) window.setTimeout(() => float('Perfect!', seat, 'good'), 300);
        if ([5, 10, 15, 20].includes(event.combo)) banner(`Combo ×${event.combo}!`);
        break;
      case 'angry':
        F.sfx.angry();
        float('Left!', seat, 'bad');
        run.worryUntil = shift.t + 2.2;
        $('shift').classList.remove('shake');
        void $('shift').offsetWidth;
        $('shift').classList.add('shake');
        break;
      case 'burnt': F.sfx.burnt(); float('Burnt!', station, 'bad'); run.worryUntil = shift.t + 1.5; break;
      case 'bin-burnt': F.sfx.trash(); float('Binned', station, 'bad'); break;
      case 'bin-dish': F.sfx.trash(); float('Binned', spot, 'bad'); break;
      case 'counter-full': F.sfx.nope(); transient('Pick an empty prep spot first.'); break;
      case 'station-full': F.sfx.nope(); transient('That station is full. Use or bin a finished batch.'); break;
      case 'wrong': F.sfx.nope(); transient('No matching spot. Check the base and ingredients.'); break;
      case 'not-ready': F.sfx.nope(); transient('This dish needs more ingredients.'); break;
      case 'not-wanted': F.sfx.nope(); transient('This dish does not match that order.'); break;
      case 'passed': float('Walked past', $('queue'), 'bad'); break;
      case 'over': F.sfx.bell(); break;
    }
  }
}

function bindDrag(source, getItem) {
  source.addEventListener('pointerdown', event => {
    suppressClick = null;
    if (!playing() || !event.isPrimary || event.button !== 0) return;
    const item = getItem();
    if (!item) return;
    drag = { ...item, source, pointer: event.pointerId, x: event.clientX, y: event.clientY };
    source.setPointerCapture(event.pointerId);
  });
}

function dropTarget(event) {
  const node = document.elementFromPoint(event.clientX, event.clientY);
  if (!node || !drag) return null;
  if (drag.kind === 'dish') {
    const station = node.closest('[data-station]');
    const toCook = E.readyToCook(shift.prep[drag.value]);
    if (station && toCook && E.DISHES[toCook].cook === station.dataset.station) return station;
    const seat = node.closest('[data-seat]');
    return seat && !seat.disabled && drag.canServe ? seat : null;
  }
  return node.closest('[data-prep]');
}

function clearDrag() {
  if (!drag) return;
  if (drag.source.hasPointerCapture(drag.pointer)) drag.source.releasePointerCapture(drag.pointer);
  drag.target?.classList.remove('drop-target');
  drag.ghost?.remove();
  drag = null;
}

window.addEventListener('pointermove', event => {
  if (event.pointerId !== drag?.pointer) return;
  if (!drag.ghost) {
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.setAttribute('aria-hidden', 'true');
    drag.ghost.innerHTML = drag.html;
    document.body.append(drag.ghost);
  }
  drag.ghost.style.left = event.clientX + 'px';
  drag.ghost.style.top = event.clientY + 'px';
  const target = dropTarget(event);
  if (target !== drag.target) {
    drag.target?.classList.remove('drop-target');
    target?.classList.add('drop-target');
    drag.target = target;
  }
});
window.addEventListener('pointerup', event => {
  if (event.pointerId !== drag?.pointer) return;
  if (drag.ghost) {
    suppressClick = drag.source;
    const target = dropTarget(event);
    if (target) {
      if (drag.kind === 'dish' && target.dataset.station) action('cook-dish', drag.value);
      else if (drag.kind === 'dish') action('serve', drag.value, Number(target.dataset.seat));
      else action(drag.kind, drag.value, Number(target.dataset.prep));
    }
  }
  clearDrag();
});
window.addEventListener('pointercancel', event => {
  if (event.pointerId === drag?.pointer) clearDrag();
});
document.addEventListener('pointerdown', () => { suppressClick = null; }, true);
document.addEventListener('click', event => {
  if (suppressClick && event.detail > 0 && suppressClick.contains(event.target)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = null;
  }
}, true);

function putRecord(mode, key, value) {
  const records = save.records[mode];
  const old = records[key];
  const improved = old === undefined || (mode === 'speed' ? value < old : value > old);
  if (!improved) return false;
  records[key] = value;
  const retained = Object.keys(records).sort().reverse().slice(0, 40);
  for (const period of Object.keys(records)) {
    if (!retained.includes(period)) delete records[period];
  }
  return true;
}

function finish() {
  if (run.coop) {
    finishCoop();
    return;
  }
  clearDrag();
  F.musicStop();
  const stars = E.starsFor(shift.coins, shift.goal);
  const time = E.speedTime(shift);
  const value = cents(run.mode === 'speed' ? time : shift.coins);
  const newBest = run.mode !== 'day' && shift.served > 0 && value > 0 && putRecord(run.mode, run.key, value);
  const summary = {
    coins: shift.coins, tips: shift.tips, served: shift.served, lost: shift.lost,
    passed: shift.passed, burnt: shift.burnt, wasted: shift.wasted, stars, time, ticks: shift.ticks,
  };
  result = {
    mode: run.mode, title: run.title, day: run.day, key: run.key, spec: run.spec, actions: run.actions,
    ticketPromise: run.ticket, challenge: run.challenge, value, newBest, summary,
  };
  save.totals.served += shift.served;
  save.totals.shifts++;
  if (run.mode === 'day') {
    save.wallet = (cents(save.wallet) + cents(shift.coins)) / 100;
    save.best[run.day] = Math.max(save.best[run.day] ?? 0, stars);
    if (stars && run.day === save.day && save.day < Number.MAX_SAFE_INTEGER - 1) save.day++;
  }
  persist();
  F.sfx.stars(run.mode === 'speed' ? (shift.served === E.SPEED_CUSTOMERS ? 3 : 0) : stars);
  renderResults();
  openDialog('results');
  updateTicket(result);
}

function renderResults() {
  const done = result;
  const { mode, summary, value, day } = done;
  const { stars, coins, tips, served, lost, passed, burnt, wasted } = summary;
  const story = mode === 'day';
  $('resTitle').textContent = story
    ? (day === E.DAYS && stars ? 'Story complete!' : stars ? `${done.title} complete` : `${done.title} results`)
    : done.title;
  $('resStars').hidden = mode === 'speed';
  $('resStars').textContent = starsText(stars);
  $('resStars').setAttribute('aria-label', `${stars} out of 3 stars`);
  $('resMoney').textContent = mode === 'speed' ? scoreText(mode, value) : money(coins) + ' earned';
  $('resRecord').textContent = done.newBest ? 'New personal best' : '';
  $('resRecord').hidden = !done.newBest;
  const rows = [['Customers served', served], ['Left or walked past', lost + passed]];
  if (mode === 'speed' && lost + passed) rows.push(['Time penalty', `+${10 * (lost + passed)} s`]);
  rows.push(['Tips and combos', money(tips)]);
  if (shift.early) rows.push(['Closed early', `${shift.early} s early · +${money(shift.earlyBonus)}`]);
  if (shift.bestCombo > 1) rows.push(['Best combo', shift.bestCombo]);
  if (burnt) rows.push(['Food burnt', burnt]);
  if (wasted) rows.push(['Dishes binned', wasted]);
  if (story) rows.push(['Wallet', money(save.wallet)]);
  if (mode !== 'speed' && stars < 3) rows.push(['Next star', money(shift.goal[stars])]);
  if (done.challenge) {
    const diff = value - done.challenge.value;
    const beat = mode === 'speed' ? diff < 0 : diff > 0;
    rows.push(['Friend’s target', scoreText(mode, done.challenge.value)]);
    rows.push(['Challenge', diff === 0 ? 'Tied' : beat ? 'Target beaten!' : 'Target still open']);
  }
  $('resList').innerHTML = rows.map(([label, amount]) => `<li><span>${label}</span><b>${amount}</b></li>`).join('');
  $('resNext').hidden = !story || day >= save.day;
  $('resNext').textContent = day + 1 > E.DAYS ? 'Play the next endless day' : `Play day ${day + 1}`;
  $('resChallenge').hidden = story;
  $('resShop').hidden = !story;
  $('resRetry').textContent = story ? 'Replay day' : 'Play again';
  $('saveScore').hidden = true;
  $('saveBtn').disabled = false;
  $('name').disabled = false;
  $('name').value = save.nickname;
  $('saveNote').textContent = '';
  $('shareNote').textContent = '';
  $('shareLink').hidden = true;
  $('rankNotice').textContent = '';
  $('rankNotice').hidden = true;
}

async function updateTicket(done) {
  if (done.mode === 'day') return;
  const notice = $('rankNotice');
  notice.hidden = false;
  if (!done.summary.served || !done.value) {
    notice.textContent = 'Serve at least one customer and finish with a positive score to rank.';
    return;
  }
  if (done.key !== activeKey(done.mode)) {
    notice.textContent = 'This shift’s leaderboard period has ended.';
    return;
  }
  notice.textContent = 'Checking leaderboard availability…';
  done.ranked = await done.ticketPromise;
  if (done !== result) return;
  if (!done.ranked) {
    notice.textContent = 'Leaderboard unavailable. Your personal best is saved on this device.';
    return;
  }
  notice.hidden = true;
  $('saveScore').hidden = false;
}

async function saveScore(event) {
  event.preventDefault();
  const done = result;
  if (!done?.ranked) return;
  const name = $('name').value.trim();
  if (!name) {
    $('saveNote').textContent = 'Enter a name to save this score.';
    $('name').focus();
    return;
  }
  const button = $('saveBtn');
  button.disabled = true;
  $('saveNote').textContent = 'Saving…';
  try {
    const response = await submitScore({
      ...done.ranked, name, actions: done.actions, value: done.value,
    });
    save.nickname = name;
    persist();
    if (done !== result) return;
    $('saveNote').textContent = response.saved ? 'Score saved to the leaderboard.' : 'This score did not qualify for the leaderboard.';
    $('name').disabled = true;
  } catch (error) {
    if (done !== result) return;
    $('saveNote').textContent = error.message || 'Could not save this score. Try again.';
    button.disabled = false;
  }
}

async function shareChallenge() {
  const done = result;
  if (!done || done.mode === 'day') return;
  const url = challengeUrl(done, location.href);
  const text = `Can you beat ${scoreText(done.mode, done.value)} in ${done.title}?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Hawker Rush', text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    if (done === result) $('shareNote').textContent = 'Challenge link copied.';
  } catch (error) {
    if (done !== result || error.name === 'AbortError') return;
    const field = $('shareLink');
    field.value = url;
    field.hidden = false;
    field.select();
    $('shareNote').textContent = 'Copy this link to share your challenge.';
  }
}

function buyItem(list, item, cost, owned, purchase, level) {
  const row = document.createElement('div');
  row.className = 'shop-item';
  const info = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = item.name;
  const description = document.createElement('small');
  description.textContent = item.what ?? 'Changes the look of your stall';
  info.append(title, description);
  if (level) {
    const lv = document.createElement('small');
    lv.textContent = level;
    info.append(lv);
  }
  const el = button(owned ?? money(cost), 'small-btn');
  el.disabled = owned !== null || save.wallet < cost;
  if (!owned) el.setAttribute('aria-label', `Buy ${item.name} for ${money(cost)}`);
  el.addEventListener('click', () => {
    if (el.disabled || save.wallet < cost) return;
    save.wallet = (cents(save.wallet) - cents(cost)) / 100;
    purchase();
    persist();
    F.sfx.buy();
    el.disabled = true;
    showShopItems();
    focusHeading($('shopTitle'));
  });
  row.append(info, el);
  list.append(row);
}

function showShopItems() {
  $('shopWallet').textContent = money(save.wallet);
  const list = $('shopList');
  list.replaceChildren();
  for (const [id, item] of Object.entries(E.UPGRADES)) {
    const level = save.upgrades[id] ?? 0;
    const cost = E.upgradeCost(id, level);
    buyItem(list, item, cost, cost === null ? 'Max level' : null,
      () => { save.upgrades[id] = level + 1; }, `Level ${level} of ${item.costs.length}`);
  }
  const decor = $('decorList');
  decor.replaceChildren();
  for (const [id, item] of Object.entries(E.DECOR)) {
    buyItem(decor, item, item.cost, save.decor[id] ? 'Owned' : null,
      () => { save.decor[id] = true; });
  }
}

function shop(from = 'home') {
  shopReturn = from;
  closeDialog('results');
  show('shop', 'Shop');
  showShopItems();
  focusHeading($('shopTitle'));
}

async function boards(mode = boardMode) {
  if (page !== 'boards') {
    show('boards', 'Leaderboards');
    focusHeading($('boardsTitle'));
  }
  boardMode = mode;
  const key = activeKey(mode);
  const request = ++boardRequest;
  for (const tab of $('boards').querySelectorAll('[data-board]')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.board === mode));
  }
  const list = $('boardList');
  list.replaceChildren();
  $('boardInfo').textContent = mode === 'speed' ? `Week of ${key} · fastest time` : `${key} · most earned`;
  $('boardNote').textContent = 'Loading…';
  try {
    const board = await readBoard(mode, key);
    if (request !== boardRequest || page !== 'boards') return;
    for (const entry of board.entries) {
      const node = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = entry.name;
      const score = document.createElement('b');
      score.textContent = scoreText(mode, entry.value);
      node.append(name, score);
      list.append(node);
    }
    $('boardNote').textContent = board.entries.length ? '' : 'No scores yet.';
  } catch (error) {
    if (request === boardRequest && page === 'boards') {
      const personal = save.records[mode][key];
      $('boardNote').textContent = (error.message || 'Leaderboard unavailable.') +
        (personal === undefined ? '' : ` Your best here is ${scoreText(mode, personal)}.`);
    }
  }
}

function openBook() {
  if ($('results').open) return;
  const showDay = page === 'shift' ? shift.day : page === 'intro' ? pending.spec.day : E.DAYS;
  $('recipeList').innerHTML = E.menuFor(showDay).map(recipeCard).join('');
  clearDrag();
  if (page === 'shift') F.musicPause(true);
  openDialog('recipes');
}

function pause() {
  if (page !== 'shift' || shift?.phase !== 'running' || $('paused').open || $('recipes').open) return;
  clearDrag();
  F.musicPause(true);
  openDialog('paused');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
$('recipes').addEventListener('close', () => {
  if (!$('paused').open && page === 'shift') F.musicPause(false);
});
$('paused').addEventListener('close', () => {
  if (!$('recipes').open) F.musicPause(false);
});
$('results').addEventListener('cancel', event => {
  event.preventDefault();
  home();
});

$('play').addEventListener('click', () => prepare('day', save.day));
$('openDaily').addEventListener('click', () => prepare('daily'));
$('openSpeed').addEventListener('click', () => prepare('speed'));
$('openShop').addEventListener('click', () => shop());
$('openBoards').addEventListener('click', () => boards());
$('startShift').addEventListener('click', startShift);
$('introBack').addEventListener('click', () => home());
$('resNext').addEventListener('click', () => prepare('day', result.day + 1));
$('resRetry').addEventListener('click', () => result?.coop ? coopPage() : prepare(result.mode, result.day, result.challenge, result.mode === 'day' ? null : result));
$('resShop').addEventListener('click', () => shop('results'));
$('resHome').addEventListener('click', () => home());
$('resChallenge').addEventListener('click', shareChallenge);
$('saveScore').addEventListener('submit', saveScore);
$('shopBack').addEventListener('click', () => {
  if (shopReturn === 'results') {
    show('shift', result.title, result.key ?? '');
    renderResults();
    openDialog('results');
  } else {
    home();
  }
});
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', () => closeDialog('paused'));
$('quit').addEventListener('click', () => home());
$('book').addEventListener('click', openBook);
$('pausedRecipes').addEventListener('click', openBook);
$('recipesClose').addEventListener('click', () => closeDialog('recipes'));
$('boardsBack').addEventListener('click', () => home());
$('boardRefresh').addEventListener('click', () => boards());
for (const tab of $('boards').querySelectorAll('[data-board]')) tab.addEventListener('click', () => boards(tab.dataset.board));

function showSound() {
  const muted = F.isMuted();
  $('sound').textContent = muted ? '🔇' : '🔊';
  $('sound').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
}

for (const type of ['pointerup', 'click', 'keydown']) {
  window.addEventListener(type, () => {
    F.unlock();
    if (page !== 'shift') F.musicStart(true);
  }, { capture: true, passive: true });
}
$('sound').addEventListener('click', () => {
  F.setMuted(!F.isMuted());
  showSound();
});
showSound();
$('openCoop').addEventListener('click', () => coopPage());

// ⛶ full screen: on Android (and computers) straight away, and sideways on phones; on iPhone, how to install it
// (opened from the home screen: already full screen. Note: page full screen also reports display-mode fullscreen)
const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches ||
  (matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement);
function showFullscreen() {
  const on = Boolean(document.fullscreenElement);
  $('fullscreen').hidden = installed();
  $('fullscreen').setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
  $('fullscreen').innerHTML = on
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
}
$('fullscreen').addEventListener('click', async () => {
  F.unlock();
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
  } else if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (matchMedia('(pointer: coarse)').matches) await screen.orientation?.lock?.('landscape');
    } catch {
      // (refused: nothing changes)
    }
  } else openDialog('fsTip');
  showFullscreen();
});
$('fsTipClose').addEventListener('click', () => closeDialog('fsTip'));
document.addEventListener('fullscreenchange', showFullscreen);
showFullscreen();
$('startShift').addEventListener('click', goSideways);
$('coopGo').addEventListener('click', goSideways);
$('coopJoin').addEventListener('click', goSideways);
$('upright').addEventListener('click', () => {
  document.body.classList.add('upright');
  try {
    localStorage.setItem('hawker-rush-upright', '1');
  } catch {
    // (asked again next visit)
  }
});
try {
  if (localStorage.getItem('hawker-rush-upright')) document.body.classList.add('upright');
} catch {
  // (no storage)
}
$('coopCreate').addEventListener('click', () => coopOpen(null));
$('coopJoin').addEventListener('click', () => coopOpen($('coopCode').value));
$('coopCode').addEventListener('keydown', event => { if (event.key === 'Enter') coopOpen($('coopCode').value); });
$('coopShare').addEventListener('click', coopShare);
$('coopGo').addEventListener('click', coopGo);
$('coopLeave').addEventListener('click', async () => {
  stopListening?.();
  await Co.leave();
  coopPage();
});
$('coopBack').addEventListener('click', () => home());
$('coopDay').addEventListener('change', () => Co.send({ t: 'day', day: Number($('coopDay').value) }));
for (const b of $('team').querySelectorAll('[data-emote]')) {
  b.addEventListener('click', () => {
    Co.send({ t: 'emote', e: b.dataset.emote });
    showEmote(Co.current()?.seat ?? 0, b.dataset.emote);
  });
}

const challenge = parseChallenge(location.href);
const roomLink = new URL(location.href).searchParams.get('room');
if (challenge) prepare(challenge.mode, challenge.spec.day, challenge);
else if (roomLink && /^[A-Za-z0-9]{5}$/.test(roomLink)) coopPage(roomLink.toUpperCase());
else home({ focus: false });
