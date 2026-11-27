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
export function dish(base, has) {
  return base === 'cup' ? cup(has) : base === 'bowl' ? bowl(has) : plate(has);
}

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

/** A cooking station with its slots: 'empty' | 'cooking' (p: 0..1) | 'ready' (p: how close to burning) | 'burnt'. */
export function station(id, slots) {
  if (id === 'toaster') {
    const body = slots.map((s, k) => {
      const x = 12 + k * 22;
      const bread = !s ? '' : s.state === 'burnt' ? '#2a1c14' : s.state === 'ready' ? '#d48a32' : mix('#f3dfb1', '#d99a45', s.p);
      const up = s && s.state !== 'cooking' ? -8 : 2;
      return `${bread ? `<rect x="${x + 2}" y="${10 + up}" width="14" height="20" rx="4" fill="${bread}" stroke="#8a5a26" stroke-width="1.5"/>` : ''}` +
        `<rect x="${x}" y="22" width="18" height="5" rx="2" fill="#333"/>`;
    }).join('');
    return svg(16 + slots.length * 22, 60, `<rect x="4" y="20" width="${8 + slots.length * 22}" height="34" rx="10" fill="#c9ced4" stroke="#7d858d" stroke-width="2"/>` +
      body + smoke(slots), 'station-art');
  }
  if (id === 'pot') {
    const eggs = slots.map((s, k) => {
      if (!s) return '';
      const x = 18 + k * 14;
      const c = s.state === 'burnt' ? '#8a8a8a' : s.state === 'ready' ? '#fffdf4' : '#f4ecd8';
      return `<ellipse cx="${x}" cy="22" rx="6" ry="7.5" fill="${c}" stroke="#b9ab8a" stroke-width="1.5" class="${s.state === 'cooking' ? 'bob' : ''}"/>`;
    }).join('');
    return svg(30 + slots.length * 14, 60, eggs + `<path d="M6 24 L${24 + slots.length * 14} 24 L${20 + slots.length * 14} 52 Q${15 + slots.length * 7} 56 10 52 Z" fill="#9aa3ab" stroke="#5f676e" stroke-width="2"/>` +
      `<path d="M2 28 L6 28 M${24 + slots.length * 14} 28 L${28 + slots.length * 14} 28" stroke="#5f676e" stroke-width="4" stroke-linecap="round"/>` +
      (slots.some(s => s && s.state === 'cooking') ? '<g class="steam" stroke="#ffffffaa" stroke-width="2" fill="none"><path d="M16 14 q-3 -4 0 -8"/><path d="M28 14 q-3 -4 0 -8"/></g>' : '') + smoke(slots), 'station-art');
  }
  // the satay grill
  const sticks = slots.map((s, k) => {
    if (!s) return '';
    const y = 20 + k * 9;
    const meat = s.state === 'burnt' ? '#1d120b' : s.state === 'ready' ? '#8a4a1e' : mix('#d98b7a', '#8a4a1e', s.p);
    return `<line x1="6" y1="${y}" x2="${54}" y2="${y}" stroke="#d8b98a" stroke-width="2"/>` +
      [0, 1, 2, 3].map(j => `<circle cx="${16 + j * 9}" cy="${y}" r="4" fill="${meat}" stroke="#4a240b"/>`).join('');
  }).join('');
  return svg(60, 60, '<rect x="4" y="34" width="52" height="18" rx="4" fill="#3a3a3a"/>' +
    '<path d="M8 40 h44 M8 46 h44" stroke="#ff7a2a" stroke-width="2" opacity=".8"/>' + sticks + smoke(slots), 'station-art');
}
function smoke(slots) {
  return slots.some(s => s && s.state === 'burnt')
    ? '<g class="smoke" fill="#55555599"><circle cx="20" cy="10" r="6"/><circle cx="30" cy="6" r="7"/><circle cx="40" cy="11" r="5"/></g>'
    : '';
}
function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------------------------------- customers
const LOOKS = {
  uncle: { skin: '#e8b98f', hair: '#e6e6e6', shirt: '#f2f2f2', extra: 'glasses', hairStyle: 'bald' },
  auntie: { skin: '#f0c7a0', hair: '#3a2a22', shirt: '#d9468a', extra: 'flower', hairStyle: 'perm' },
  office: { skin: '#f2cfae', hair: '#1d1d1d', shirt: '#3b6fd8', extra: 'tie', hairStyle: 'neat' },
  student: { skin: '#e9c09c', hair: '#2a1d15', shirt: '#ffffff', extra: 'cap', hairStyle: 'short' },
  worker: { skin: '#c98d62', hair: '#1a1a1a', shirt: '#f08a1c', extra: 'hardhat', hairStyle: 'short' },
  kid: { skin: '#f6d2b0', hair: '#4a2d1a', shirt: '#43b37a', extra: 'none', hairStyle: 'kid' },
  tourist: { skin: '#f6d5c3', hair: '#d6a34a', shirt: '#29b6c7', extra: 'sunhat', hairStyle: 'long' },
};

