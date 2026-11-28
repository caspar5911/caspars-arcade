import * as E from './engine.mjs';
import * as Art from './art.mjs';
import * as F from './feel.mjs';
import * as Co from './coop.mjs';
import { challengeUrl, parseChallenge, readBoard, startRankedRun, submitScore } from './competition.mjs';
import { keepUpdated } from './updates.mjs';
import { canPlay, clearDay } from './progress.mjs';
import { teamPay, teamBonus } from './rewards.mjs';
import { bonusGoal, goalProgress } from './goals.mjs';
import { ACHIEVEMENTS, MASTERY, REGULAR_HEARTS, STICKER_GOLD, collect, masteryOf, newAchievements } from './collection.mjs';
import { GIFTS, claimGift, localDay } from './gift.mjs';
import { sendStat, setStats, statsOn } from './stats.mjs';
import { resultPicture, sharePicture } from './share.mjs';
import * as Acct from './account.mjs';
import { ALL_DONE_BONUS, LEVEL_DECOR, decorAt, levelAt, levelPay, missionsFor, progress, xpFor, xpForLevel } from './missions.mjs';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'hawker-rush-save';
const pages = ['home', 'intro', 'shift', 'shop', 'boards', 'coop', 'collection', 'account'];
const stationActions = { toaster: 'Toast bread', pot: 'Boil eggs', grill: 'Grill satay' };
const people = Object.fromEntries(E.PEOPLE.map(person => [person.id, person.name]));
const regulars = Object.fromEntries(E.REGULARS.map(r => [r.id, r]));
const SHORT = { huat: 'Huat', meiling: 'Mei Ling', lily: 'Lily', siti: 'Siti', rajan: 'Rajan', boon: 'Boon' }; // (seat tags)
/** What a customer is called at the counter: a regular by name, the critic, a group, or just who they are. */
const nameOf_ = c => c.regular ? regulars[c.regular]?.name ?? people[c.who]
  : c.kind === 'critic' ? 'Food critic' : c.kind === 'group' ? 'Big group' : people[c.who];
const ingredientLabels = { milk: 'Milk', soy: 'Soy', peanut: 'Peanut' };
const cents = value => Math.round(value * 100);
const money = value => '$' + (value % 1 ? value.toFixed(2) : value.toFixed(0));
const duration = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const scoreText = (mode, value) => mode === 'speed' ? `${(value / 100).toFixed(2)} s` : money(value / 100);
// 💡 first-time tips: each new thing is explained the first time it happens (once per phone)
const TIPS = {
  fever: { icon: '🔥', title: 'Fever time!', text: 'You served 5 in a row: tips are doubled for 8 seconds. Keep going! If someone storms off, Fever ends.' },
  critic: { icon: '📝', title: 'A food critic!', text: 'Critics are less patient. Serve them quickly for a glowing review (worth the dishes again). If they storm off, you lose $5.' },
  group: { icon: '👥', title: 'A big group', text: 'They order three dishes at once, wait a bit longer, and tip big.' },
  regular: { icon: '♥', title: 'A regular!', text: 'Regulars always order their favourite. Every visit you serve fills a heart: see them on the Collection page.' },
  cookdish: { icon: '🔥', title: 'Cook it whole', text: 'This dish is built first, then cooked: tap it to send it to the wok or the griddle, then tap the cooker to take it out when it’s done.' },
  flip: { icon: '🫓', title: 'Flip it!', text: 'Prata needs flipping halfway. When the griddle says Flip!, tap it, or it burns.' },
  burnt: { icon: '💨', title: 'Burnt!', text: 'Food left on the fire too long burns. Tap the cooker to bin it, and keep an eye on the timers.' },
};

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
    // (any day: days cleared with friends can be ahead of your own progress)
    if (/^[1-9]\d{0,5}$/.test(id)) best[id] = boundedInt(stars, 0, 3);
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
  // (collections, achievements, bonus goals done and the daily gift: kept only in their checked shapes)
  const counts = raw => Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? raw : {})
    .filter(([id, n]) => /^[a-zA-Z]{1,20}$/.test(id) && Number.isSafeInteger(n) && n > 0));
  const collection = { dishes: counts(raw?.collection?.dishes), people: counts(raw?.collection?.people) };
  const achievements = {};
  for (const a of ACHIEVEMENTS) if (raw?.achievements?.[a.id] === true) achievements[a.id] = true;
  // (the day's missions: only in their checked shape)
  const missionKinds = ['served', 'dish', 'fevers', 'perfect', 'combo', 'shifts', 'threeStars', 'regulars'];
  const m = raw?.missions;
  const missions = m && /^\d{4}-\d{2}-\d{2}$/.test(m.date ?? '') && Array.isArray(m.list) && m.list.length === 3 &&
    m.list.every(x => missionKinds.includes(x?.kind) && Number.isSafeInteger(x.need) && x.need >= 1 && x.need <= 100 &&
      Number.isSafeInteger(x.have) && x.have >= 0 && x.have <= x.need && typeof x.done === 'boolean' &&
      typeof x.text === 'string' && x.text.length <= 80 && Number.isSafeInteger(x.pay) && x.pay >= 0 && x.pay <= 50 &&
      (x.dish === undefined || Object.hasOwn(E.DISHES, x.dish)))
    ? { date: m.date, bonus: m.bonus === true, list: m.list.map(x => ({ kind: x.kind, need: x.need, have: x.have, done: x.done,
      text: x.text, pay: x.pay, ...(x.dish ? { dish: x.dish } : {}) })) } : null;
  const seen = {};
  for (const id of Object.keys(TIPS)) if (raw?.seen?.[id] === true) seen[id] = true;
  const regularHearts = {};
  for (const r of E.REGULARS) {
    const n = boundedInt(raw?.regulars?.[r.id], 0, REGULAR_HEARTS);
    if (n) regularHearts[r.id] = n;
  }
  const goalsDone = {};
  for (const [id, done] of Object.entries(raw?.goalsDone ?? {})) if (/^[1-9]\d{0,5}$/.test(id) && done === true) goalsDone[id] = true;
  const gift = /^\d{4}-\d{2}-\d{2}$/.test(raw?.gift?.last ?? '')
    ? { last: raw.gift.last, streak: boundedInt(raw.gift.streak, 1, 100000, 1) } : null;
  return {
    version: 2, day, best, upgrades, decor, records, collection, achievements, goalsDone, gift, regulars: regularHearts, seen, missions,
    xp: boundedInt(raw?.xp, 0, Number.MAX_SAFE_INTEGER),
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
  cloudSoon(); // (and to the account, when signed in)
}

function button(label, className = '') {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  if (className) el.className = className;
  return el;
}

const BACK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>';
const ARCADE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>';

