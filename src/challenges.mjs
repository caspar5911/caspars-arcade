import { LEGACY_BOARD, normalizeRules, solve } from './engine.mjs';

function makeBoard(id, name, rows) {
  const tiles = rows.join('');
  const walls = [...tiles].flatMap((tile, index) => tile === '#' ? [index] : []);
  return Object.freeze({
    id, name, start: tiles.indexOf('S'), exit: tiles.indexOf('E'), walls: Object.freeze(walls),
  });
}

export const TUTORIAL = makeBoard('tutorial', 'First escape', [
  'S...E',
  '..#..',
  '#...#',
  '##..#',
  '#####',
]);

export const BOARDS = Object.freeze([
  TUTORIAL,
  makeBoard('switchback', 'Switchback', [
    'S...#',
    '..#..',
    '#....',
    '..#..',
    'E....',
  ]),
  makeBoard('courtyard', 'Courtyard', [
    '.....',
    '..#.E',
    '.#.#.',
    '.....',
    'S..#.',
  ]),
  makeBoard('crossroads', 'Crossroads', [
    '..S..',
    '.#.#.',
    '..#..',
    '.#.#.',
    '..E..',
  ]),
]);

export function parseChallenge(hash) {
  if (!hash) return { board: TUTORIAL, rules: [] };
  if (hash.length > 65) throw new Error('This challenge link is invalid.');
  const legacy = /^#v1=([A-Z,]*)$/.exec(hash);
  const current = /^#v2=([a-z-]+):([A-Z,]*)$/.exec(hash);
  if (!legacy && !current) throw new Error('This challenge link is invalid.');

  const board = legacy ? LEGACY_BOARD : BOARDS.find(item => item.id === current[1]);
  if (!board) throw new Error('This maze could not be found.');
  const rawRules = legacy ? legacy[1] : current[2];
  const rules = normalizeRules(rawRules ? rawRules.split(',') : []);
  if (solve(rules, 100000, board).status !== 'solved') {
    throw new Error('This challenge has no verified route to the exit.');
  }
  return { board, rules };
}

export function challengeHash(board, rules) {
  const pairs = normalizeRules(rules).join(',');
  return board === LEGACY_BOARD ? '#v1=' + pairs : '#v2=' + board.id + ':' + pairs;
}

const directions = {
  U: ['↑', 'Up'],
  D: ['↓', 'Down'],
  L: ['←', 'Left'],
  R: ['→', 'Right'],
};

export function ruleLabel(rule) {
  const [first, second] = [...rule].map(move => directions[move]);
  return { arrows: first[0] + ' ' + second[0], text: first[1] + ', then ' + second[1] };
}

export function ruleExplanation(rule) {
  const [first, second] = [...rule].map(move => directions[move][1].toLowerCase());
  return 'After moving ' + first + ', you can’t move ' + second + ' next.';
}
