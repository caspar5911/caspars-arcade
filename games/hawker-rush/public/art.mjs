// Drawings for Hawker Rush, all as inline SVG (made here in code; no image files). One soft, rounded style:
// customers, cups and plates (drawn from what's in them, so a half-made dish looks half made), the jars and
// stations of the kitchen, and the stall.

const svg = (w, h, body, cls = '') => `<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${body}</svg>`;

// ---------------------------------------------------------------------------------------------------- food
const LIQUID = { kopi: '#4a2614', teh: '#b65a1c' };
const MILKY = { kopi: '#8a5634', teh: '#d68a4c' };

/** A cup (in the side view) from what's in it: kopi or teh, condensed milk, ice. */
export function cup(has = [], size = 60) {
  const drink = has.includes('kopi') ? 'kopi' : has.includes('teh') ? 'teh' : null;
  const milk = has.includes('milk');
  const ice = has.includes('ice');
  let fill = '';
  if (drink) fill = milk ? MILKY[drink] : LIQUID[drink];
  else if (milk) fill = '#f4ead3';
  const level = drink ? 20 : milk ? 46 : 60; // (milk alone: a little at the bottom)
  const liquid = fill
    ? `<path d="M13 ${level} L47 ${level} L44 52 Q30 56 16 52 Z" fill="${fill}"/>` +
      (milk && drink ? `<path d="M16 50 Q30 54 44 50 L44 52 Q30 56 16 52 Z" fill="#f4ead3" opacity=".7"/>` : '')
    : '';
  const cubes = ice
    ? `<rect x="17" y="${level - 3}" width="9" height="9" rx="2" fill="#dff6ff" stroke="#9fd8ef" transform="rotate(-12 21 ${level})"/>` +
      `<rect x="31" y="${level - 1}" width="9" height="9" rx="2" fill="#dff6ff" stroke="#9fd8ef" transform="rotate(10 35 ${level})"/>`
    : '';
  const steam = drink && !ice
    ? '<g class="steam" stroke="#ffffffaa" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M22 14 q-4 -5 0 -10"/><path d="M33 14 q-4 -5 0 -10"/></g>'
    : '';
  return svg(60, 60,
    steam +
    `<path d="M10 16 L50 16 L46 54 Q30 59 14 54 Z" fill="#ffffff22" stroke="#f4f1ea" stroke-width="2.5"/>` +
    liquid + cubes +
    `<path d="M48 24 q12 2 9 14 q-2 9 -11 9" fill="none" stroke="#f4f1ea" stroke-width="3"/>`, 'food');
}

/** A plate from what's on it (toast, kaya, butter, rice, chicken, cucumber, chilli, satay, peanut sauce). */
export function plate(has = []) {
  const on = i => has.includes(i);
  let food = '';
  if (on('rice')) food += '<ellipse cx="25" cy="34" rx="15" ry="9" fill="#fbfaf3" stroke="#e6e1d2"/><path d="M14 33 q11 -9 22 0" fill="#ffffff"/>';
  if (on('chicken')) food += '<g><path d="M33 27 l15 3 l-2 7 l-15 -3 Z" fill="#f2d3a5" stroke="#b97c3f"/><path d="M31 33 l15 3 l-2 6 l-15 -3 Z" fill="#f6dcb1" stroke="#b97c3f"/></g>';
  if (on('cucumber')) food += '<circle cx="14" cy="41" r="4.5" fill="#cde9a8" stroke="#3d8b3d" stroke-width="1.6"/><circle cx="21" cy="44" r="4.5" fill="#cde9a8" stroke="#3d8b3d" stroke-width="1.6"/>';
  if (on('chilli')) food += '<ellipse cx="46" cy="44" rx="6" ry="3.5" fill="#fff" stroke="#ccc"/><ellipse cx="46" cy="43.5" rx="4.5" ry="2.5" fill="#e0321f"/>';
  if (on('toast')) {
    food += '<path d="M12 40 L30 22 L36 40 Z" fill="#e2a24f" stroke="#a0621f" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M28 40 L44 22 L50 40 Z" fill="#e8ad5b" stroke="#a0621f" stroke-width="2" stroke-linejoin="round"/>';
    if (on('kaya')) food += '<path d="M17 37 L29 26 L32 37 Z" fill="#8fb23c" opacity=".95"/><path d="M33 37 L43 26 L46 37 Z" fill="#8fb23c" opacity=".95"/>';
    if (on('butter')) food += '<rect x="25" y="30" width="10" height="7" rx="1.5" fill="#fff3a6" stroke="#d9b94a"/>';
  } else if (on('kaya') || on('butter')) {
    if (on('kaya')) food += '<ellipse cx="24" cy="38" rx="7" ry="4" fill="#8fb23c"/>';
    if (on('butter')) food += '<rect x="32" y="33" width="10" height="7" rx="1.5" fill="#fff3a6" stroke="#d9b94a"/>';
  }
  if (on('satay')) {
    for (let k = 0; k < 3; k++) {
      const y = 28 + k * 5;
      food += `<line x1="10" y1="${y + 6}" x2="46" y2="${y - 4}" stroke="#d8b98a" stroke-width="1.6"/>` +
        [0, 1, 2].map(j => `<circle cx="${18 + j * 7}" cy="${y + 3.6 - j * 2}" r="3.6" fill="#8a4a1e" stroke="#5a2c0e"/>`).join('');
    }
  }
  if (on('peanut')) food += '<ellipse cx="46" cy="42" rx="7" ry="4" fill="#fff" stroke="#ccc"/><ellipse cx="46" cy="41.5" rx="5.5" ry="3" fill="#b5772e"/>';
  return svg(60, 60, '<ellipse cx="30" cy="40" rx="27" ry="13" fill="#f7f4ec" stroke="#d6cfbd" stroke-width="2"/>' +
    '<ellipse cx="30" cy="39" rx="19" ry="8" fill="none" stroke="#e6e0d0" stroke-width="1.5"/>' + food, 'food');
}

/** A bowl: soft-boiled eggs, soy sauce. */
export function bowl(has = []) {
  let food = '';
  if (has.includes('eggs')) {
    food += '<ellipse cx="23" cy="30" rx="9" ry="6" fill="#fffdf4"/><circle cx="23" cy="30" r="3.6" fill="#f6b21b"/>' +
      '<ellipse cx="37" cy="31" rx="9" ry="6" fill="#fffdf4"/><circle cx="37" cy="31" r="3.6" fill="#f6b21b"/>';
  }
  if (has.includes('soy')) food += '<path d="M15 33 q15 6 30 0 q-15 4 -30 0" fill="#3a2414" opacity=".85"/>';
  // (the bowl first, then what's in it, sitting on top)
  return svg(60, 60,
    '<path d="M6 30 Q30 30 54 30 Q52 52 30 54 Q8 52 6 30 Z" fill="#eaf3fb" stroke="#7fa8cc" stroke-width="2"/>' +
    '<path d="M10 38 Q30 42 50 38" fill="none" stroke="#7fa8cc" stroke-width="2"/>' +
    food.replaceAll('cy="30"', 'cy="25"').replaceAll('cy="31"', 'cy="26"').replace('M15 33 q15 6 30 0 q-15 4 -30 0', 'M15 28 q15 6 30 0 q-15 4 -30 0'), 'food');
}

/** A dish (on a counter, or in an order bubble) from its base and contents. */
export function dish(base, has, { face = false, cooked = false } = {}) {
  const art = base === 'cup' ? cup(has) : base === 'bowl' ? bowl(has) : base === 'pastry' ? pastry(has, cooked)
    : base === 'dough' ? dough(has, cooked) : plate(has);
  return face ? art.replace('</svg>', (FACE[base] ?? FACE.plate) + '</svg>') : art;
}

const PLATE = '<ellipse cx="30" cy="42" rx="27" ry="12" fill="#f7f4ec" stroke="#d6cfbd" stroke-width="2"/>';