function show(next, title, subtitle = '') {
  page = next;
  for (const id of pages) $(id).hidden = id !== next;
  // ← steps back inside the game; only the home page's button (a grid, not an arrow) leads out to all the games
  const out = next === 'home';
  if ($('back').dataset.out !== String(out)) {
    $('back').dataset.out = String(out);
    $('back').innerHTML = out ? ARCADE_ICON : BACK_ICON;
    $('back').setAttribute('aria-label', out ? 'All games' : 'Back');
  }
  syncHistory();
  if ((next === 'shift') !== (document.body.dataset.locked === 'true')) {
    document.body.dataset.locked = String(next === 'shift');
    lockScreen(); // (a shift turns the phone the chosen way; leaving it puts the menus back upright)
  }
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

function stall(decor, w) {
  return Art.stallTop({ ...decor, ...decorAt(levelAt(save.xp)) }, w) + (decor.plants
    ? '<span class="plant left">🪴</span><span class="plant right">🪴</span>' : '');
}

/** 🏪 The stall level and 📋 today's missions, on the home page. */
function renderToday() {
  const fresh = missionsFor(save.missions, localDay(), save.day);
  if (fresh !== save.missions) {
    save.missions = fresh;
    persist();
  }
  const level = levelAt(save.xp), from = xpForLevel(level), to = xpForLevel(level + 1);
  const next = LEVEL_DECOR.find(d => d.level > level);
  setText($('levelNum'), String(level));
  $('xpFill').style.width = `${Math.round(100 * (save.xp - from) / (to - from))}%`;
  setText($('xpNote'), `${save.xp - from} / ${to - from} XP` + (next ? ` · ${next.name} at level ${next.level}` : ''));
  $('missionList').innerHTML = save.missions.list.map(m =>
    `<li class="${m.done ? 'done' : ''}"><span class="mission-check" aria-hidden="true">${m.done ? '✓' : '○'}</span>` +
    `<span class="mission-text">${m.text}<small>${m.done ? 'Done!' : `${m.have} / ${m.need}`} · +${money(m.pay)}</small></span>` +
    `<span class="mission-bar" aria-hidden="true"><i style="width:${Math.round(100 * m.have / m.need)}%"></i></span></li>`).join('');
  const left = save.missions.list.filter(m => !m.done).length;
  setText($('missionBonus'), save.missions.bonus ? 'All three done today: see you tomorrow! 🎉'
    : `Finish all three for +${money(ALL_DONE_BONUS)} more` + (left < 3 ? ` (${left} to go)` : ''));
}

/** 🎁 The day's gift, once a day, on the home page. */
function offerGift() {
  if (page !== 'home' || document.querySelector('dialog[open]')) return;
  const got = claimGift(save.gift, localDay());
  if (!got) return;
  save.gift = got.gift;
  save.wallet = (cents(save.wallet) + cents(got.amount)) / 100;
  const earned = newAchievements(save.achievements, { gift7: got.streak >= 7 });
  for (const a of earned) {
    save.achievements[a.id] = true;
    save.wallet = (cents(save.wallet) + cents(a.pay)) / 100;
  }
  persist();
  const at = (got.streak - 1) % GIFTS.length;
  $('giftAmount').textContent = '+' + money(got.amount);
  $('giftWeek').innerHTML = GIFTS.map((g, i) =>
    `<li class="${i < at ? 'got' : i === at ? 'today' : ''}"><small>Day ${i + 1}</small><b>${money(g)}</b></li>`).join('');
  $('giftNote').textContent = (got.streak > 1 ? `${got.streak} days in a row! ` : '') +
    `Come back tomorrow for ${money(GIFTS[got.streak % GIFTS.length])}.` +
    earned.map(a => ` 🏆 ${a.name} +${money(a.pay)}`).join('');
  $('wallet').textContent = money(save.wallet);
  F.sfx.ding();
  openDialog('gift');
}

function activeKey(mode) {
  return mode === 'speed' ? E.speedRun().key : E.dayKey();
}

function home({ focus = true } = {}) {
  if (run && shift?.phase === 'running' && page === 'shift') shiftStat(true); // (left part-way)
  if (Co.current()) {
    stopListening?.();
    Co.leave();
  }
  $('team').hidden = true;
  closeDialog('results');
  closeDialog('paused');
  closeDialog('recipes');
  stopShift();
  result = null;
  pending = null;
  if (F.musicPlaying() && !F.musicCalm()) F.musicStop();
  F.musicStart(true);
  show('home', 'Hawker Rush');
  setTimeout(() => applyUpdate?.(), 0); // (a release that came out mid-shift goes in now)
  setTimeout(offerGift, 500);
  $('collectionNote').textContent = `${ACHIEVEMENTS.filter(a => save.achievements[a.id]).length} of ${ACHIEVEMENTS.length} achievements`;
  renderToday();
  renderAccountTile();
  adoptWhenSafe(); // (newer progress from another phone goes in here, never mid-shift)
  $('homeStall').innerHTML = stall(save.decor) +
    `<div class="home-portraits">${Art.person('auntie', 'happy')}${Art.cat('cheer', theme)}${Art.dish('cup', ['kopi', 'milk'], { face: true })}${Art.person('uncle', 'happy')}</div>`;
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
    const unlocked = canPlay(save, day); // (a day cleared with friends can be played again, even ahead of your own progress)
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
  const bonus = mode === 'day' ? bonusGoal(day) : null;
  $('introBonus').hidden = !bonus;
  if (bonus) $('introBonus').textContent = `🎯 Bonus goal: ${bonus.text} · ` + (save.goalsDone[day] ? 'done ✓' : `+${money(bonus.reward)} the first time`);
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
    el.innerHTML = '<span class="orders"></span><span class="portrait"></span><span class="tag" aria-hidden="true" hidden></span><span class="patience" aria-hidden="true"><span></span></span>';
    el.addEventListener('click', () => serveSeat(index));
    seats.append(el);
    return {
      el, orders: el.querySelector('.orders'), portrait: el.querySelector('.portrait'),
      patience: el.querySelector('.patience span'), tag: el.querySelector('.tag'),
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
  for (const el of $('kitchen').querySelectorAll('[data-stock], [data-station]')) {
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

/** The awning and the hawker centre behind the customers, drawn as wide as the stall front (sideways it's a long one). */
function dressStall() {
  const scene = $('shift').querySelector('.scene');
  const w = scene.clientWidth, h = scene.clientHeight;
  const sideways = w > 1.8 * h && w > 500;
  const key = sideways ? `${Math.round(w / 40)}:${Math.round(h / 20)}` : 'upright';
  const dressed = key + JSON.stringify(save.decor) + levelAt(save.xp);
  if (scene.dataset.dressed === dressed) return;
  scene.dataset.dressed = dressed;
  $('awning').innerHTML = stall(save.decor, sideways ? Math.max(400, Math.round(w * 1.55)) : 400);
  // (drawn no bigger than 1.2×, so on a big screen the hawker centre keeps a sensible size behind the customers)
  $('backdrop').innerHTML = Art.backdrop(sideways ? Math.max(400, Math.round(w / Math.min(1.2, Math.max(.3, h / 160)))) : 400);
}
addEventListener('resize', () => { if (run) dressStall(); });

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
  tipQueue.length = 0; // (a tip left waiting from a shift that was quit doesn't pop up later at a random moment)
  // (what this shift served: for the bonus goal, dish mastery and customer stickers)
  run.stats = { dishes: {}, people: {}, perfect: 0, regulars: {} };
  run.bonus = config.mode === 'day' ? bonusGoal(config.day) : null; // (story days, solo or with friends)
  run.bonusShown = false;
  $('bonusChip').hidden = !run.bonus;
  $('cat').html = null;
  $('fx').replaceChildren();
  show('shift', run.title, run.key ?? '');
  run.seats = buildSeats();
  $('team').hidden = !run.coop;
  if (run.coop) renderTeam();
  run.prep = buildCounter();
  buildKitchen();
  dressStall();
  $('props').innerHTML = Art.props(shift.upgrades); // (what you bought in the shop, standing in your stall)
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
  if (!$('coopName').value) $('coopName').value = save.nickname || Acct.current()?.username || '';
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
    for (let d = 1; d <= E.DAYS; d++) {
      if (!canPlay(save, d)) continue;
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
    mode: 'day', upgrades, players: Math.max(1, Math.min(E.MAX_PLAYERS, room.players.length)), rules: E.RULES,
  };
  Co.send({ t: 'start', spec });
  startCoopShift(spec);
}

function startCoopShift(spec) {
  const room = Co.current();
  if (!room) return;
  if (spec.rules !== E.RULES) {
    // (two versions of the game would play two different shifts: the older one has to reload)
    if (page !== 'coop') coopPage();
    coopNote((spec.rules ?? 0) > E.RULES
      ? 'Your friend has a newer version of Hawker Rush. Close and reopen the game to update, then join again.'
      : 'Your friend’s Hawker Rush is out of date. Ask them to close and reopen it, then start again.', true);
    return;
  }
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

/** 📊 One shift, for the anonymous stats (finished, or quit part-way). */
function shiftStat(quit = false) {
  if (!run || !shift) return;
  sendStat({
    event: 'shift', mode: run.coop ? 'coop' : run.mode, level: Math.max(1, Math.min(99999, run.day ?? E.DAYS)),
    stars: run.mode === 'speed' ? 0 : E.starsFor(shift.coins, shift.goal), served: Math.min(500, shift.served),
    lost: Math.min(500, shift.lost + shift.passed), seconds: Math.min(3600, Math.round(shift.t)), quit,
    players: shift.players ?? 1, theme,
  });
}

/** What's true after this shift, for the achievements. */
function achievementFacts(stars) {
  const total = save.totals.served;
  return {
    first: total >= 1, stars3: run.mode === 'day' && stars === 3, combo10: shift.bestCombo >= 10,
    early: (shift.early ?? 0) > 0, spotless: shift.served >= 10 && shift.lost + shift.passed === 0,
    served100: total >= 100, served500: total >= 500, friends: Boolean(run.coop), daily: run.mode === 'daily',
    speed: run.mode === 'speed' && shift.served >= E.SPEED_CUSTOMERS, goals5: Object.keys(save.goalsDone).length >= 5,
    allDays: Array.from({ length: E.DAYS }, (_, i) => i + 1).every(d => (save.best[d] ?? 0) > 0),
    gift7: (save.gift?.streak ?? 0) >= 7, album: E.PEOPLE.every(p => (save.collection.people[p.id] ?? 0) > 0),
    fever: (shift.fevers ?? 0) > 0, critic: (shift.reviews ?? 0) > 0,
    family: Object.values(save.regulars).some(n => n >= 5), allRegulars: E.REGULARS.every(r => (save.regulars[r.id] ?? 0) > 0),
  };
}

/** After a shift: the bonus goal, dish mastery, stickers and achievements (paid into the wallet). Rows for the results. */
function settle(stars) {
  const rows = [];
  const pay = amount => { save.wallet = (cents(save.wallet) + cents(amount)) / 100; };
  if (run.bonus) {
    const p = goalProgress(run.bonus, shiftStats(true));
    if (p.done && !save.goalsDone[run.day]) {
      save.goalsDone[run.day] = true;
      pay(run.bonus.reward);
      rows.push(['🎯 Bonus goal', `${run.bonus.text} ✓ +${money(run.bonus.reward)}`]);
    } else rows.push(['🎯 Bonus goal', p.done ? `${run.bonus.text} ✓ (again)` : `${run.bonus.text} · ${p.short}`]);
  }
  const news = collect(save.collection, run.stats.dishes, run.stats.people);
  const tiers = news.filter(n => n.kind === 'mastery');
  if (tiers.length) {
    const amount = tiers.reduce((sum, t) => sum + t.tier.pay, 0);
    pay(amount);
    rows.push(['🍽 Dish mastery', tiers.map(t => `${E.DISHES[t.id].name} ${t.tier.name}`).join(', ') + ` +${money(amount)}`]);
  }
  const hearts = Object.entries(run.stats.regulars);
  if (hearts.length) {
    for (const [id, n] of hearts) save.regulars[id] = Math.min(REGULAR_HEARTS, (save.regulars[id] ?? 0) + n);
    rows.push(['♥ Regulars', hearts.map(([id]) => `${regulars[id]?.name ?? id} ${save.regulars[id]}/${REGULAR_HEARTS}♥`).join(', ')]);
  }
  const stickers = news.filter(n => n.kind === 'sticker');
  if (stickers.length) rows.push(['⭐ New stickers', stickers.map(n => people[n.id] ?? n.id).join(', ')]);
  const golds = news.filter(n => n.kind === 'gold-sticker');
  if (golds.length) {
    pay(10 * golds.length);
    rows.push(['🌟 Gold stickers', golds.map(n => people[n.id] ?? n.id).join(', ') + ` +${money(10 * golds.length)}`]);
  }
  // 📋 the day's missions
  save.missions = missionsFor(save.missions, localDay(), save.day);
  const mission = progress(save.missions, {
    served: shift.served, dishes: run.stats.dishes, fevers: shift.fevers ?? 0, perfect: run.stats.perfect,
    bestCombo: shift.bestCombo, threeStars: run.mode === 'day' && stars === 3,
    regulars: Object.values(run.stats.regulars).reduce((n, k) => n + k, 0),
  });
  for (const m of mission.done) {
    pay(m.pay);
    rows.push(['📋 Mission done', `${m.text} +${money(m.pay)}`]);
  }
  if (mission.bonus) {
    pay(ALL_DONE_BONUS);
    rows.push(['📋 All three missions!', '+' + money(ALL_DONE_BONUS)]);
  }
  // 🏪 the stall level
  const before = levelAt(save.xp);
  save.xp += xpFor({ served: shift.served, stars: run.mode === 'speed' ? 0 : stars, missions: mission.done.length });
  const after = levelAt(save.xp);
  if (after > before) {
    let amount = 0;
    for (let n = before + 1; n <= after; n++) amount += levelPay(n);
    pay(amount);
    const unlocked = LEVEL_DECOR.filter(d => d.level > before && d.level <= after).map(d => d.name);
    rows.push([`🏪 Stall level ${after}!`, `+${money(amount)}` + (unlocked.length ? ` · ${unlocked.join(', ')} for your stall` : '')]);
  }
  const earned = newAchievements(save.achievements, achievementFacts(stars));
  for (const a of earned) {
    save.achievements[a.id] = true;
    pay(a.pay);
  }
  if (earned.length === 1) rows.push(['🏆 ' + earned[0].name, '+' + money(earned[0].pay)]);
  else if (earned.length) rows.push(['🏆 Achievements', earned.map(a => a.name).join(', ') + ` +${money(earned.reduce((sum, a) => sum + a.pay, 0))}`]);
  return rows;
}

function finishCoop() {
  clearDrag();
  F.musicStop();
  if (run.coop.role === 'host') {
    hostFrame(performance.now(), true);
    Co.send({ t: 'over' });
  }
  const stars = E.starsFor(shift.coins, shift.goal);
  const share = teamPay(shift.coins, shift.players); // (a solo shift's pay, plus the teamwork bonus)
  save.wallet = (cents(save.wallet) + cents(share)) / 100;
  const before = save.best[run.day] ?? 0;
  const opened = clearDay(save, run.day, stars); // (and everyone gets the day cleared on their own list)
  save.totals.served += shift.served;
  save.totals.shifts++;
  const rewards = settle(stars);
  shiftStat();
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
  rows.push(['Your share', `${money(share)}` + (shift.players >= 2 ? ` (incl. +${Math.round(teamBonus(shift.players) * 100)}% teamwork bonus)` : '')]);
  rows.push(['Your days', stars
    ? `Day ${run.day} ${starsText(save.best[run.day])}${stars > before ? ' saved' : ''}` + (opened ? ` · Day ${opened} open` : '')
    : `Day ${run.day} not cleared yet`]);
  rows.push(...rewards);
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

// ⬅ the phone's own back (gesture or button) does the same as ←: while inside the game, one extra history entry
// catches it, so it steps back a page (or pauses the shift) instead of leaving the game
let leavingByCode = false;
function syncHistory() {
  const inside = page !== 'home';
  if (inside && history.state?.hawker !== 'in') history.pushState({ hawker: 'in' }, '');
  else if (!inside && history.state?.hawker === 'in') {
    leavingByCode = true;
    history.back();
  }
}
addEventListener('popstate', () => {
  if (leavingByCode) {
    leavingByCode = false;
    if (page !== 'home') history.pushState({ hawker: 'in' }, ''); // (went back inside meanwhile)
    return;
  }
  if (page === 'home') return;
  stepBack();
  if (page !== 'home') history.pushState({ hawker: 'in' }, '');
});

// 📱 upright or sideways: the player picks (upright unless they choose sideways). Full screen holds the phone that way
// where the browser allows it; sideways players holding the phone upright get a "turn your phone" card.
const SCREEN_KEY = 'hawker-rush-screen';
let screenPref = 'upright';
try {
  if (localStorage.getItem(SCREEN_KEY) === 'sideways') screenPref = 'sideways';
} catch {
  // (no storage: upright)
}
const needsTurning = () => screenPref === 'sideways' && matchMedia('(orientation: portrait)').matches;

/** The menus are always upright; only a shift turns the chosen way round. */
async function lockScreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  try {
    await screen.orientation?.lock?.(page === 'shift' && screenPref === 'sideways' ? 'landscape' : 'portrait');
  } catch {
    // (only allowed in full screen, and never on iPhones)
  }
}

function setScreen(pref, remember = true) {
  screenPref = pref === 'sideways' ? 'sideways' : 'upright';
  document.body.classList.toggle('want-sideways', screenPref === 'sideways');
  for (const b of document.querySelectorAll('[data-screen]')) b.setAttribute('aria-pressed', String(b.dataset.screen === screenPref));
  if (remember) {
    try {
      localStorage.setItem(SCREEN_KEY, screenPref);
    } catch {
      // (just for this visit)
    }
    if (page === 'shift' && (document.fullscreenElement || installed())) lockScreen(); // (from the pause card; menus stay upright)
  }
}

/** On phones: go full screen (held the chosen way) when a shift starts, where the browser allows it; iPhones don't. */
async function goFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // (not allowed here)
  }
  await lockScreen();
  showFullscreen();
}

function playing() {
  if (run?.coop?.role === 'guest') return Boolean(shift?.phase === 'running' && !document.hidden); // (the host keeps time)
  return run && shift?.phase === 'running' && !needsTurning() && !$('paused').open && !$('recipes').open && !$('tipCard').open && !document.hidden;
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
  run.seats.forEach(({ el, orders, portrait, patience, tag }, index) => {
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
      tag.hidden = true;
      patience.style.width = '0%';
      return;
    }
    const remaining = customer.left / customer.patience;
    const mood = customer.leaving === 'happy' ? 'eating' : customer.leaving || (remaining < .35 ? 'cross' : 'ok');
    const wanted = customer.order.filter((_, i) => !customer.got[i]).map(id => E.DISHES[id].name);
    const was = `${nameOf_(customer)} · seat ${index + 1}`;
    tag.hidden = !customer.kind;
    if (customer.kind) {
      setText(tag, customer.kind === 'critic' ? '📝 Critic' : customer.kind === 'group' ? '👥 Group'
        : `♥ ${SHORT[customer.regular] ?? ''}`);
      tag.dataset.kind = customer.kind;
    }
    el.setAttribute('aria-label', `${was}: ${waiting ? wanted.join(', ') : customer.leaving === 'happy' ? 'served' : 'leaving'}`);
    setContent(orders, customer.order.map((id, i) => {
      const dish = E.DISHES[id];
      return `<span class="order${customer.got[i] ? ' done' : ''}">${dishArt(id)}<span>${dish.name}</span></span>`;
    }).join(''));
    setContent(portrait, Art.customer(customer, mood));
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
      art.innerHTML = Art.station(id, shapes, { fast: shift.upgrades.fast ?? 0 });
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
  const text = hintOverride && shift.t < hintOverride.until ? hintOverride.text : guided ?? message;
  setText($('hint'), text);
  $('hint').classList.toggle('long', text.length > 76); // (still two lines upright, in smaller print)
  setText($('hudHint'), text); // (sideways, the tip rides in the top bar)
}

/** This shift so far, in the shape the bonus goal reads. */
function shiftStats(over = false) {
  return { served: shift.served, burnt: shift.burnt, lost: shift.lost, passed: shift.passed, bestCombo: shift.bestCombo,
    tips: shift.tips, early: shift.early ?? 0, dishes: run.stats.dishes, perfect: run.stats.perfect, over };
}

function renderBonus() {
  if (!run.bonus) return;
  const p = goalProgress(run.bonus, shiftStats());
  setText($('bonusChip'), '🎯 ' + p.short);
  $('bonusChip').classList.toggle('done', p.done);
  $('bonusChip').title = 'Bonus goal: ' + run.bonus.text;
  if (p.done && !run.bonusShown) {
    run.bonusShown = true;
    banner('🎯 Bonus goal done!');
    F.sfx.ding();
  }
}

function render() {
  renderBonus();
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
  setText($('hudQueue'), queue + (shift.combo > 1 ? ` · ${shift.combo}×` : ''));
  renderSeats();
  renderPrep();
  renderStations();
  renderNext();
  renderHint();
  setContent($('cat'), Art.cat(catMood(), theme));
  const wave = E.WAVES[shift.wave]?.[2];
  $('shift').classList.toggle('rush', wave === 'lunch' || wave === 'dinner');
  const fever = shift.t < shift.feverUntil;
  $('shift').classList.toggle('fever', fever);
  $('feverChip').hidden = !fever;
  if (fever) setText($('feverChip'), `🔥 ×2 · ${Math.ceil(shift.feverUntil - shift.t)}`);
  $('feverChip').title = 'Fever: double tips';
  F.musicRush(fever ? 1 : Math.max(shift.seats.filter(c => c && !c.leaving).length / shift.seats.length, run.mode !== 'speed' && time <= 10 ? 1 : 0));
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

const tipQueue = [];
/** The first time something new happens: explain it (solo: the shift waits; co-op: a quick note, the host keeps time). */
function teach(id) {
  if (!TIPS[id] || save.seen[id] || !run) return;
  save.seen[id] = true;
  persist();
  if (run.coop) {
    banner(`${TIPS[id].icon} ${TIPS[id].title}`);
    transient(TIPS[id].text);
    return;
  }
  tipQueue.push(id);
  showTip();
}
function showTip() {
  if ($('tipCard').open || !tipQueue.length || !run || page !== 'shift') return;
  if ($('paused').open || $('recipes').open || $('results').open) return; // (after those close)
  const tip = TIPS[tipQueue.shift()];
  clearDrag();
  F.musicPause(true);
  setText($('tipIcon'), tip.icon);
  setText($('tipTitle'), tip.title);
  setText($('tipText'), tip.text);
  openDialog('tipCard');
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
      case 'arrive': {
        F.sfx.arrive();
        const c = shift.seats[event.seat];
        if (c?.kind) teach(c.kind);
        break;
      }
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
      case 'base':
        F.sfx.base();
        if (E.readyToCook(shift.prep[event.spot])) teach('cookdish');
        break;
      case 'add':
        F.sfx.add(E.INGREDIENTS[event.ingredient]?.base === 'cup' && event.ingredient !== 'ice');
        if (E.readyToCook(shift.prep[event.spot])) teach('cookdish');
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
      case 'flip-me': F.sfx.ready(); float('Flip!', station, 'bad'); teach('flip'); break;
      case 'flip': F.sfx.base(); float('Flipped!', station, 'good'); break;
      case 'take':
        F.sfx.base();
        fly(station, run.prep[event.spot]?.wrap, dishArt(event.dish));
        break;
      case 'ready': F.sfx.ready(); float('Ready!', station, 'good'); break;
      case 'serve':
        F.sfx.serve();
        if (event.dish) run.stats.dishes[event.dish] = (run.stats.dishes[event.dish] ?? 0) + 1;
        break;
      case 'paid': {
        const who = shift.seats[event.seat]?.who; // (still in the seat, enjoying it)
        if (who) run.stats.people[who] = (run.stats.people[who] ?? 0) + 1;
        if (event.perfect) run.stats.perfect++;
        if (event.regular) run.stats.regulars[event.regular] = (run.stats.regulars[event.regular] ?? 0) + 1;
        F.sfx.paid(event.combo);
        float('+' + money(event.amount) + (event.fever ? ' 🔥' : ''), seat, 'good');
        if (event.review === 'great') {
          F.sfx.review();
          banner('★★★★★ A glowing review!');
          run.cheerUntil = shift.t + 3;
        }
        if (event.regular) {
          F.sfx.regular();
          window.setTimeout(() => float(`♥ ${regulars[event.regular]?.name ?? ''}`, seat, 'good'), 450);
        }
        coins(seat, Math.ceil(event.amount));
        burst(seat, '♥', 7, 'heart');
        if (event.combo >= 3 || event.perfect) run.cheerUntil = shift.t + 1.6;
        if (event.perfect) window.setTimeout(() => float('Perfect!', seat, 'good'), 300);
        if ([5, 10, 15, 20].includes(event.combo)) banner(`Combo ×${event.combo}!`);
        break;
      }
      case 'fever':
        banner('🔥 FEVER! Double tips!');
        F.sfx.fever();
        teach('fever');
        burst($('money'), '🔥', 8, 'spark');
        break;
      case 'fever-end': float('Fever over', $('money'), 'bad'); break;
      case 'angry':
        F.sfx.angry();
        float('Left!', seat, 'bad');
        if (event.review === 'bad') banner(`📝 A bad review… −${money(event.fine)}`, 'bad');
        run.worryUntil = shift.t + 2.2;
        $('shift').classList.remove('shake');
        void $('shift').offsetWidth;
        $('shift').classList.add('shake');
        break;
      case 'burnt': F.sfx.burnt(); float('Burnt!', station, 'bad'); run.worryUntil = shift.t + 1.5; teach('burnt'); break;
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
    clearDay(save, run.day, stars);
  }
  result.rewards = settle(stars);
  persist();
  shiftStat();
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
  rows.push(...(done.rewards ?? []));
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
  // (on to your next day still to clear: days you already cleared with friends are skipped)
  $('resNext').textContent = save.day > E.DAYS && day >= E.DAYS ? 'Play the next endless day' : `Play day ${save.day}`;
  $('resChallenge').hidden = story;
  $('resShop').hidden = !story;
  $('resRetry').textContent = story ? 'Replay day' : 'Play again';
  $('saveScore').hidden = true;
  $('saveBtn').disabled = false;
  $('name').disabled = false;
  $('name').value = save.nickname || Acct.current()?.username || '';
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
// 📐 the height the phone really shows (some browsers count the address bar in 100vh, so the stall came out one bar
// too tall and the page scrolled): measured, and measured again whenever the bars, the size or the way round change
function measureScreen() {
  const h = Math.round(window.innerHeight);
  if (h > 0) {
    document.documentElement.style.setProperty('--app-h', h + 'px');
    document.documentElement.dataset.appH = '';
  }
}
for (const type of ['resize', 'orientationchange']) addEventListener(type, measureScreen);
window.visualViewport?.addEventListener('resize', measureScreen);
document.addEventListener('fullscreenchange', () => setTimeout(measureScreen, 150));
measureScreen();
// 📊 the game closed mid-shift (the tab, or the app swiped away): counted as a shift left part-way
addEventListener('pagehide', () => {
  if (run && shift?.phase === 'running' && page === 'shift') shiftStat(true);
});
$('recipes').addEventListener('close', () => {
  if (!$('paused').open && page === 'shift') F.musicPause(false);
});
$('paused').addEventListener('close', () => {
  if (!$('recipes').open) F.musicPause(false);
  showTip();
});
$('tipOk').addEventListener('click', () => closeDialog('tipCard'));
$('tipCard').addEventListener('close', () => {
  if (tipQueue.length) showTip();
  else if (!$('paused').open && !$('recipes').open && page === 'shift') F.musicPause(false);
});
$('resetTips').addEventListener('click', () => {
  save.seen = {};
  persist();
  $('resetTips').textContent = 'Done: you’ll see them again';
});
// 📳 the phone's buzz, on or off
function showBuzz() {
  for (const b of document.querySelectorAll('[data-buzz]')) b.setAttribute('aria-pressed', String((b.dataset.buzz === 'on') === F.isBuzzOn()));
}
for (const b of document.querySelectorAll('[data-buzz]')) b.addEventListener('click', () => { F.setBuzz(b.dataset.buzz === 'on'); showBuzz(); });
showBuzz();
function showStats() {
  for (const b of document.querySelectorAll('[data-stats]')) b.setAttribute('aria-pressed', String((b.dataset.stats === 'on') === statsOn()));
}
for (const b of document.querySelectorAll('[data-stats]')) b.addEventListener('click', () => { setStats(b.dataset.stats === 'on'); showStats(); });
showStats();
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
$('resNext').addEventListener('click', () => prepare('day', save.day));
$('resRetry').addEventListener('click', () => result?.coop ? coopPage() : prepare(result.mode, result.day, result.challenge, result.mode === 'day' ? null : result));
$('resShop').addEventListener('click', () => shop('results'));
$('resHome').addEventListener('click', () => home());
$('resChallenge').addEventListener('click', shareChallenge);
$('resPicture').addEventListener('click', async () => {
  // 📸 a picture of this result, in the player's theme
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const colours = { ground: v('--ground', '#241d15'), panel: v('--panel', '#372820'), ink: v('--ink', '#fff2de'),
    muted: v('--muted', '#ccbba0'), accent: v('--accent', v('--gold', '#ffcc6f')), line: v('--line', '#78583c'), glow: v('--glow', '#6a442b') };
  const lines = [['Customers served', shift?.served ?? 0]];
  if ((shift?.tips ?? 0) > 0) lines.push(['Tips and combos', money(shift.tips)]);
  if ((shift?.bestCombo ?? 0) > 1) lines.push(['Best combo', `×${shift.bestCombo}`]);
  if ((shift?.fevers ?? 0) > 0) lines.push(['Fever times', shift.fevers]);
  if ((shift?.reviews ?? 0) > 0) lines.push(['Glowing reviews', shift.reviews]);
  const title = (result?.title ?? run?.title ?? 'Hawker Rush').replace(/\s*👫/, ' with friends');
  const big = $('resMoney').textContent.replace(/ earned( together)?$/, '');
  $('resPicture').disabled = true;
  setText($('shareNote'), 'Making your picture…');
  const blob = await resultPicture({ title, stars: $('resStars').hidden ? null : $('resStars').textContent, big, lines,
    cat: Art.cat('cheer', theme), colours, link: 'caspar5911.github.io/caspars-arcade',
    dishes: Object.entries(run?.stats?.dishes ?? {}).sort((a, b) => b[1] - a[1]).map(([id]) => dishArt(id, { face: true })) });
  const how = await sharePicture(blob, `I got ${big} on ${title} in Hawker Rush! 🍜 Can you beat it? ${location.origin + location.pathname}`);
  $('resPicture').disabled = false;
  setText($('shareNote'), how === 'saved' ? 'Picture saved: share it from your photos or downloads.' : how === 'shared' ? 'Shared! 🎉' : '');
});
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

function collectionPage() {
  show('collection', 'Collection');
  const earned = ACHIEVEMENTS.filter(a => save.achievements[a.id]).length;
  const met = E.PEOPLE.filter(p => (save.collection.people[p.id] ?? 0) > 0).length;
  $('collectionIntro').textContent = `${earned} of ${ACHIEVEMENTS.length} achievements · ${met} of ${E.PEOPLE.length} stickers`;
  $('achievementList').innerHTML = ACHIEVEMENTS.map(a => {
    const got = save.achievements[a.id];
    return `<li class="${got ? 'got' : ''}"><span class="ach-icon" aria-hidden="true">${got ? '🏆' : '🔒'}</span>` +
      `<span><b>${a.name}</b><small>${a.what}</small></span><em>${got ? 'Done' : '+' + money(a.pay)}</em></li>`;
  }).join('');
  const known = E.menuFor(Math.min(E.DAYS, Math.max(save.day, ...Object.keys(save.best).map(Number))));
  $('dishList').innerHTML = Object.keys(E.DISHES).map(id => {
    const n = save.collection.dishes[id] ?? 0;
    if (!known.includes(id) && !n) return `<li class="unknown"><span class="mastery-art">?</span><b>???</b><small>Not on your menu yet</small></li>`;
    const tier = masteryOf(n);
    const next = MASTERY[tier];
    return `<li class="tier-${tier}"><span class="mastery-art">${dishArt(id)}</span><b>${E.DISHES[id].name}</b>` +
      `<small>${n} served${next ? ` · ${next.name} at ${next.at}` : ' · Gold!'}</small>` +
      `<span class="medal" aria-label="${tier ? MASTERY[tier - 1].name : 'No medal yet'}">${['', '🥉', '🥈', '🥇'][tier]}</span></li>`;
  }).join('');
  $('regularList').innerHTML = E.REGULARS.map(r => {
    const n = save.regulars[r.id] ?? 0;
    return `<li class="${n ? 'got' : ''}">` + (n ? Art.customer({ who: r.who, kind: 'regular' }, 'happy') : '<span class="unknown-face" aria-hidden="true">?</span>') +
      `<b>${n ? r.name : '???'}</b><small>${n ? `Loves ${E.DISHES[r.fav].name}` : 'Not met yet'}</small>` +
      `<span class="hearts" aria-label="${n} of ${REGULAR_HEARTS} hearts">${'♥'.repeat(n)}<i>${'♥'.repeat(REGULAR_HEARTS - n)}</i></span></li>`;
  }).join('');
  $('stickerList').innerHTML = E.PEOPLE.map(p => {
    const n = save.collection.people[p.id] ?? 0;
    return `<li class="${n ? 'got' : ''}${n >= STICKER_GOLD ? ' gold' : ''}">` +
      (n ? Art.person(p.id, 'happy') : '<span class="unknown-face" aria-hidden="true">?</span>') +
      `<b>${n ? p.name : '???'}</b><small>${n ? `${n} served` : 'Not met yet'}</small></li>`;
  }).join('');
  focusHeading($('collectionTitle'));
}

/** One step back inside the game: a page goes back the way its own Back button does; a shift pauses (quit from there). */
function stepBack() {
  if (page === 'shift') {
    if (shift?.phase === 'running') pause();
    else if (!$('results').open) home();
    return;
  }
  const backs = { intro: 'introBack', shop: 'shopBack', boards: 'boardsBack', coop: 'coopBack', collection: 'collectionBack', account: 'accountBack' };
  if (backs[page]) $(backs[page]).click();
}
$('back').addEventListener('click', event => {
  if (page === 'home') return; // (out to all the games)
  event.preventDefault();
  stepBack();
});
$('resume').addEventListener('click', () => closeDialog('paused'));
$('quit').addEventListener('click', () => home());
$('book').addEventListener('click', openBook);
$('pausedRecipes').addEventListener('click', openBook);
$('recipesClose').addEventListener('click', () => closeDialog('recipes'));
$('boardsBack').addEventListener('click', () => home());
$('openCollection').addEventListener('click', collectionPage);
$('collectionBack').addEventListener('click', () => home());
$('giftClose').addEventListener('click', () => closeDialog('gift'));
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
      await lockScreen();
    } catch {
      // (refused: nothing changes)
    }
  } else openDialog('fsTip');
  showFullscreen();
});
$('fsTipClose').addEventListener('click', () => closeDialog('fsTip'));
document.addEventListener('fullscreenchange', showFullscreen);
showFullscreen();
$('startShift').addEventListener('click', goFullscreen);
$('coopGo').addEventListener('click', goFullscreen);
$('coopJoin').addEventListener('click', goFullscreen);
$('upright').addEventListener('click', () => setScreen('upright'));

