import * as E from './engine.mjs';
import * as F from './feel.mjs';

const $ = id => document.getElementById(id);
const pages = ['home', 'intro', 'shift', 'shop'];
const SAVE_KEY = 'hawker-rush-save';

// ---------------------------------------------------------------------------------------------------- saved progress
function load() {
  const fresh = { day: 1, best: {}, wallet: 0, upgrades: {}, decor: {}, daily: {}, totals: { served: 0, shifts: 0 } };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    return s ? { ...fresh, ...s, totals: { ...fresh.totals, ...(s.totals ?? {}) } } : fresh;
  } catch {
    return fresh;
  }
}
const save = load();
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // (private browsing: kept for this visit)
  }
}
const money = v => '$' + (Math.round(v * 100) / 100).toFixed(v % 1 ? 2 : 0);

function show(page) {
  for (const p of pages) $(p).hidden = p !== page;
  $('pause').hidden = page !== 'shift';
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------------------------------- home
function decorLine() {
  return Object.keys(E.DECOR).filter(id => save.decor[id]).map(id => E.DECOR[id].emoji).join(' ');
}

function home() {
  stopShift();
  if (!F.musicPlaying()) F.musicStart(true); // (a calm loop, once sound is allowed)
  show('home');
  $('hudTitle').textContent = 'Hawker Rush';
  $('hudSub').textContent = '';
  $('homeDecor').textContent = decorLine();
  $('play').textContent = `▶ Day ${save.day}` + (save.day > E.DAYS ? ' (endless)' : '');
  $('wallet').textContent = money(save.wallet);
  const today = E.daily();
  $('dailyBest').textContent = save.daily.key === today.key ? `Today’s best: ${money(save.daily.best)}` : `#${today.number} · same shift for everyone`;
  const grid = $('days');
  grid.replaceChildren();
  for (let d = 1; d <= Math.max(E.DAYS, save.day); d++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = d > save.day;
    if (d === save.day) b.className = 'next';
    const stars = save.best[d] ?? 0;
    b.innerHTML = `<span>${d}</span><small>${d > save.day ? '🔒' : '⭐'.repeat(stars)}</small>`;
    b.setAttribute('aria-label', `Day ${d}` + (d > save.day ? ', locked' : stars ? `, ${stars} stars` : ''));
    b.addEventListener('click', () => intro('day', d));
    grid.append(b);
  }
}

// ---------------------------------------------------------------------------------------------------- before a shift
let pending = null; // { mode, spec, title }

function intro(mode, day) {
  const spec = mode === 'daily'
    ? E.daily().shift
    : { day, seed: 'day-' + day, upgrades: { ...save.upgrades } };
  const title = mode === 'daily' ? `Daily Rush #${E.daily().number}` : `Day ${day}`;
  pending = { mode, spec, title, dayNumber: day };
  show('intro');
  $('hudTitle').textContent = title;
  $('hudSub').textContent = '';
  $('introTitle').textContent = title;
  const goal = E.goals(E.schedule(spec.day, spec.seed, spec.upgrades));
  $('introGoals').textContent = `⭐ ${money(goal[0])}  ·  ⭐⭐ ${money(goal[1])}  ·  ⭐⭐⭐ ${money(goal[2])}`;
  const fresh = mode === 'day' ? E.newDishOn(day) : null;
  const box = $('introNew');
  box.hidden = !fresh;
  if (fresh) {
    const d = E.DISHES[fresh], st = E.STATIONS[fresh];
    box.innerHTML = `New on the menu: <b>${d.emoji} ${d.name}</b> (${money(d.price)})` +
      (st.burn ? ' · ⚠️ it burns if you leave it ready too long!' : '');
  }
  $('introTip').textContent = mode === 'daily'
    ? 'Everyone gets this same shift today (all dishes, a standard stall, no upgrades). Beat your friends!'
    : day === 1
      ? 'Tap ☕ Kopi to brew a kopi. When it’s ready (green ring), tap ☕ Kopi again to serve it to a customer.'
      : day > E.DAYS
        ? 'Endless days: the rush only gets busier. How long can you keep up?'
        : `${E.schedule(spec.day, spec.seed, spec.upgrades).length} customers today. You need ⭐ to unlock the next day.`;
}

// ---------------------------------------------------------------------------------------------------- the shift
let shift = null, run = null; // run: { mode, spec, title, taps, raf, last, acc, paused, seatKeys, rushShown, lastSecond }

function startShift() {
  F.unlock();
  const { mode, spec, title } = pending;
  shift = E.createShift(spec);
  run = { mode, spec, title, taps: [], raf: 0, last: 0, acc: 0, paused: false, seatKeys: [], rushShown: false, lastSecond: 99, dayNumber: pending.dayNumber };
  show('shift');
  $('hudTitle').textContent = title;
  buildCounter();
  buildKitchen();
  F.musicStop();
  F.sfx.start();
  render();
  run.raf = requestAnimationFrame(frame);
}

function stopShift() {
  if (run) cancelAnimationFrame(run.raf);
  run = null;
  F.musicPause(false);
}

function buildCounter() {
  const seats = $('seats');
  seats.replaceChildren();
  run.seatEls = shift.seats.map(() => {
    const el = document.createElement('div');
    el.className = 'seat empty';
    seats.append(el);
    return el;
  });
  const marks = $('goalMarks');
  marks.replaceChildren();
  const top = shift.goal[2] * 1.05;
  shift.goal.forEach((g, i) => {
    const m = document.createElement('span');
    m.className = 'goal-mark';
    m.style.left = (100 * g / top) + '%';
    m.textContent = '⭐';
    m.title = `${i + 1} star${i ? 's' : ''}: ${money(g)}`;
    marks.append(m);
  });
}

function buildKitchen() {
  const k = $('kitchen');
  k.replaceChildren();
  const ids = Object.keys(shift.stations);
  k.className = 'kitchen' + (ids.length >= 5 ? ' three' : '');
  run.stationEls = {};
  for (const id of ids) {
    const st = E.STATIONS[id], dish = E.DISHES[st.dish];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'station';
    b.dataset.station = id;
    b.setAttribute('aria-label', `${st.name}: tap to cook or serve ${dish.name}`);
    b.innerHTML = `<span class="st-name">${dish.emoji} ${st.name}</span><span class="slots"></span>`;
    const slotsEl = b.querySelector('.slots');
    const slotEls = shift.stations[id].slots.map(() => {
      const s = document.createElement('span');
      s.className = 'slot';
      s.innerHTML = '<span></span>';
      slotsEl.append(s);
      return s;
    });
    b.addEventListener('pointerdown', event => {
      event.preventDefault();
      tap(id);
    });
    b.addEventListener('click', event => {
      if (event.detail === 0) tap(id); // (keyboard)
    });
    k.append(b);
    run.stationEls[id] = { el: b, slots: slotEls };
  }
  if (ids.length < 5 && ids.length % 2 === 1) k.lastElementChild.classList.add('wide');
  k.style.setProperty('--rows', String(Math.ceil(ids.length / (ids.length >= 5 ? 3 : 2))));
}

function tap(id) {
  if (!shift || shift.phase !== 'running' || run.paused) return;
  F.unlock();
  run.taps.push([shift.ticks, 'station', id, 0]);
  E.tapStation(shift, id);
  handleEvents();
  render();
}

function frame(now) {
  if (!run) return;
  const dt = Math.min(.1, (now - (run.last || now)) / 1000);
  run.last = now;
  if (!run.paused && !document.hidden) {
    run.acc += dt;
    while (run.acc >= E.TICK && shift.phase === 'running') {
      E.step(shift);
      run.acc -= E.TICK;
      handleEvents();
    }
    render();
    // the music: calm when quiet, faster when the counter is full or time is short
    if (!F.musicPlaying()) F.musicStart();
    const waiting = shift.seats.filter(c => c && !c.leaving).length;
    F.musicRush(Math.max(E.SHIFT - shift.t < 15 ? 1 : 0, (waiting - 1) / 3, shift.queue.length ? .7 : 0));
  }
  if (shift.phase === 'over') {
    finish();
    return;
  }
  run.raf = requestAnimationFrame(frame);
}

function render() {
  const left = Math.max(0, E.SHIFT - shift.t);
  const secs = Math.ceil(left);
  const clock = $('clock');
  clock.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  clock.classList.toggle('late', left <= 10);
  if (left <= 10 && secs !== run.lastSecond && secs > 0) F.sfx.tick();
  run.lastSecond = secs;
  $('money').textContent = money(shift.coins);
  const top = shift.goal[2] * 1.05;
  $('goalFill').style.width = Math.min(100, 100 * shift.coins / top) + '%';
  [...$('goalMarks').children].forEach((m, i) => m.classList.toggle('got', shift.coins >= shift.goal[i]));
  $('hudSub').textContent = `${shift.served} served · combo ${shift.combo}`;
  // customers
  shift.seats.forEach((c, i) => {
    const el = run.seatEls[i];
    const key = c ? `${c.id}:${c.leaving ?? ''}` : '';
    if (run.seatKeys[i] !== key) {
      run.seatKeys[i] = key;
      el.className = 'seat' + (c ? (c.leaving ? ' ' + c.leaving : ' arrive') : ' empty');
      el.innerHTML = c
        ? `<div class="bubble">${c.order.map(d => `<span>${E.DISHES[d].emoji}</span>`).join('')}</div>` +
          `<div class="face">${c.emoji}</div><span class="mood"></span><div class="patience"><div></div></div>`
        : '<div class="face">🪑</div>';
      el.setAttribute('aria-label', c ? `Customer wants ${c.order.map(d => E.DISHES[d].name).join(', ')}` : 'Empty seat');
    }
    if (!c) return;
    const share = c.left / c.patience;
    const bar = el.querySelector('.patience div');
    if (bar) {
      bar.style.width = (share * 100) + '%';
      bar.style.background = share > .5 ? 'var(--green)' : share > .25 ? 'var(--gold)' : 'var(--red)';
    }
    const mood = el.querySelector('.mood');
    if (mood) mood.textContent = c.leaving === 'happy' ? '😋' : c.leaving === 'angry' ? '😠' : share > .5 ? '😊' : share > .25 ? '😐' : '😤';
    el.querySelectorAll('.bubble span').forEach((s, k) => s.classList.toggle('done', !!c.got[k]));
  });
  $('queue').textContent = shift.queue.length ? `👥 ${shift.queue.length} waiting in line` : '';
  // kitchen
  for (const [id, { el, slots }] of Object.entries(run.stationEls)) {
    let ready = false, hot = false;
    shift.stations[id].slots.forEach((item, i) => {
      const s = slots[i];
      const inner = s.firstChild;
      if (!item) {
        s.className = 'slot';
        inner.textContent = '';
        s.style.setProperty('--p', 0);
        return;
      }
      const p = E.progress(shift, id, item);
      if (item.state === 'burnt') {
        s.className = 'slot burnt';
        inner.textContent = '💨';
        s.style.setProperty('--p', 0);
      } else if (item.state === 'ready') {
        const burns = E.STATIONS[id].burn !== null;
        s.className = 'slot ready' + (burns && p > .5 ? ' hot' : '');
        inner.textContent = E.DISHES[item.dish].emoji;
        s.style.setProperty('--p', burns ? 1 - p : 1);
        ready = true;
        hot ||= burns && p > .5;
      } else {
        s.className = 'slot cooking';
        inner.textContent = E.DISHES[item.dish].emoji;
        s.style.setProperty('--p', p);
      }
    });
    el.classList.toggle('ready', ready && E.servingFor(shift, E.STATIONS[id].dish) >= 0);
    el.classList.toggle('burning', hot);
  }
  guide();
}

/** Day 1 (and new dishes): show what to do next. */
function guide() {
  const hint = $('hint');
  let text = '', lead = null;
  if (run.mode === 'day' && run.dayNumber === 1 && shift.served < 2) {
    const kopi = shift.stations.kopi.slots;
    const someone = shift.seats.some(c => c && !c.leaving);
    if (!someone) text = 'Customers are coming…';
    else if (kopi.some(it => it && it.state === 'ready')) { text = '👆 Ready! Tap ☕ Kopi again to serve it'; lead = 'kopi'; }
    else if (kopi.some(it => it && it.state === 'cooking')) text = 'Brewing… nearly ready';
    else { text = '👆 Tap ☕ Kopi to brew a kopi'; lead = 'kopi'; }
  } else if (run.mode === 'day' && run.dayNumber === 1 && shift.served < 4) {
    text = 'Faster service = bigger tips 💰';
  } else if (shift.t < 6 && run.mode === 'day' && E.newDishOn(run.dayNumber)) {
    const d = E.newDishOn(run.dayNumber);
    text = `New: ${E.DISHES[d].emoji} ${E.DISHES[d].name}!` + (E.STATIONS[d].burn ? ' Serve it before it burns 🔥' : '');
  }
  if (hint.textContent !== text) hint.textContent = text;
  hint.classList.toggle('point', !!lead);
  for (const [id, { el }] of Object.entries(run.stationEls)) el.classList.toggle('lead', id === lead);
}

function floater(text, kind, anchor) {
  const box = $('shift').getBoundingClientRect();
  const r = anchor.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float ' + kind;
  f.textContent = text;
  f.style.left = (r.left + r.width / 2 - box.left) + 'px';
  f.style.top = (r.top - box.top + 10) + 'px';
  $('floaters').append(f);
  setTimeout(() => f.remove(), 1000);
}

function banner(text) {
  const b = document.createElement('div');
  b.className = 'banner';
  b.textContent = text;
  $('floaters').append(b);
  setTimeout(() => b.remove(), 1200);
}

function handleEvents() {
  for (const e of shift.events) {
    const seatEl = e.seat !== undefined ? run.seatEls[e.seat] : null;
    const stEl = e.station ? run.stationEls[e.station]?.el : null;
    switch (e.type) {
      case 'cook': F.sfx.cook(); break;
      case 'ready': F.sfx.ready(); break;
      case 'serve': F.sfx.serve(); break;
      case 'paid':
        F.sfx.paid(e.combo);
        floater('+' + money(e.amount), 'money', seatEl);
        if (e.combo >= 3) floater(`Combo ×${e.combo}!`, 'combo', $('money'));
        break;
      case 'arrive':
        F.sfx.arrive();
        if (!run.rushShown && shift.seats.every(Boolean) && shift.t > 10) {
          run.rushShown = true;
          banner('RUSH HOUR!');
        }
        break;
      case 'angry': F.sfx.angry(); floater('😠 Left!', 'bad', seatEl); break;
      case 'burnt': F.sfx.burnt(); floater('Burnt!', 'bad', stEl); break;
      case 'trash': F.sfx.trash(); floater('-' + money(E.BURNT_COST), 'bad', stEl); break;
      case 'nobody': F.sfx.nope(); floater('Nobody wants that yet', 'bad', stEl); stEl?.classList.add('nope'); setTimeout(() => stEl?.classList.remove('nope'), 300); break;
      case 'full': F.sfx.nope(); stEl?.classList.add('nope'); setTimeout(() => stEl?.classList.remove('nope'), 300); break;
      case 'passed': floater('Walked past…', 'bad', $('queue')); break;
      case 'over': F.sfx.bell(); break;
    }
  }
  shift.events.length = 0;
}

// ---------------------------------------------------------------------------------------------------- after a shift
function finish() {
  const done = run;
  const stars = E.starsFor(shift.coins, shift.goal);
  cancelAnimationFrame(done.raf);
  F.musicStop();
  setTimeout(() => F.sfx.stars(stars), 300);
  save.totals.served += shift.served;
  save.totals.shifts++;
  const next = $('resNext'), shareBtn = $('resShare');
  let title = 'Shift over!';
  if (done.mode === 'day') {
    const d = done.dayNumber;
    save.wallet = Math.round((save.wallet + shift.coins) * 100) / 100;
    save.best[d] = Math.max(save.best[d] ?? 0, stars);
    if (stars >= 1 && d === save.day) save.day = d + 1;
    title = stars ? (d === E.DAYS && stars ? 'You finished the story! 🎉' : `Day ${d} done!`) : 'Not enough this time…';
    next.hidden = stars < 1;
    next.textContent = `Day ${d + 1} ▶`;
    shareBtn.hidden = true;
  } else {
    const today = E.daily();
    if (save.daily.key !== today.key || shift.coins > (save.daily.best ?? 0)) {
      save.daily = { key: today.key, best: shift.coins, stars, number: today.number };
    }
    title = `Daily Rush #${today.number}`;
    next.hidden = true;
    shareBtn.hidden = false;
  }
  persist();
  $('resTitle').textContent = title;
  $('resStars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  $('resMoney').textContent = `Earned ${money(shift.coins)}` + (done.mode === 'day' ? ` · wallet ${money(save.wallet)}` : '');
  const rows = [
    ['😋 Served', shift.served],
    ['😠 Left angry', shift.lost],
    ['🚶 Walked past', shift.passed],
    ['💰 Tips and combos', money(shift.tips)],
    ['🔥 Best combo', shift.bestCombo],
    ['💨 Burnt', shift.burnt],
  ];
  if (stars < 3) rows.push(['Next star at', money(shift.goal[stars])]);
  $('resList').innerHTML = rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
  $('results').hidden = false;
  run.lastShift = shift;
}

async function shareDaily() {
  const d = save.daily;
  const text = `Hawker Rush daily #${d.number} 🍜\n${'⭐'.repeat(d.stars)}${'☆'.repeat(3 - d.stars)} ${money(d.best)} earned\n` +
    location.href.split('#')[0];
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      $('resShare').textContent = 'Copied! Paste it to your friends';
    }
  } catch {
    // (share sheet closed)
  }
}