/** A curry puff: a pastry sheet with its filling, or (cooked) a golden crimped half-moon on a plate. */
export function pastry(has = [], cooked = false, colour = null) {
  if (cooked || colour) {
    const c = colour ?? '#e2a04a';
    return svg(60, 60, (colour ? '' : PLATE) +
      `<path d="M8 40 Q30 6 52 40 Z" fill="${c}" stroke="#9a5a1c" stroke-width="2" stroke-linejoin="round"/>` +
      Array.from({ length: 7 }, (_, i) => `<path d="M${12 + i * 6} ${40 - Math.sin((i + .5) / 7 * Math.PI) * 4} q3 -4 6 0" fill="none" stroke="#9a5a1c" stroke-width="1.6"/>`).join('') +
      '<path d="M18 30 q6 -10 14 -12" stroke="#fff3c0" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>', 'food');
  }
  let fill = '';
  if (has.includes('curry')) fill += '<ellipse cx="30" cy="34" rx="13" ry="7" fill="#e8a11c"/>';
  if (has.includes('potato')) fill += '<rect x="21" y="29" width="7" height="7" rx="2" fill="#f2d27a" stroke="#c9a23a"/><rect x="31" y="31" width="7" height="7" rx="2" fill="#f2d27a" stroke="#c9a23a"/>';
  return svg(60, 60, '<ellipse cx="30" cy="35" rx="25" ry="15" fill="#f6e6c0" stroke="#d6b77a" stroke-width="2"/>' +
    '<g fill="#fffaf0" opacity=".8"><circle cx="14" cy="32" r="1.2"/><circle cx="46" cy="38" r="1.2"/><circle cx="40" cy="27" r="1"/></g>' + fill, 'food');
}

/** Roti prata (with an egg: roti telur): raw dough, or (cooked) golden and flaky on a plate. */
export function dough(has = [], cooked = false, colour = null) {
  const egg = has.includes('egg');
  if (cooked || colour) {
    const c = colour ?? '#e9b45e';
    return svg(60, 60, (colour ? '' : PLATE) +
      (egg ? `<rect x="12" y="22" width="36" height="22" rx="5" fill="${c}" stroke="#a8682a" stroke-width="2"/><path d="M14 33 h32" stroke="#f6c84a" stroke-width="3"/>`
        : `<ellipse cx="30" cy="35" rx="22" ry="10" fill="${c}" stroke="#a8682a" stroke-width="2"/><path d="M14 33 q16 -8 32 0 M18 38 q12 -5 24 0" fill="none" stroke="#a8682a" stroke-width="1.4" opacity=".7"/>`) +
      '<g fill="#a8682a" opacity=".55"><circle cx="22" cy="32" r="1.6"/><circle cx="35" cy="36" r="1.8"/><circle cx="41" cy="31" r="1.3"/></g>', 'food');
  }
  return svg(60, 60, '<ellipse cx="30" cy="38" rx="20" ry="11" fill="#fbf2dc" stroke="#d9c39a" stroke-width="2"/>' +
    '<ellipse cx="24" cy="34" rx="6" ry="3" fill="#ffffff" opacity=".7"/>' +
    (egg ? '<ellipse cx="32" cy="38" rx="9" ry="5" fill="#fff" stroke="#eee"/><circle cx="32" cy="38" r="3.6" fill="#f6b21b"/>' : ''), 'food');
}

// a finished dish smiles (so you can see at a glance it's done)
const smile = (x, y, ink = '#2b1a10') => `<g class="dish-face"><circle cx="${x - 6}" cy="${y}" r="2.9" fill="#fff"/><circle cx="${x + 6}" cy="${y}" r="2.9" fill="#fff"/>` +
  `<circle cx="${x - 6}" cy="${y + .4}" r="1.8" fill="#2b1a10"/><circle cx="${x + 6}" cy="${y + .4}" r="1.8" fill="#2b1a10"/>` +
  `<path d="M${x - 3} ${y + 4} q3 3 6 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>` +
  `<ellipse cx="${x - 11}" cy="${y + 4}" rx="2.8" ry="1.6" fill="#ff7a8a" opacity=".75"/><ellipse cx="${x + 11}" cy="${y + 4}" rx="2.8" ry="1.6" fill="#ff7a8a" opacity=".75"/></g>`;
const FACE = { cup: smile(30, 42, '#fff4e0'), plate: smile(30, 50), bowl: smile(30, 45) };