// 🎨 colour themes: bright, cute pastels (and the classic dark kopi), each with its own pattern, drifting petals/leaves/
// bubbles/stars, awning colours and an outfit for Mochi the cat. The food and the people stay as they are.
const THEMES = ['latte', 'pandan', 'ocean', 'sakura', 'lavender', 'classic'];
let theme = 'latte';
function setTheme(pick, remember = true) {
  theme = THEMES.includes(pick) ? pick : 'latte';
  const root = document.documentElement;
  if (theme === 'classic') {
    delete root.dataset.theme;
    delete root.dataset.tone;
  } else Object.assign(root.dataset, { theme, tone: 'light' });
  for (const b of document.querySelectorAll('[data-theme-pick]')) b.setAttribute('aria-pressed', String(b.dataset.themePick === theme));
  F.setMusicStyle(theme); // (each theme has its own tune)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--ground').trim());
  // the drifting things behind the menus: a dozen, each with its own place, size and pace
  const sky = $('ambience');
  if (!sky.children.length) {
    for (let k = 0; k < 12; k++) {
      const p = document.createElement('span');
      p.style.cssText = `--x:${(k * 37 + 11) % 100}%;--y:${(k * 53 + 7) % 90}vh;--size:${14 + (k * 7) % 12}px;` +
        `--dur:${9 + (k * 5) % 9}s;--delay:-${(k * 2.3).toFixed(1)}s`;
      sky.append(p);
    }
  }
  if (remember && page === 'home') home({ focus: false }); // (Mochi on the home page changes outfit)
  if (remember) {
    try {
      localStorage.setItem('hawker-rush-theme', theme);
    } catch {
      // (just for this visit)
    }
  }
}
for (const b of document.querySelectorAll('[data-theme-pick]')) b.addEventListener('click', () => setTheme(b.dataset.themePick));
try {
  const saved = localStorage.getItem('hawker-rush-theme');
  setTheme({ kopi: 'latte', night: 'lavender' }[saved] ?? saved ?? 'latte', false);
} catch {
  setTheme('latte', false);
}
// (menus held sideways where the phone can't be held upright for us: ask, but it can be waved away for this visit)
$('keepSideways').addEventListener('click', () => document.body.classList.add('menus-sideways'));
if (installed()) lockScreen(); // (the installed app opens on the menus: upright)
for (const b of document.querySelectorAll('[data-screen]')) b.addEventListener('click', () => setScreen(b.dataset.screen));
setScreen(screenPref, false);
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
// (a newer release reloads itself in, but only from the home page with no co-op stall open)
const applyUpdate = keepUpdated(() => page === 'home' && !Co.current() && !document.querySelector('dialog[open]'));
// ---------------------------------------------------------------------------------------------------- 🏪 the account
// Signed in, the progress is also kept on the server: uploaded a moment after every change (and when back online),
// checked when the game opens. If another phone saved newer progress, this phone takes it, on the home page only.
let cloudTimer = null, cloudBusy = false, cloudNewer = null, edits = 0;
const hasProgress = s => (s?.day ?? 1) > 1 || (s?.wallet ?? 0) > 0 || (s?.totals?.shifts ?? 0) > 0 || (s?.xp ?? 0) > 0;
function describe(s) {
  return `Day ${Math.max(1, Number(s?.day) || 1)} · ${money(Number(s?.wallet) || 0)} · stall level ${levelAt(Number(s?.xp) || 0)}`;
}
function setSync(text) {
  setText($('acctSync'), text);
}