// ---------------------------------------------------------------------------------------------------- shop
function shop() {
  stopShift();
  $('results').hidden = true;
  show('shop');
  $('hudTitle').textContent = 'Shop';
  $('hudSub').textContent = '';
  $('shopWallet').textContent = money(save.wallet);
  const list = $('shopList');
  list.replaceChildren();
  for (const [id, u] of Object.entries(E.UPGRADES)) {
    const lv = save.upgrades[id] ?? 0;
    const cost = E.upgradeCost(id, lv);
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `<span class="em">${u.emoji}</span><span class="what"><b>${u.name}</b><small>${u.what}</small>` +
      `<span class="lv">Level ${lv} of ${u.costs.length}</span></span>`;
    const b = document.createElement('button');
    b.type = 'button';
    if (cost === null) {
      b.textContent = 'Max';
      b.className = 'owned';
      b.disabled = true;
    } else {
      b.textContent = money(cost);
      b.disabled = save.wallet < cost;
      b.addEventListener('click', () => {
        if (save.wallet < cost) return;
        save.wallet = Math.round((save.wallet - cost) * 100) / 100;
        save.upgrades[id] = lv + 1;
        persist();
        F.sfx.buy();
        shop();
      });
    }
    row.append(b);
    list.append(row);
  }
  const decor = $('decorList');
  decor.replaceChildren();
  for (const [id, d] of Object.entries(E.DECOR)) {
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `<span class="em">${d.emoji}</span><span class="what"><b>${d.name}</b><small>Shown on your stall</small></span>`;
    const b = document.createElement('button');
    b.type = 'button';
    if (save.decor[id]) {
      b.textContent = 'Owned';
      b.className = 'owned';
      b.disabled = true;
    } else {
      b.textContent = money(d.cost);
      b.disabled = save.wallet < d.cost;
      b.addEventListener('click', () => {
        if (save.wallet < d.cost) return;
        save.wallet = Math.round((save.wallet - d.cost) * 100) / 100;
        save.decor[id] = true;
        persist();
        F.sfx.buy();
        shop();
      });
    }
    row.append(b);
    decor.append(row);
  }
}