// ---------------------------------------------------------------------------------------------------- the kitchen's jars and things
const ICONS = {
  cup: () => svg(60, 60, '<path d="M14 22 L46 22 L43 50 Q30 54 17 50 Z" fill="#ffffff22" stroke="#f4f1ea" stroke-width="2.5"/><path d="M17 16 L43 16" stroke="#f4f1ea" stroke-width="3"/><path d="M19 10 L41 10" stroke="#f4f1ea" stroke-width="3"/><path d="M44 28 q10 2 7 12 q-2 6 -9 7" fill="none" stroke="#f4f1ea" stroke-width="2.5"/>'),
  plate: () => svg(60, 60, '<ellipse cx="30" cy="42" rx="25" ry="9" fill="#f7f4ec" stroke="#d6cfbd" stroke-width="2"/><ellipse cx="30" cy="34" rx="25" ry="9" fill="#f7f4ec" stroke="#d6cfbd" stroke-width="2"/><ellipse cx="30" cy="26" rx="25" ry="9" fill="#f7f4ec" stroke="#d6cfbd" stroke-width="2"/>'),
  bowl: () => svg(60, 60, '<path d="M6 26 Q30 26 54 26 Q52 46 30 48 Q8 46 6 26 Z" fill="#eaf3fb" stroke="#7fa8cc" stroke-width="2"/><path d="M8 18 Q30 18 52 18 Q50 36 30 38 Q10 36 8 18 Z" fill="#eaf3fb" stroke="#7fa8cc" stroke-width="2"/>'),
  kopi: () => pot('#4a2614', 'K'),
  teh: () => pot('#b65a1c', 'T'),
  milk: () => svg(60, 60, '<rect x="16" y="14" width="28" height="36" rx="4" fill="#d8dde3" stroke="#8a939c" stroke-width="2"/><rect x="16" y="22" width="28" height="18" fill="#c8102e"/><text x="30" y="35" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="system-ui">MILK</text><ellipse cx="30" cy="14" rx="14" ry="3" fill="#eef1f4" stroke="#8a939c" stroke-width="2"/>'),
  ice: () => svg(60, 60, '<path d="M10 24 L50 24 L46 52 L14 52 Z" fill="#3f8fd2" stroke="#1f5f99" stroke-width="2"/><rect x="16" y="14" width="11" height="11" rx="2" fill="#dff6ff" stroke="#9fd8ef" transform="rotate(-10 21 19)"/><rect x="28" y="12" width="11" height="11" rx="2" fill="#dff6ff" stroke="#9fd8ef" transform="rotate(12 33 17)"/><rect x="36" y="18" width="9" height="9" rx="2" fill="#dff6ff" stroke="#9fd8ef"/>'),
  kaya: () => jar('#8fb23c', 'KAYA'),
  butter: () => svg(60, 60, '<path d="M8 36 L30 26 L52 36 L30 46 Z" fill="#fff3a6" stroke="#d9b94a" stroke-width="2"/><path d="M8 36 L8 42 L30 52 L30 46 Z" fill="#f2df7a" stroke="#d9b94a" stroke-width="2"/><path d="M52 36 L52 42 L30 52 L30 46 Z" fill="#e8d067" stroke="#d9b94a" stroke-width="2"/>'),
  soy: () => svg(60, 60, '<path d="M24 10 L36 10 L36 18 Q46 22 46 32 L46 52 L14 52 L14 32 Q14 22 24 18 Z" fill="#2d1a0e" stroke="#120a05" stroke-width="2"/><rect x="18" y="32" width="24" height="12" rx="2" fill="#e9e2cf"/><text x="30" y="41" text-anchor="middle" font-size="7.5" font-weight="900" fill="#2d1a0e" font-family="system-ui">SOY</text>'),
  rice: () => svg(60, 60, '<rect x="10" y="22" width="40" height="28" rx="10" fill="#f2f2f2" stroke="#b7b7b7" stroke-width="2"/><path d="M12 24 Q30 12 48 24" fill="#fbfaf3" stroke="#e0dccd"/><rect x="25" y="34" width="10" height="6" rx="2" fill="#5fd38a"/>'),
  chicken: () => svg(60, 60, '<ellipse cx="30" cy="36" rx="20" ry="13" fill="#f2d3a5" stroke="#b97c3f" stroke-width="2"/><path d="M14 34 q16 -6 32 0" fill="none" stroke="#e0b47a" stroke-width="2"/><path d="M46 28 l7 -6 l3 4 l-6 6" fill="#f2d3a5" stroke="#b97c3f" stroke-width="2"/>'),
  cucumber: () => svg(60, 60, '<rect x="8" y="22" width="44" height="16" rx="8" fill="#3d8b3d" stroke="#2a632a" stroke-width="2" transform="rotate(-12 30 30)"/><circle cx="40" cy="44" r="8" fill="#cde9a8" stroke="#3d8b3d" stroke-width="2.5"/>'),
  chilli: () => svg(60, 60, '<path d="M14 22 Q34 18 46 34 Q50 44 42 46 Q38 34 16 30 Z" fill="#e0321f" stroke="#9a1d10" stroke-width="2"/><path d="M14 22 l-4 -6" stroke="#3d8b3d" stroke-width="3" stroke-linecap="round"/>'),
  pastry: () => svg(60, 60, '<ellipse cx="30" cy="36" rx="24" ry="14" fill="#f6e6c0" stroke="#d6b77a" stroke-width="2"/><ellipse cx="30" cy="31" rx="24" ry="14" fill="#f9ecd0" stroke="#d6b77a" stroke-width="2"/><g fill="#fffaf0"><circle cx="20" cy="28" r="1.4"/><circle cx="38" cy="33" r="1.4"/></g>'),
  dough: () => svg(60, 60, '<ellipse cx="30" cy="38" rx="20" ry="15" fill="#fbf2dc" stroke="#d9c39a" stroke-width="2"/><ellipse cx="23" cy="32" rx="6" ry="4" fill="#fff" opacity=".8"/>'),
  potato: () => svg(60, 60, '<ellipse cx="30" cy="34" rx="20" ry="14" fill="#c89a5a" stroke="#8a6330" stroke-width="2" transform="rotate(-12 30 34)"/><g fill="#8a6330"><circle cx="22" cy="30" r="1.6"/><circle cx="34" cy="38" r="1.6"/><circle cx="38" cy="28" r="1.4"/></g>'),
  curry: () => svg(60, 60, '<path d="M8 30 Q30 30 52 30 Q50 48 30 50 Q10 48 8 30 Z" fill="#f7f4ec" stroke="#d6cfbd" stroke-width="2"/><ellipse cx="30" cy="31" rx="20" ry="5" fill="#e8a11c"/><circle cx="24" cy="30" r="2" fill="#c0392b" opacity=".6"/>'),
  egg: () => svg(60, 60, '<ellipse cx="30" cy="34" rx="14" ry="18" fill="#fffaf0" stroke="#d9cfb8" stroke-width="2"/><ellipse cx="25" cy="27" rx="4" ry="6" fill="#fff" opacity=".9"/>'),
  peanut: () => svg(60, 60, '<path d="M8 30 Q30 30 52 30 Q50 48 30 50 Q10 48 8 30 Z" fill="#f7f4ec" stroke="#d6cfbd" stroke-width="2"/><ellipse cx="30" cy="31" rx="20" ry="5" fill="#b5772e"/>'),
};
function pot(color, letter) {
  return svg(60, 60, '<path d="M16 18 L44 18 L46 50 Q30 55 14 50 Z" fill="#c9ced4" stroke="#7d858d" stroke-width="2"/>' +
    '<path d="M14 26 L4 20" stroke="#7d858d" stroke-width="4" stroke-linecap="round"/>' +
    `<rect x="20" y="28" width="20" height="14" rx="3" fill="${color}"/>` +
    `<text x="30" y="39" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="system-ui">${letter}</text>` +
    '<path d="M44 24 q8 2 6 12 q-1 5 -6 6" fill="none" stroke="#7d858d" stroke-width="3"/>');
}
function jar(color, label) {
  return svg(60, 60, `<rect x="14" y="18" width="32" height="34" rx="6" fill="${color}" stroke="#4f6a1c" stroke-width="2"/>` +
    '<rect x="12" y="12" width="36" height="8" rx="3" fill="#d23a2a"/>' +
    `<rect x="17" y="28" width="26" height="11" rx="2" fill="#fff8e1"/><text x="30" y="36.5" text-anchor="middle" font-size="7.5" font-weight="900" fill="#4f6a1c" font-family="system-ui">${label}</text>`);
}
export function icon(id) {
  return (ICONS[id] ?? ICONS.cup)();
}


// ---------------------------------------------------------------------------------------------------- the kitchen's machines
// Each has a little face: calm while cooking, sparkly when the food is ready, sweating when it's about to burn,
// dizzy when it has burnt something.

function machineFace(slots, x, y) {
  const st = slots.filter(Boolean);
  const burnt = st.some(s => s.state === 'burnt');
  const danger = st.some(s => s.state === 'ready' && s.p > .55);
  const ready = st.some(s => s.state === 'ready');
  const cooking = st.some(s => s.state === 'cooking');
  let eyes, mouth, extra = '';
  if (burnt) {
    eyes = `<path d="M${x - 9} ${y - 3} l5 5 m0 -5 l-5 5 M${x + 4} ${y - 3} l5 5 m0 -5 l-5 5" stroke="#2b1a10" stroke-width="2" stroke-linecap="round"/>`;
    mouth = `<path d="M${x - 4} ${y + 6} q2 -2 4 0 q2 2 4 0" fill="none" stroke="#2b1a10" stroke-width="1.8" stroke-linecap="round"/>`;
  } else if (danger) {
    eyes = `<circle cx="${x - 6}" cy="${y}" r="3.2" fill="#fff" stroke="#2b1a10" stroke-width="1.2"/><circle cx="${x + 6}" cy="${y}" r="3.2" fill="#fff" stroke="#2b1a10" stroke-width="1.2"/><circle cx="${x - 6}" cy="${y}" r="1.4" fill="#2b1a10"/><circle cx="${x + 6}" cy="${y}" r="1.4" fill="#2b1a10"/>`;
    mouth = `<ellipse cx="${x}" cy="${y + 7}" rx="2.6" ry="3" fill="#2b1a10"/>`;
    extra = `<path class="sweat" d="M${x + 13} ${y - 8} q3 5 0 7 q-3 -2 0 -7 Z" fill="#7fd0ff" stroke="#3a8fc4" stroke-width=".8"/>`;
  } else if (ready) {
    eyes = `<path d="M${x - 9} ${y + 1} q3 -5 6 0 M${x + 3} ${y + 1} q3 -5 6 0" stroke="#2b1a10" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    mouth = `<path d="M${x - 4} ${y + 5} q4 5 8 0 Z" fill="#c0392b" stroke="#2b1a10" stroke-width="1.4"/>`;
    extra = `<g class="twinkle" fill="#fff6a0"><path d="M${x - 16} ${y - 9} l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 Z"/><path d="M${x + 16} ${y - 11} l1.2 2.8 l2.8 1.2 l-2.8 1.2 l-1.2 2.8 l-1.2 -2.8 l-2.8 -1.2 l2.8 -1.2 Z"/></g>`;
  } else {
    eyes = `<g class="blink" style="transform-origin:${x}px ${y}px"><circle cx="${x - 6}" cy="${y}" r="2" fill="#2b1a10"/><circle cx="${x + 6}" cy="${y}" r="2" fill="#2b1a10"/></g>`;
    mouth = cooking
      ? `<path d="M${x - 3} ${y + 5} q3 2 6 0" fill="none" stroke="#2b1a10" stroke-width="1.6" stroke-linecap="round"/>`
      : `<path d="M${x - 3} ${y + 5} h6" stroke="#2b1a10" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  return `<g class="machine-face">${eyes}${mouth}<ellipse cx="${x - 11}" cy="${y + 4}" rx="2.6" ry="1.5" fill="#ff8a8a" opacity=".6"/><ellipse cx="${x + 11}" cy="${y + 4}" rx="2.6" ry="1.5" fill="#ff8a8a" opacity=".6"/>${extra}</g>`;
}

function smoke(slots, w) {
  return slots.some(s => s && s.state === 'burnt')
    ? `<g class="smoke" fill="#6b6b6b99"><circle cx="${w * .3}" cy="9" r="6"/><circle cx="${w * .5}" cy="5" r="7"/><circle cx="${w * .7}" cy="10" r="5"/></g>`
    : '';
}

function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('');
}