function cloudSoon() {
  const a = Acct.current();
  if (!a) return;
  edits++;
  if (!a.dirty) Acct.remember({ ...a, dirty: true });
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(cloudSave, 1500);
}

async function cloudSave() {
  const a = Acct.current();
  if (!a || !a.dirty || cloudBusy) return;
  cloudBusy = true;
  const at = edits;
  setSync('Saving to your account…');
  try {
    const data = localStorage.getItem(SAVE_KEY) ?? JSON.stringify(save);
    const r = await Acct.store(a.token, data, a.rev);
    const now = Acct.current();
    if (now?.token === a.token) Acct.remember({ ...now, rev: r.rev, dirty: edits !== at });
    setSync('✓ Your progress is saved to your account.');
    if (edits !== at) cloudTimer = setTimeout(cloudSave, 1500); // (changed again while saving)
  } catch (error) {
    if (error.status === 409) {
      // (another phone saved newer progress)
      const cloud = await Acct.load(a.token).catch(() => null);
      if (cloud?.data) {
        cloudNewer = cloud;
        setSync('Newer progress from your other phone: it loads on the home page.');
        adoptWhenSafe();
      }
    } else if (error.status === 401) {
      Acct.remember(null);
      setSync('');
      renderAccountTile();
      banner('You were signed out. Sign in again to keep saving.');
    } else setSync('Offline: your progress will be saved when you’re back online.');
  } finally {
    cloudBusy = false;
  }
}