// ---------------------------------------------------------------------------------------------------- pause
function setPaused(p) {
  if (!run || !shift || shift.phase !== 'running') return;
  run.paused = p;
  $('paused').hidden = !p;
  F.musicPause(p);
  run.last = 0;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true); // (switched apps: wait for the player)
});

// ---------------------------------------------------------------------------------------------------- buttons
$('play').addEventListener('click', () => intro('day', save.day));
$('openDaily').addEventListener('click', () => intro('daily'));
$('openShop').addEventListener('click', shop);
$('startShift').addEventListener('click', startShift);
$('introBack').addEventListener('click', home);
$('resNext').addEventListener('click', () => {
  $('results').hidden = true;
  intro('day', save.day);
});
$('resRetry').addEventListener('click', () => {
  $('results').hidden = true;
  if (run?.mode === 'daily') intro('daily');
  else intro('day', run?.dayNumber ?? save.day);
});
$('resShop').addEventListener('click', shop);
$('resHome').addEventListener('click', () => {
  $('results').hidden = true;
  home();
});
$('resShare').addEventListener('click', shareDaily);
$('shopBack').addEventListener('click', home);
$('pause').addEventListener('click', () => setPaused(true));
$('resume').addEventListener('click', () => setPaused(false));
$('quit').addEventListener('click', () => {
  $('paused').hidden = true;
  F.musicStop();
  home();
});
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, () => {
    F.unlock();
    // (the calm home music starts after the first tap)
    if (!run && !F.musicPlaying()) setTimeout(() => !run && F.musicStart(true), 50);
  }, { capture: true, passive: true });
}
const soundBtn = $('sound');
function showSound() {
  const off = F.isMuted();
  soundBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
    (off ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
      : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>') +
    '</svg>';
  soundBtn.setAttribute('aria-label', off ? 'Sound off' : 'Sound on');
}
soundBtn.addEventListener('click', () => {
  F.unlock();
  F.setMuted(!F.isMuted());
  showSound();
});
showSound();
home();