// fire under the stove line: glowing coals and flickering flames
let flameBoost = 1; // (Faster stoves: taller, hotter flames)
function flames(x0, x1, y, lit = true, n = 5) {
  if (!lit) return `<rect x="${x0}" y="${y - 3}" width="${x1 - x0}" height="6" rx="3" fill="#5a3a2a"/>`;
  const w = (x1 - x0) / n, f = flameBoost;
  const blue = f > 1.4 ? `<g fill="#7fd0ff" opacity=".85">${Array.from({ length: n }, (_, k) => `<path d="M${x0 + k * w + w * .38} ${y} q${w * .12} -${4 * f} ${w * .24} 0 Z"/>`).join('')}</g>` : '';
  return `<rect x="${x0}" y="${y - 2}" width="${x1 - x0}" height="7" rx="3.5" fill="#ff6a2a" opacity=".85"/>` +
    `<g class="flicker">${Array.from({ length: n }, (_, k) => `<path d="M${x0 + k * w + w * .15} ${y} q${w * .35} -${(12 + (k % 2) * 5) * f} ${w * .7} 0 Z" fill="#ff8a2a"/><path d="M${x0 + k * w + w * .3} ${y} q${w * .2} -${(7 + (k % 2) * 3) * f} ${w * .4} 0 Z" fill="#ffd23f"/>`).join('')}${blue}</g>`;
}
function coals(x0, x1, y) {
  return `<g>${Array.from({ length: Math.floor((x1 - x0) / 9) }, (_, k) => `<circle cx="${x0 + 5 + k * 9}" cy="${y + (k % 2) * 2}" r="4.2" fill="${k % 3 ? '#e2401c' : '#ff8a2a'}" class="${k % 3 ? '' : 'glow'}"/>`).join('')}</g>`;
}