/** Take the account's progress (reloads the game with it). */
function adopt(cloud, message = 'Progress loaded from your account ✓') {
  const a = Acct.current();
  if (!a || !cloud?.data) return;
  try {
    localStorage.setItem(SAVE_KEY, cloud.data);
    Acct.remember({ ...a, rev: cloud.rev, dirty: false });
    sessionStorage.setItem('hawker-rush-synced', message);
  } catch {
    return;
  }
  location.reload();
}

function adoptWhenSafe() {
  if (cloudNewer && page === 'home' && !document.querySelector('dialog[open]')) {
    const cloud = cloudNewer;
    cloudNewer = null;
    adopt(cloud, 'Progress loaded from your other phone ✓');
  }
}

/** When the game opens: is the account's progress newer than this phone's? */
async function cloudCheck() {
  const a = Acct.current();
  if (!a) return;
  try {
    const cloud = await Acct.load(a.token);
    if (!cloud.data) {
      Acct.remember({ ...a, rev: cloud.rev, dirty: true }); // (an empty account: this phone's progress goes up)
      cloudSave();
    } else if (cloud.rev > a.rev) {
      if (a.dirty && hasProgress(save)) askWhich(cloud);   // (both changed: the player picks)
      else {
        cloudNewer = cloud;
        adoptWhenSafe();
      }
    } else if (a.dirty) cloudSave();
    else setSync('✓ Your progress is saved to your account.');
  } catch (error) {
    if (error.status === 401) {
      Acct.remember(null);
      renderAccountTile();
    } else setSync('Offline: your progress will be saved when you’re back online.');
  }
}