/** A customer (head and shoulders), with a mood: 'happy' | 'ok' | 'cross' | 'angry' | 'eating'. */
export function person(who, mood = 'ok') {
  const L = LOOKS[who] ?? LOOKS.student;
  const small = who === 'kid';
  const s = small ? .88 : 1;
  let hair = '';
  switch (L.hairStyle) {
    case 'bald': hair = `<path d="M22 32 q-2 -10 6 -14 M58 32 q2 -10 -6 -14" stroke="${L.hair}" stroke-width="5" fill="none" stroke-linecap="round"/>`; break;
    case 'perm': hair = `<g fill="${L.hair}">${[18, 28, 40, 52, 62].map((x, i) => `<circle cx="${x}" cy="${20 - (i % 2) * 3}" r="9"/>`).join('')}<circle cx="16" cy="32" r="7"/><circle cx="64" cy="32" r="7"/></g>`; break;
    case 'neat': hair = `<path d="M20 30 Q22 12 40 12 Q58 12 60 30 Q50 20 34 22 Z" fill="${L.hair}"/>`; break;
    case 'long': hair = `<path d="M18 46 Q14 14 40 13 Q66 14 62 46 L56 46 Q58 24 40 22 Q22 24 24 46 Z" fill="${L.hair}"/>`; break;
    case 'kid': hair = `<path d="M20 30 Q24 10 40 12 Q56 10 60 30 Q52 18 46 22 Q40 14 32 22 Q26 18 20 30 Z" fill="${L.hair}"/>`; break;
    default: hair = `<path d="M20 30 Q22 12 40 12 Q58 12 60 30 Q40 20 20 30 Z" fill="${L.hair}"/>`;
  }
  let hat = '';
  if (L.extra === 'cap') hat = '<path d="M20 24 Q22 8 40 8 Q58 8 60 24 Z" fill="#d23a2a"/><path d="M40 22 L70 24 Q64 28 40 26 Z" fill="#b02a1d"/>';
  if (L.extra === 'hardhat') hat = '<path d="M18 26 Q20 6 40 6 Q60 6 62 26 Z" fill="#ffc21a" stroke="#c99400" stroke-width="2"/><rect x="14" y="24" width="52" height="5" rx="2" fill="#ffc21a" stroke="#c99400"/>';
  if (L.extra === 'sunhat') hat = '<ellipse cx="40" cy="20" rx="34" ry="7" fill="#f3dfa8" stroke="#c9a85a" stroke-width="2"/><path d="M24 20 Q26 4 40 4 Q54 4 56 20 Z" fill="#f3dfa8" stroke="#c9a85a" stroke-width="2"/><rect x="24" y="16" width="32" height="4" fill="#e85d5d"/>';
  const eyes = mood === 'happy' || mood === 'eating'
    ? '<path d="M30 36 q4 -5 8 0 M44 36 q4 -5 8 0" stroke="#2b1a10" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    : mood === 'angry'
      ? '<path d="M29 31 l8 4 M51 31 l-8 4" stroke="#2b1a10" stroke-width="2.6" stroke-linecap="round"/><circle cx="34" cy="38" r="2.6" fill="#2b1a10"/><circle cx="48" cy="38" r="2.6" fill="#2b1a10"/>'
      : '<circle cx="34" cy="37" r="2.8" fill="#2b1a10"/><circle cx="48" cy="37" r="2.8" fill="#2b1a10"/>';
  const brows = mood === 'cross' ? '<path d="M30 30 l7 2 M52 30 l-7 2" stroke="#2b1a10" stroke-width="2.2" stroke-linecap="round"/>' : '';
  const mouth = {
    happy: '<path d="M33 45 q8 9 16 0" fill="#c0392b" stroke="#2b1a10" stroke-width="2"/>',
    eating: '<ellipse cx="41" cy="47" rx="5" ry="4" fill="#c0392b" stroke="#2b1a10" stroke-width="2" class="chew"/>',
    ok: '<path d="M35 46 q6 4 12 0" fill="none" stroke="#2b1a10" stroke-width="2.4" stroke-linecap="round"/>',
    cross: '<path d="M35 48 h12" stroke="#2b1a10" stroke-width="2.4" stroke-linecap="round"/>',
    angry: '<path d="M34 49 q7 -6 14 0" fill="none" stroke="#2b1a10" stroke-width="2.6" stroke-linecap="round"/>',
  }[mood] ?? '';
  const glasses = L.extra === 'glasses' ? '<g fill="none" stroke="#333" stroke-width="2"><circle cx="34" cy="37" r="6"/><circle cx="48" cy="37" r="6"/><path d="M40 37 h2"/></g>' : '';
  const flower = L.extra === 'flower' ? '<g transform="translate(60 18)"><circle r="4" fill="#ffd23f"/>' + [0, 72, 144, 216, 288].map(a => `<circle cx="${6 * Math.cos(a * Math.PI / 180)}" cy="${6 * Math.sin(a * Math.PI / 180)}" r="3.6" fill="#ff7aa8"/>`).join('') + '</g>' : '';
  const tie = L.extra === 'tie' ? '<path d="M40 70 l-4 6 l4 16 l4 -16 Z" fill="#c8102e"/>' : '';
  const cheeks = mood === 'angry' || mood === 'cross' ? '<ellipse cx="27" cy="44" rx="5" ry="3" fill="#ff4a3a" opacity=".45"/><ellipse cx="55" cy="44" rx="5" ry="3" fill="#ff4a3a" opacity=".45"/>' : '<ellipse cx="27" cy="44" rx="5" ry="3" fill="#ff9a8a" opacity=".35"/><ellipse cx="55" cy="44" rx="5" ry="3" fill="#ff9a8a" opacity=".35"/>';
  const steam = mood === 'angry' ? '<g class="fume" fill="#ffffffcc"><circle cx="14" cy="14" r="5"/><circle cx="66" cy="12" r="5"/></g>' : '';
  return svg(80, 100,
    `<g transform="translate(${40 - 40 * s} ${100 - 100 * s}) scale(${s})">` +
    `<path d="M14 100 Q14 70 40 68 Q66 70 66 100 Z" fill="${L.shirt}" stroke="#00000022" stroke-width="2"/>` + tie +
    `<rect x="34" y="56" width="12" height="12" fill="${L.skin}"/>` +
    `<circle cx="40" cy="38" r="22" fill="${L.skin}"/>` + hair + cheeks + eyes + brows + glasses + mouth + hat + flower + steam +
    '</g>', 'person');
}