/** A cooking station with its slots: null | {state: 'cooking'|'flip'|'ready'|'burnt', p, has}. Drawn big and lively. */
export function station(id, slots, { fast = 0 } = {}) {
  flameBoost = 1 + .22 * fast;
  const busy = slots.some(Boolean);
  const W = 110;
  if (id === 'toaster' || id === 'grill') {
    // a charcoal brazier: food on the grate, coals and flames below
    const food = slots.map((s, k) => {
      if (!s) return '';
      const x = 14 + k * (82 / slots.length);
      if (id === 'toaster') {
        const c = s.state === 'burnt' ? '#2a1c14' : s.state === 'ready' ? '#d88f35' : mix('#f6e3b8', '#d99a45', s.p);
        return `<g class="${s.state === 'ready' ? 'pop-up' : ''}"><rect x="${x}" y="12" width="${82 / slots.length - 8}" height="24" rx="7" fill="${c}" stroke="#8a5a26" stroke-width="1.6"/>` +
          (s.p > .4 || s.state !== 'cooking' ? `<path d="M${x + 4} 20 h${82 / slots.length - 16} M${x + 4} 27 h${82 / slots.length - 16}" stroke="#7a4a1a" stroke-width="2" opacity=".6"/>` : '') + '</g>';
      }
      const meat = s.state === 'burnt' ? '#1d120b' : s.state === 'ready' ? '#9a5222' : mix('#f0a090', '#9a5222', s.p);
      const n = slots.length, gap = n > 2 ? 24 / (n - 1) : 12, size = n > 2 ? 9 : 12;
      const y = (n > 2 ? 9 : 15) + k * gap;
      return `<line x1="6" y1="${y}" x2="${W - 6}" y2="${y}" stroke="#e0c08a" stroke-width="2.4" stroke-linecap="round"/>` +
        [0, 1, 2, 3, 4].map(j => `<rect x="${18 + j * 15}" y="${y - size / 2}" width="${size}" height="${size}" rx="${size * .4}" fill="${meat}" stroke="#5a2c0e" stroke-width="1"/>`).join('');
    }).join('');
    return svg(W, 80, food +
      '<path d="M6 36 h98" stroke="#555" stroke-width="2.4"/>' +
      Array.from({ length: 9 }, (_, k) => `<path d="M${12 + k * 11} 34 v6" stroke="#555" stroke-width="2"/>`).join('') +
      `<path d="M4 40 L106 40 L98 74 Q55 80 12 74 Z" fill="#3c3c44" stroke="#22222a" stroke-width="2.4"/>` +
      coals(14, 96, 46) + flames(12, 98, 46, busy, 7) +
      machineFace(slots, 55, 62) + smoke(slots, W), 'station-art');
  }
  if (id === 'pot') {
    const eggs = slots.map((s, k) => {
      if (!s) return '';
      const step = slots.length > 2 ? 54 / (slots.length - 1) : 20;
      const x = 55 + (k - (slots.length - 1) / 2) * step;
      const c = s.state === 'burnt' ? '#8a7f70' : s.state === 'ready' ? '#fffdf4' : '#f6eedb';
      return `<ellipse cx="${x}" cy="26" rx="${slots.length > 2 ? 7 : 8}" ry="${slots.length > 2 ? 9 : 10}" fill="${c}" stroke="#c9b88f" stroke-width="1.5" class="${s.state === 'cooking' ? 'bob' : ''}"/>`;
    }).join('');
    const boiling = slots.some(s => s && s.state === 'cooking');
    return svg(W, 80, eggs +
      '<path d="M20 30 L90 30 L86 62 Q55 70 24 62 Z" fill="#9fd8e8" stroke="#4f97ad" stroke-width="2.5"/>' +
      '<rect x="16" y="26" width="78" height="8" rx="4" fill="#bfe6f1" stroke="#4f97ad" stroke-width="2"/>' +
      '<path d="M8 34 h10 M92 34 h10" stroke="#4f97ad" stroke-width="5" stroke-linecap="round"/>' +
      (boiling ? '<g class="steam" stroke="#ffffffcc" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M38 18 q-4 -6 0 -12"/><path d="M70 18 q-4 -6 0 -12"/></g>' : '') +
      '<rect x="22" y="70" width="66" height="6" rx="3" fill="#555"/>' + flames(26, 84, 70, busy, 6) +
      machineFace(slots, 55, 48) + smoke(slots, W), 'station-art');
  }
  if (id === 'wok') {
    // a big wok of hot oil: curry puffs go in pale and come out golden
    const puffs = slots.map((s, k) => {
      if (!s) return '';
      const c = s.state === 'burnt' ? '#2a1a10' : s.state === 'ready' ? '#d98a2a' : mix('#f6e6c0', '#d98a2a', s.p);
      const x = 22 + k * (66 / slots.length);
      return `<g transform="translate(${x} 14) scale(.62)" class="${s.state === 'cooking' ? 'bob' : ''}">${pastry([], false, c).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
    }).join('');
    const frying = slots.some(s => s && s.state === 'cooking');
    return svg(W, 80,
      '<path d="M6 30 Q55 76 104 30 Z" fill="#2c2c30" stroke="#151518" stroke-width="2.4"/>' +
      '<path d="M12 32 Q55 66 98 32 Z" fill="#e8a34a" opacity=".85"/>' +
      (frying ? '<g class="sizzle" fill="#fff3c0">' + [24, 40, 56, 72, 86].map((x, k) => `<circle cx="${x}" cy="${38 + (k % 2) * 4}" r="${1.6 + (k % 3) * .6}"/>`).join('') + '</g>' : '') +
      puffs +
      '<path d="M104 30 q6 -2 6 -8" stroke="#151518" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      flames(24, 86, 74, busy, 6) +
      machineFace(slots, 55, 56) + smoke(slots, W), 'station-art');
  }
  // the prata griddle: a flat iron plate over the fire; pratas flip halfway
  const pratas = slots.map((s, k) => {
    if (!s) return '';
    const x = 8 + k * (94 / slots.length);
    const c = s.state === 'burnt' ? '#2a1a10' : s.state === 'flip' ? '#f3d9a0' : s.state === 'ready' ? '#e9b45e' : mix('#fbf2dc', '#e9b45e', s.p);
    const flipMe = s.state === 'flip' ? `<g class="flip-me"><circle cx="${x + 22}" cy="10" r="9" fill="#ffd23f" stroke="#c99400"/><path d="M${x + 17} 12 q5 -8 10 0 l-3 -1 M${x + 27} 12 l1 -3" stroke="#6a4200" stroke-width="2" fill="none" stroke-linecap="round"/></g>` : '';
    return `<g transform="translate(${x} 10) scale(.75)">${dough(s.has ?? [], false, c).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>` + flipMe;
  }).join('');
  return svg(W, 80, pratas +
    '<rect x="4" y="44" width="102" height="9" rx="3" fill="#3a3a40" stroke="#1e1e22" stroke-width="2"/>' +
    '<path d="M10 53 L14 74 M100 53 L96 74" stroke="#3a3a40" stroke-width="4"/>' +
    flames(18, 92, 68, busy, 6) +
    machineFace(slots, 55, 64).replace('class="machine-face"', 'class="machine-face" transform="translate(0 -6) scale(1)"') + smoke(slots, W), 'station-art');
}

// ---------------------------------------------------------------------------------------------------- customers
/**
 * A customer as they sit at the counter: their face, plus what makes them special (the food critic's beret and
 * notepad, the friends of a big group behind them, a regular's heart badge).
 */
export function customer(c, mood = 'ok') {
  const face = person(c.who, mood);
  if (c.kind === 'critic') {
    return face.replace(/<\/svg>$/, '<g class="critic-kit"><ellipse cx="40" cy="20" rx="23" ry="7.5" fill="#3a2a4a"/><circle cx="40" cy="13" r="3" fill="#3a2a4a"/>' +
      '<g transform="rotate(-8 64 74)"><rect x="57" y="62" width="15" height="20" rx="2" fill="#fffdf4" stroke="#8a7a6a" stroke-width="1.4"/>' +
      '<path d="M60 68 h9 M60 72 h9 M60 76 h6" stroke="#9a8a7a" stroke-width="1.2"/></g>' +
      '<path d="M50 84 l16 -14" stroke="#e8b04a" stroke-width="3" stroke-linecap="round"/></g></svg>');
  }
  if (c.kind === 'group') {
    const pal = ['#ffb3c6', '#b8e0ff'];
    const friend = (x, k) => `<g opacity=".95"><path d="M${x - 13} 100 Q${x - 13} 76 ${x} 75 Q${x + 13} 76 ${x + 13} 100 Z" fill="${pal[k]}"/>` +
      `<circle cx="${x}" cy="62" r="12" fill="#f2c9a5"/><path d="M${x - 12} 58 Q${x} 44 ${x + 12} 58 Z" fill="#3a2a22"/>` +
      `<circle cx="${x - 4}" cy="63" r="1.6" fill="#2b1a10"/><circle cx="${x + 4}" cy="63" r="1.6" fill="#2b1a10"/></g>`;
    return face.replace(/(<svg[^>]*>)/, `$1${friend(9, 0)}${friend(71, 1)}`);
  }
  if (c.kind === 'regular') {
    return face.replace(/<\/svg>$/, '<g class="heart-up" style="animation-duration:2.4s"><path d="M66 22 c-4 -6 -12 -2 -8 4 l8 7 l8 -7 c4 -6 -4 -10 -8 -4 Z" fill="#ff5a7a" stroke="#fff" stroke-width="1.4"/></g></svg>');
  }
  return face;
}

// Round, big-headed and blinking. Each kind of customer has their own look; moods show on the face.
const LOOKS = {
  uncle: { skin: '#f0c49a', hair: '#e8e8e8', shirt: '#f4f4f4', trim: '#9ad0f5', style: 'bald' },
  auntie: { skin: '#f6cfa8', hair: '#3a2a22', shirt: '#ff8fb8', trim: '#ffd23f', style: 'perm' },
  office: { skin: '#f5d3b4', hair: '#262626', shirt: '#6f9df2', trim: '#e33b4c', style: 'neat' },
  student: { skin: '#efc6a2', hair: '#2e2018', shirt: '#ffffff', trim: '#ff6b5a', style: 'cap' },
  worker: { skin: '#d79c70', hair: '#1a1a1a', shirt: '#ffa53a', trim: '#ffe066', style: 'hardhat' },
  kid: { skin: '#fad9bb', hair: '#5a341d', shirt: '#6fd39a', trim: '#ffe066', style: 'kid' },
  tourist: { skin: '#f8dccb', hair: '#e3b257', shirt: '#4fd0dc', trim: '#ff8fb8', style: 'sunhat' },
};
const BLINK = { uncle: 0, auntie: 1.3, office: 2.2, student: .7, worker: 3.1, kid: 1.8, tourist: 2.7 };

function hairOf(L) {
  const h = L.hair;
  switch (L.style) {
    case 'bald':
      return `<path d="M15 44 q-3 -12 5 -18 M65 44 q3 -12 -5 -18" stroke="${h}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        '<ellipse cx="33" cy="22" rx="8" ry="4" fill="#ffffff66" transform="rotate(-20 33 22)"/>';
    case 'perm':
      return `<g fill="${h}">${[[18, 26], [28, 17], [40, 14], [52, 17], [62, 26], [14, 38], [66, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10"/>`).join('')}</g>`;
    case 'neat':
      return `<path d="M13 42 Q12 14 40 13 Q68 14 67 42 Q62 26 46 24 Q30 30 16 40 Z" fill="${h}"/><path d="M44 16 q10 2 14 10" stroke="#ffffff33" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 'cap':
      return `<path d="M14 40 Q14 18 40 17 Q66 18 66 40 Q50 30 14 40 Z" fill="${h}"/>` +
        `<path d="M13 32 Q14 9 40 9 Q66 9 67 32 Z" fill="#ff5a4a"/><path d="M40 28 L76 31 Q70 37 40 34 Z" fill="#d93a2a"/><circle cx="40" cy="10" r="3" fill="#d93a2a"/>`;
    case 'hardhat':
      return `<path d="M14 40 Q14 22 40 21 Q66 22 66 40 Z" fill="${h}"/>` +
        '<path d="M12 33 Q13 7 40 7 Q67 7 68 33 Z" fill="#ffd23f" stroke="#e0a800" stroke-width="2"/><rect x="8" y="31" width="64" height="6" rx="3" fill="#ffd23f" stroke="#e0a800" stroke-width="1.5"/><rect x="36" y="9" width="8" height="22" rx="3" fill="#ffe680"/>';
    case 'kid':
      return `<path d="M13 42 Q12 15 40 14 Q68 15 67 42 Q60 28 50 30 Q44 22 36 30 Q24 26 13 42 Z" fill="${h}"/>` +
        `<path d="M40 15 q-2 -10 7 -11" stroke="${h}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<circle cx="13" cy="44" r="6" fill="${h}"/><circle cx="67" cy="44" r="6" fill="${h}"/><circle cx="13" cy="44" r="2.4" fill="#ff5a8a"/><circle cx="67" cy="44" r="2.4" fill="#ff5a8a"/>`;
    case 'sunhat':
      return `<path d="M12 60 Q8 20 40 18 Q72 20 68 60 L62 60 Q64 30 40 28 Q16 30 18 60 Z" fill="${h}"/>` +
        '<ellipse cx="40" cy="24" rx="38" ry="8" fill="#fbe6b0" stroke="#d8b45c" stroke-width="2"/><path d="M22 24 Q24 4 40 4 Q56 4 58 24 Z" fill="#fbe6b0" stroke="#d8b45c" stroke-width="2"/><rect x="22" y="18" width="36" height="5" fill="#ff7aa8"/><circle cx="57" cy="18" r="4" fill="#ffd23f"/>';
    default:
      return '';
  }
}

/** A customer (head and shoulders), with a mood: 'happy' | 'ok' | 'cross' | 'angry' | 'eating'. */
export function person(who, mood = 'ok') {
  const L = LOOKS[who] ?? LOOKS.student;
  const s = who === 'kid' ? .86 : 1;
  const hx = 40, hy = 44; // the middle of the face
  let eyes;
  if (mood === 'happy' || mood === 'eating') {
    eyes = `<path d="M${hx - 14} ${hy + 1} q5 -7 10 0 M${hx + 4} ${hy + 1} q5 -7 10 0" stroke="#2b1a10" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else {
    const narrow = mood === 'angry' ? 3.2 : 5.2;
    const eye = x => `<ellipse cx="${x}" cy="${hy}" rx="4.4" ry="${narrow}" fill="#2b1a10"/>` +
      (mood === 'angry' ? '' : `<circle cx="${x - 1.4}" cy="${hy - 2}" r="1.7" fill="#fff"/><circle cx="${x + 1.5}" cy="${hy + 1.6}" r=".8" fill="#fff"/>`);
    eyes = `<g class="blink" style="transform-origin:${hx}px ${hy}px;animation-delay:-${BLINK[who] ?? 0}s">${eye(hx - 9)}${eye(hx + 9)}</g>`;
  }
  const brows = mood === 'cross'
    ? `<path d="M${hx - 15} ${hy - 10} l8 3 M${hx + 15} ${hy - 10} l-8 3" stroke="#2b1a10" stroke-width="2.4" stroke-linecap="round"/>`
    : mood === 'angry'
      ? `<path d="M${hx - 15} ${hy - 11} l10 5 M${hx + 15} ${hy - 11} l-10 5" stroke="#2b1a10" stroke-width="3" stroke-linecap="round"/>`
      : '';
  const mouth = {
    happy: `<path d="M${hx - 6} ${hy + 9} q6 9 12 0 Z" fill="#e0475a" stroke="#2b1a10" stroke-width="2" stroke-linejoin="round"/><path d="M${hx - 3} ${hy + 13} q3 2 6 0" fill="#ff9aa8"/>`,
    eating: `<ellipse cx="${hx}" cy="${hy + 11}" rx="5" ry="4" fill="#e0475a" stroke="#2b1a10" stroke-width="2" class="chew"/>`,
    ok: `<path d="M${hx - 5} ${hy + 9} q2.5 3 5 0 q2.5 3 5 0" fill="none" stroke="#2b1a10" stroke-width="2.2" stroke-linecap="round"/>`,
    cross: `<path d="M${hx - 6} ${hy + 12} q3 -3 6 0 q3 3 6 0" fill="none" stroke="#2b1a10" stroke-width="2.2" stroke-linecap="round"/>`,
    angry: `<path d="M${hx - 7} ${hy + 14} q7 -8 14 0" fill="#7a1c1c" stroke="#2b1a10" stroke-width="2.2" stroke-linecap="round"/>`,
  }[mood] ?? '';
  const blush = mood === 'angry' ? '#ff3a3a' : '#ff8a9a';
  const cheeks = `<ellipse cx="${hx - 16}" cy="${hy + 7}" rx="5.5" ry="3.4" fill="${blush}" opacity="${mood === 'angry' ? .55 : .6}"/><ellipse cx="${hx + 16}" cy="${hy + 7}" rx="5.5" ry="3.4" fill="${blush}" opacity="${mood === 'angry' ? .55 : .6}"/>`;
  const glasses = L.style === 'bald' ? `<g fill="#ffffff33" stroke="#4a3a30" stroke-width="2"><circle cx="${hx - 9}" cy="${hy}" r="7.5"/><circle cx="${hx + 9}" cy="${hy}" r="7.5"/><path d="M${hx - 1.5} ${hy} h3" fill="none"/></g>` +
    `<path d="M${hx - 9} ${hy + 7} q4.5 -3 9 0 q4.5 -3 9 0 q-4.5 5 -9 1 q-4.5 4 -9 -1 Z" fill="#eaeaea"/>` : '';
  const flower = L.style === 'perm' ? `<g transform="translate(62 20)"><circle r="4.5" fill="#ffd23f"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${(6.5 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(6.5 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="4" fill="#ff7aa8"/>`).join('')}</g>` : '';
  const tie = L.style === 'neat' ? '<path d="M40 76 l-5 5 l5 17 l5 -17 Z" fill="#e33b4c"/>' : '';
  const collar = `<path d="M30 76 L40 84 L50 76" fill="none" stroke="${L.trim}" stroke-width="3" stroke-linejoin="round"/>`;
  const extras = {
    happy: '<g class="heart-up" fill="#ff5a7a"><path d="M68 22 c-2 -4 -8 -2 -6 3 l6 6 l6 -6 c2 -5 -4 -7 -6 -3 Z"/></g>',
    eating: '<g class="twinkle" fill="#ffd23f"><path d="M10 26 l1.6 3.6 l3.6 1.6 l-3.6 1.6 l-1.6 3.6 l-1.6 -3.6 l-3.6 -1.6 l3.6 -1.6 Z"/><path d="M70 30 l1.3 3 l3 1.3 l-3 1.3 l-1.3 3 l-1.3 -3 l-3 -1.3 l3 -1.3 Z"/></g>',
    cross: '<path class="sweat" d="M66 30 q4 7 0 10 q-4 -3 0 -10 Z" fill="#7fd0ff" stroke="#3a8fc4" stroke-width="1"/>',
    angry: '<g class="fume" fill="#ffffffdd"><circle cx="10" cy="20" r="6"/><circle cx="70" cy="18" r="6"/></g><path d="M60 20 l4 4 m0 -4 l-4 4 M66 14 l3 3" stroke="#ff3a3a" stroke-width="2.4" stroke-linecap="round"/>',
  }[mood] ?? '';
  return svg(80, 100,
    `<g transform="translate(${40 - 40 * s} ${100 - 100 * s}) scale(${s})">` +
    `<path d="M16 100 Q16 78 40 76 Q64 78 64 100 Z" fill="${L.shirt}" stroke="#00000022" stroke-width="2"/>` + collar + tie +
    `<circle cx="${hx}" cy="${hy}" r="28" fill="${L.skin}"/>` +
    (mood === 'angry' ? `<circle cx="${hx}" cy="${hy}" r="28" fill="#ff3a3a" opacity=".18"/>` : '') +
    `<ellipse cx="13" cy="${hy + 2}" rx="4" ry="5.5" fill="${L.skin}"/><ellipse cx="67" cy="${hy + 2}" rx="4" ry="5.5" fill="${L.skin}"/>` +
    hairOf(L) + cheeks + eyes + brows + glasses + mouth + flower + extras +
    '</g>', 'person');
}

// ---------------------------------------------------------------------------------------------------- Mochi, the stall cat
/** The stall's cat (a round ginger-and-white cat). mood: 'idle' | 'sleep' | 'cheer' | 'worried'. */
const CAT_WEAR = {
  latte: '<g transform="translate(52 22)"><path d="M0 0 l-9 -6 v12 Z M0 0 l9 -6 v12 Z" fill="#ff6b6b" stroke="#c94a4a" stroke-width="1"/><circle r="3" fill="#ff8a8a" stroke="#c94a4a" stroke-width="1"/></g>',
  pandan: '<g transform="translate(40 24)"><path d="M0 0 q-2 -10 4 -16" stroke="#4f8f58" stroke-width="2" fill="none"/><path d="M3 -15 q8 -6 12 2 q-7 4 -12 -2Z" fill="#7fcf8a"/><path d="M2 -10 q-8 -6 -12 1 q7 4 12 -1Z" fill="#9fdca8"/></g>',
  ocean: '<g transform="translate(40 25)"><path d="M-14 0 q14 -14 28 0 Z" fill="#fff" stroke="#3a9ad8" stroke-width="1.6"/><rect x="-15" y="-2" width="30" height="5" rx="2" fill="#3a9ad8"/><circle cx="0" cy="-9" r="2.2" fill="#ff6b6b"/></g>',
  sakura: '<g transform="translate(25 25)">' + [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-5" rx="3.6" ry="5" fill="#ffb3cc" stroke="#ff8fb3" stroke-width=".8" transform="rotate(${a})"/>`).join('') + '<circle r="2.4" fill="#ffd86b"/></g>',
  lavender: '<g transform="translate(55 24)"><path d="M0 -8 l2.4 5 l5.4 .6 l-4 3.6 l1.2 5.4 l-5 -3 l-5 3 l1.2 -5.4 l-4 -3.6 l5.4 -.6z" fill="#ffd86b" stroke="#e0a800" stroke-width=".8"/></g>',
};

export function cat(mood = 'idle', wear = '') {
  const eyes = {
    idle: '<g class="blink" style="transform-origin:40px 46px"><ellipse cx="32" cy="46" rx="3" ry="3.8" fill="#2b1a10"/><ellipse cx="48" cy="46" rx="3" ry="3.8" fill="#2b1a10"/><circle cx="31" cy="44.5" r="1.1" fill="#fff"/><circle cx="47" cy="44.5" r="1.1" fill="#fff"/></g>',
    sleep: '<path d="M28 47 q4 3 8 0 M44 47 q4 3 8 0" stroke="#2b1a10" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    cheer: '<path d="M28 47 q4 -5 8 0 M44 47 q4 -5 8 0" stroke="#2b1a10" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    worried: '<ellipse cx="32" cy="46" rx="3.4" ry="4.4" fill="#2b1a10"/><ellipse cx="48" cy="46" rx="3.4" ry="4.4" fill="#2b1a10"/><circle cx="31" cy="44.5" r="1.4" fill="#fff"/><circle cx="47" cy="44.5" r="1.4" fill="#fff"/><path d="M27 39 l7 2 M53 39 l-7 2" stroke="#2b1a10" stroke-width="1.8" stroke-linecap="round"/>',
  }[mood] ?? '';
  const mouth = mood === 'cheer'
    ? '<path d="M36 52 q4 6 8 0 Z" fill="#e0475a" stroke="#2b1a10" stroke-width="1.5"/>'
    : '<path d="M36 52 q2 2 4 0 q2 2 4 0" fill="none" stroke="#2b1a10" stroke-width="1.6" stroke-linecap="round"/>';
  const paws = mood === 'cheer'
    ? '<ellipse cx="16" cy="40" rx="6" ry="5" fill="#fffaf0" stroke="#e0a060" stroke-width="1.5"/><ellipse cx="64" cy="40" rx="6" ry="5" fill="#fffaf0" stroke="#e0a060" stroke-width="1.5"/>'
    : '<ellipse cx="30" cy="74" rx="6" ry="4" fill="#fffaf0" stroke="#e0a060" stroke-width="1.5"/><ellipse cx="50" cy="74" rx="6" ry="4" fill="#fffaf0" stroke="#e0a060" stroke-width="1.5"/>';
  const zzz = mood === 'sleep' ? '<g class="zzz" fill="#7a5a40" font-family="system-ui" font-weight="900"><text x="58" y="26" font-size="10">z</text><text x="66" y="16" font-size="13">Z</text></g>' : '';
  const sparkle = mood === 'cheer' ? '<g class="twinkle" fill="#ffd23f"><path d="M8 18 l2 4.5 l4.5 2 l-4.5 2 l-2 4.5 l-2 -4.5 l-4.5 -2 l4.5 -2 Z"/><path d="M72 22 l1.6 3.6 l3.6 1.6 l-3.6 1.6 l-1.6 3.6 l-1.6 -3.6 l-3.6 -1.6 l3.6 -1.6 Z"/></g>' : '';
  const sweat = mood === 'worried' ? '<path class="sweat" d="M60 32 q3 6 0 8 q-3 -2 0 -8 Z" fill="#7fd0ff" stroke="#3a8fc4" stroke-width=".8"/>' : '';
  return svg(80, 80,
    '<path class="tail" d="M60 70 q18 -2 14 -22 q-2 -6 -6 -3 q2 14 -10 17" fill="#f2a24a" stroke="#c97a2a" stroke-width="1.5" style="transform-origin:60px 70px"/>' +
    '<ellipse cx="40" cy="64" rx="24" ry="14" fill="#fffaf0" stroke="#e0a060" stroke-width="1.5"/>' +
    '<path d="M18 30 L22 12 L34 24 Z" fill="#f2a24a" stroke="#c97a2a" stroke-width="1.5" stroke-linejoin="round"/><path d="M62 30 L58 12 L46 24 Z" fill="#f2a24a" stroke="#c97a2a" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M22 28 L24 17 L31 25 Z" fill="#ffb0c0"/><path d="M58 28 L56 17 L49 25 Z" fill="#ffb0c0"/>' +
    '<ellipse cx="40" cy="44" rx="24" ry="20" fill="#fffaf0" stroke="#e0a060" stroke-width="1.5"/>' +
    '<path d="M24 32 Q40 18 56 32 Q50 36 40 30 Q30 36 24 32 Z" fill="#f2a24a"/>' +
    '<path d="M38 49 l2 2 l2 -2 Z" fill="#ff7a9a"/>' +
    '<ellipse cx="27" cy="52" rx="4.5" ry="2.6" fill="#ff9aaa" opacity=".6"/><ellipse cx="53" cy="52" rx="4.5" ry="2.6" fill="#ff9aaa" opacity=".6"/>' +
    '<path d="M18 50 h-9 M18 54 l-8 3 M62 50 h9 M62 54 l8 3" stroke="#c9a080" stroke-width="1.2" stroke-linecap="round"/>' +
    eyes + mouth + paws + zzz + sparkle + sweat + (CAT_WEAR[wear] ?? ''), 'cat cat-' + mood);
}

// ---------------------------------------------------------------------------------------------------- the stall
/** The stall's awning and front, with any decorations bought. */
export function stallTop(decor = {}, w = 400) {
  // (the colours follow the theme: CSS variables, with the classic red and cream as the fallback)
  const stripes = Array.from({ length: Math.ceil(w / 40) }, (_, i) => `<path d="M${i * 40} 0 h40 v24 q-20 16 -40 0 Z" style="fill:${i % 2 ? 'var(--awning-b, #fff6e6)' : 'var(--awning-a, #ff5a5f)'}"/>`).join('') +
    `<rect x="0" y="0" width="${w}" height="6" style="fill:var(--awning-top, #d8342a)"/>` +
    Array.from({ length: Math.ceil(w / 40) }, (_, i) => `<circle cx="${i * 40 + 20}" cy="33" r="2.4" style="fill:${i % 2 ? 'var(--awning-a, #ffb0b5)' : '#fff'}"/>`).join('');
  const lanterns = decor.lanterns ? [44, w - 44].map((x, k) => `<g class="sway" style="transform-origin:${x}px 26px;animation-delay:-${k}s"><line x1="${x}" y1="26" x2="${x}" y2="40" stroke="#5a2c0e" stroke-width="2"/><ellipse cx="${x}" cy="54" rx="13" ry="15" fill="#ff4a4a" stroke="#b81c1c" stroke-width="2"/><path d="M${x - 13} 54 h26 M${x} 39 v30" stroke="#ffd23f" stroke-width="1.2" opacity=".7"/><rect x="${x - 7}" y="38" width="14" height="4" rx="1" fill="#ffd23f"/><rect x="${x - 7}" y="67" width="14" height="4" rx="1" fill="#ffd23f"/><path d="M${x} 71 v8" stroke="#ffd23f" stroke-width="2"/></g>`).join('') : '';
  const sign = decor.sign ? `<g><rect x="${w / 2 - 92}" y="34" width="184" height="30" rx="10" fill="#4a2a1a" stroke="#ffd23f" stroke-width="3"/><text x="${w / 2}" y="55" text-anchor="middle" font-size="16" font-weight="900" fill="#ffd23f" font-family="system-ui">HAWKER RUSH</text></g>` : '';
  const neon = decor.neon ? `<text x="${w / 2}" y="84" text-anchor="middle" font-size="15" font-weight="900" fill="#ff5ad6" stroke="#ffd6f6" stroke-width=".6" font-family="system-ui" class="neon">★ OPEN ★</text>` : '';
  // (earned by levelling up the stall)
  const flagColours = ['#ff8a8a', '#ffd86b', '#7fcf8a', '#6ec1f0', '#c3a6ff'];
  const bunting = decor.bunting ? '<path d="M0 40 Q' + w / 2 + ' 52 ' + w + ' 40" stroke="#c98f5a" stroke-width="1.4" fill="none"/>' +
    Array.from({ length: Math.floor(w / 26) }, (_, i) => {
      const x = 8 + i * 26, y = 40 + 12 * (1 - ((x - w / 2) / (w / 2)) ** 2) * .9;
      return `<path d="M${x} ${y} l10 0 l-5 9 Z" fill="${flagColours[i % flagColours.length]}"/>`;
    }).join('') : '';
  const fairy = decor.fairy ? '<path d="M0 44 Q' + w / 4 + ' 58 ' + w / 2 + ' 44 T ' + w + ' 44" stroke="#5a4a3a" stroke-width="1" fill="none" opacity=".6"/>' +
    Array.from({ length: Math.floor(w / 20) }, (_, i) => {
      const x = 10 + i * 20, t = (x % (w / 2)) / (w / 2), y = 44 + 14 * Math.sin(Math.PI * t) * (Math.floor(x / (w / 2)) % 2 ? -.2 : 1) * .6;
      return `<circle cx="${x}" cy="${y + 2}" r="2.6" fill="${['#fff3a0', '#ffd0e0', '#c8f0ff'][i % 3]}" class="twinkle" style="animation-delay:-${(i * .37) % 1.2}s"/>`;
    }).join('') : '';
  const box = x => `<g><rect x="${x}" y="80" width="46" height="12" rx="3" fill="#b07a45" stroke="#7a4f27" stroke-width="1.4"/>` +
    [0, 1, 2].map(k => `<g transform="translate(${x + 9 + k * 14} 76)"><circle r="5" fill="${['#ff8fb3', '#ffd86b', '#c3a6ff'][k]}"/><circle r="2" fill="#fff6d0"/></g>`).join('') + '</g>';
  const flowers = decor.flowers ? box(6) + box(w - 52) : '';
  const star = decor.star ? `<g transform="translate(${w / 2} 16)" class="twinkle" style="animation-duration:1.6s"><path d="M0 -12 l3.5 7.5 l8.2 1 l-6 5.6 l1.6 8.1 l-7.3 -4 l-7.3 4 l1.6 -8.1 l-6 -5.6 l8.2 -1 Z" fill="#ffd23f" stroke="#c99400" stroke-width="1.4"/></g>` : '';
  return svg(w, 92, stripes + bunting + fairy + lanterns + sign + neon + flowers + star, 'stall-top');
}

/** Things bought in the shop, standing in the stall: the standing fan, the tip jar, the kitchen timer. */
export function props(upgrades = {}) {
  const out = [];
  if (upgrades.fan) {
    const speed = [0, 1.1, .7, .45][upgrades.fan] ?? .45;
    out.push(`<span class="prop prop-fan">${svg(40, 64, '<rect x="18" y="30" width="4" height="28" rx="2" fill="#8a96a0"/><ellipse cx="20" cy="60" rx="12" ry="3.5" fill="#6c7780"/>' +
      '<circle cx="20" cy="20" r="17" fill="#e9f6fb" stroke="#8a96a0" stroke-width="2"/>' +
      `<g class="spin" style="transform-origin:20px 20px;animation-duration:${speed}s">` + [0, 120, 240].map(a => `<ellipse cx="20" cy="11" rx="4.5" ry="9" fill="#7fc8e8" transform="rotate(${a} 20 20)"/>`).join('') + '</g>' +
      '<circle cx="20" cy="20" r="3" fill="#5a6670"/>' +
      '<path d="M5 20 a15 15 0 0 1 30 0 M7 27 a14 14 0 0 0 26 0" stroke="#b8c6ce" stroke-width="1" fill="none"/>')}</span>`);
  }
  if (upgrades.tipjar) {
    const coinsIn = 2 + 3 * upgrades.tipjar;
    out.push(`<span class="prop prop-jar">${svg(34, 44, '<path d="M7 12 h20 v4 q4 4 4 12 v8 q0 6 -6 6 h-16 q-6 0 -6 -6 v-8 q0 -8 4 -12 Z" fill="#dff3ffcc" stroke="#8ab8d0" stroke-width="2"/>' +
      Array.from({ length: coinsIn }, (_, k) => `<ellipse cx="${10 + (k * 7) % 15}" cy="${38 - Math.floor(k / 3) * 4}" rx="4" ry="2" fill="#ffd23f" stroke="#c99400" stroke-width=".8"/>`).join('') +
      '<rect x="6" y="6" width="22" height="7" rx="2" fill="#c98f5a"/><text x="17" y="30" text-anchor="middle" font-size="7" font-weight="900" fill="#4f7a90" font-family="system-ui">TIPS</text>')}</span>`);
  }
  if (upgrades.timer) {
    out.push(`<span class="prop prop-timer">${svg(34, 36, '<circle cx="17" cy="20" r="14" fill="#ff8fb8" stroke="#c9507a" stroke-width="2"/><circle cx="17" cy="20" r="9.5" fill="#fff"/>' +
      '<rect x="14" y="2" width="6" height="5" rx="2" fill="#c9507a"/>' +
      '<g class="spin" style="transform-origin:17px 20px;animation-duration:6s"><path d="M17 20 v-7" stroke="#2b1a10" stroke-width="2" stroke-linecap="round"/></g>' +
      (upgrades.timer > 1 ? '<circle cx="28" cy="9" r="3" fill="#ffd23f"/>' : ''))}</span>`);
  }
  return out.join('');
}

/** Behind the customers: the hawker centre (other stalls, hanging lamps, a ceiling fan, a crowd that grows in a rush).
 * `w` widens it for the sideways screen (more stalls, more lamps, a bigger crowd). */
export function backdrop(w = 400) {
  const colours = [['#ffe3a3', '#ff9f43'], ['#c8f0d8', '#3fb37f'], ['#d8e4ff', '#5a7ee0'], ['#ffd6e4', '#e0567e']];
  const stalls = Array.from({ length: Math.ceil(w / 140) }, (_, k) => [k * 140, ...colours[k % colours.length]]).map(([x, wall, sign], k) =>
    `<g><rect x="${x + 6}" y="40" width="128" height="120" rx="8" fill="${wall}" opacity=".75"/>` +
    `<rect x="${x + 22}" y="48" width="96" height="22" rx="7" fill="${sign}"/>` +
    `<g fill="#fff" opacity=".9">${[0, 1, 2].map(j => `<circle cx="${x + 44 + j * 26}" cy="59" r="5"/>`).join('')}</g>` +
    `<rect x="${x + 16}" y="80" width="108" height="10" rx="4" fill="#ffffffaa"/>` +
    `<g class="steam" stroke="#ffffffcc" stroke-width="2.4" fill="none" stroke-linecap="round" style="animation-delay:-${k * .5}s"><path d="M${x + 50} 104 q-4 -6 0 -12"/><path d="M${x + 90} 104 q-4 -6 0 -12"/></g></g>`).join('');
  const lamps = Array.from({ length: Math.round(w / 130) }, (_, k) => 70 + k * 130).map((x, k) => `<g class="sway" style="transform-origin:${x}px 0px;animation-delay:-${k * .8}s"><line x1="${x}" y1="0" x2="${x}" y2="26" stroke="#7a5a40" stroke-width="1.5"/><path d="M${x - 14} 36 Q${x} 18 ${x + 14} 36 Z" fill="#ffcf6b"/><ellipse cx="${x}" cy="38" rx="16" ry="5" fill="#fff3b8" opacity=".55"/></g>`).join('');
  const fan = `<g transform="translate(${w / 2} 16)">` + '<g class="spin">' + [0, 120, 240].map(a => `<ellipse cx="0" cy="-15" rx="5" ry="15" fill="#e8d8c0" stroke="#bba58a" transform="rotate(${a})"/>`).join('') + '</g><circle r="5" fill="#bba58a"/></g>';
  const tints = ['#ffb3c6', '#b8e0ff', '#ffe0a3', '#c6f0c0', '#e0c8ff', '#ffd0b0'];
  const crowd = Array.from({ length: Math.round(w / 65) }, (_, k) => [30 + k * 65, tints[k % tints.length]]).map(([x, c], k) =>
    `<g class="walker ${k % 2 ? 'rush-only' : ''}" style="animation-delay:-${k * 1.7}s"><circle cx="${x}" cy="128" r="11" fill="${c}"/><path d="M${x - 14} 160 Q${x - 14} 140 ${x} 139 Q${x + 14} 140 ${x + 14} 160 Z" fill="${c}"/></g>`).join('');
  return svg(w, 160, stalls + crowd + fan + lamps, 'backdrop-art').replace('<svg ', '<svg preserveAspectRatio="xMidYMax meet" ');
}