/** Both the account and this phone have progress: which one to keep? */
function askWhich(cloud) {
  let theirs = null;
  try {
    theirs = JSON.parse(cloud.data);
  } catch {
    // (unreadable: it just shows as day 1)
  }
  setText($('pickAccount'), `☁️ My account: ${describe(theirs)}`);
  setText($('pickPhone'), `📱 This phone: ${describe(save)}`);
  $('pickAccount').onclick = () => { closeDialog('pickSave'); adopt(cloud); };
  $('pickPhone').onclick = () => {
    closeDialog('pickSave');
    const a = Acct.current();
    if (a) Acct.remember({ ...a, rev: cloud.rev, dirty: true });
    cloudSave();
    renderAccount();
  };
  openDialog('pickSave');
}

/** Just signed in (or up): bring the progress together. */
async function signedIn(result, fresh) {
  Acct.keepGuestCopy(localStorage.getItem(SAVE_KEY)); // (this phone's own progress, back on logging out)
  const cloud = fresh ? { data: null, rev: 0 } : await Acct.load(result.token);
  Acct.remember({ token: result.token, username: result.username, rev: cloud.rev, dirty: !cloud.data });
  if (!cloud.data) await cloudSave();                // (a new or empty account: this phone's progress goes up)
  else if (!hasProgress(save)) return adopt(cloud);   // (a new phone: the account's progress comes down)
  else askWhich(cloud);
  renderAccount();
}