// ---------------------------------------------------------------------------------------------------- the stall
/** The stall's awning and front, with any decorations bought. */
export function stallTop(decor = {}) {
  const stripes = Array.from({ length: 10 }, (_, i) => `<path d="M${i * 40} 0 h40 v26 q-20 14 -40 0 Z" fill="${i % 2 ? '#fff6e6' : '#d8342a'}"/>`).join('');
  const lanterns = decor.lanterns ? [50, 350].map(x => `<g class="sway" style="transform-origin:${x}px 26px"><line x1="${x}" y1="26" x2="${x}" y2="40" stroke="#5a2c0e" stroke-width="2"/><ellipse cx="${x}" cy="54" rx="13" ry="15" fill="#e3342f" stroke="#a51c18" stroke-width="2"/><rect x="${x - 7}" y="38" width="14" height="4" fill="#ffc21a"/><rect x="${x - 7}" y="67" width="14" height="4" fill="#ffc21a"/></g>`).join('') : '';
  const sign = decor.sign ? '<rect x="112" y="30" width="176" height="30" rx="8" fill="#3a2419" stroke="#ffc21a" stroke-width="3"/><text x="200" y="51" text-anchor="middle" font-size="16" font-weight="900" fill="#ffc21a" font-family="system-ui">HAWKER RUSH</text>' : '';
  const neon = decor.neon ? '<text x="200" y="84" text-anchor="middle" font-size="15" font-weight="900" fill="#ff5ad6" font-family="system-ui" class="neon">★ OPEN ★</text>' : '';
  return svg(400, 92, stripes + lanterns + sign + neon, 'stall-top');
}