function renderAccountTile() {
  const a = Acct.current();
  $('accountTileText').firstChild.textContent = a ? `Signed in as ${a.username}` : 'Sign in';
  setText($('accountTileNote'), a ? 'Your progress is kept on any phone' : 'Keep your progress on any phone');
}

let accountTab = 'login';
function renderAccount() {
  const a = Acct.current();
  $('accountOut').hidden = Boolean(a);
  $('accountIn').hidden = !a;
  if (a) setText($('acctName'), a.username);
  for (const b of document.querySelectorAll('[data-acct-tab]')) b.setAttribute('aria-pressed', String(b.dataset.acctTab === accountTab));
  setText($('acctGo'), accountTab === 'signup' ? 'Create my account' : 'Sign in');
  $('acctPass').autocomplete = accountTab === 'signup' ? 'new-password' : 'current-password';
  renderAccountTile();
}

function accountPage() {
  show('account', 'Account');
  setText($('acctNote'), '');
  renderAccount();
  focusHeading($('accountTitle'));
}

$('openAccount').addEventListener('click', accountPage);
$('accountBack').addEventListener('click', () => home());
for (const b of document.querySelectorAll('[data-acct-tab]')) b.addEventListener('click', () => { accountTab = b.dataset.acctTab; setText($('acctNote'), ''); renderAccount(); });
$('accountForm').addEventListener('submit', async event => {
  event.preventDefault();
  const username = $('acctUser').value.trim(), password = $('acctPass').value;
  $('acctGo').disabled = true;
  setText($('acctNote'), accountTab === 'signup' ? 'Creating your account…' : 'Signing in…');
  try {
    const result = accountTab === 'signup' ? await Acct.signup(username, password) : await Acct.login(username, password);
    $('acctPass').value = '';
    setText($('acctNote'), '');
    await signedIn(result, accountTab === 'signup');
  } catch (error) {
    setText($('acctNote'), error.message);
  } finally {
    $('acctGo').disabled = false;
  }
});
$('acctLogout').addEventListener('click', async () => {
  const a = Acct.current();
  if (!a) return;
  if (a.dirty) await cloudSave(); // (the last changes go up first)
  await Acct.logout(a.token);
  Acct.remember(null);
  // the account's progress leaves this phone; the phone's own (from before signing in) comes back
  const guest = Acct.takeGuestCopy();
  try {
    if (guest) localStorage.setItem(SAVE_KEY, guest);
    else localStorage.removeItem(SAVE_KEY);
    sessionStorage.setItem('hawker-rush-synced', 'Logged out. Your progress is safe in your account.');
  } catch {
    // (nothing to change)
  }
  location.reload();
});
$('acctChange').addEventListener('click', async () => {
  const a = Acct.current();
  if (!a) return;
  try {
    await Acct.changePassword(a.token, $('acctOld').value, $('acctNew').value);
    $('acctOld').value = $('acctNew').value = '';
    setText($('acctNote'), '✓ Password changed. Other phones will need to sign in again.');
  } catch (error) {
    setText($('acctNote'), error.message);
  }
});
$('acctDelete').addEventListener('click', async () => {
  const a = Acct.current();
  if (!a) return;
  try {
    await Acct.deleteAccount(a.token, $('acctDelPass').value);
    Acct.remember(null);
    Acct.takeGuestCopy(); // (this phone keeps the progress it has now)
    $('acctDelPass').value = '';
    renderAccount();
    setText($('acctNote'), 'Your account is deleted. The progress on this phone stays.');
  } catch (error) {
    setText($('acctNote'), error.message);
  }
});
addEventListener('online', () => cloudSave());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Acct.current()?.dirty) cloudSave();
});
try {
  const synced = sessionStorage.getItem('hawker-rush-synced');
  sessionStorage.removeItem('hawker-rush-synced');
  if (synced) setTimeout(() => banner(synced), 700);
} catch {
  // (no message)
}
cloudCheck();

sendStat({ event: 'open', level: Math.max(1, Math.min(99999, save.day)), theme }); // 📊 (anonymous; see stats.mjs)
const roomLink = new URL(location.href).searchParams.get('room');
if (challenge) prepare(challenge.mode, challenge.spec.day, challenge);
else if (roomLink && /^[A-Za-z0-9]{5}$/.test(roomLink)) coopPage(roomLink.toUpperCase());
else home({ focus: false });
