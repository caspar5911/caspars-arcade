import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARDS, TUTORIAL, parseChallenge, challengeHash, ruleLabel } from '../games/rulereaper/public/src/challenges.mjs';
import { candidates, checkPath, solve } from '../games/rulereaper/public/src/engine.mjs';

test('the tutorial shortcut can be broken and escaped by a different route', () => {
  const shortcut = [0, 1, 2, 3, 4];
  const reap = candidates(shortcut, [], 100000, TUTORIAL).find(option => option.rule === 'RR');
  assert.equal(reap.status, 'solved');
  assert.ok(reap.witness.length > shortcut.length);
  assert.equal(checkPath(reap.witness, ['RR'], true, TUTORIAL).ok, true);
});

test('three additional mazes have distinct exits and leave room for a reap', () => {
  const mazes = BOARDS.filter(board => board !== TUTORIAL);
  assert.equal(mazes.length, 3);
  assert.equal(new Set(BOARDS.map(board => board.exit)).size, 4);
  for (const maze of mazes) {
    assert.ok(maze.walls.length);
    const { status, witness } = solve([], 100000, maze);
    assert.equal(status, 'solved');
    assert.ok(candidates(witness, [], 100000, maze).some(option => option.status === 'solved'), maze.id);
  }
});

test('a shared maze and its bans survive a link round trip', () => {
  const { board, rules } = parseChallenge(challengeHash(TUTORIAL, ['RR']));
  assert.equal(board, TUTORIAL);
  assert.deepEqual(rules, ['RR']);
});

test('v1 links still open on the original empty grid', () => {
  const { board, rules } = parseChallenge('#v1=LD');
  assert.deepEqual([board.start, board.exit, ...board.walls], [0, 24]);
  assert.deepEqual(rules, ['LD']);
  assert.equal(challengeHash(board, rules), '#v1=LD');
});

test('unknown boards and impossible rules are rejected', () => {
  assert.throws(() => parseChallenge('#v2=unknown:LD'));
  assert.throws(() => parseChallenge('#v2=tutorial:RD,RR,DR,DD'));
  assert.throws(() => parseChallenge('#v2=tutorial:XX'));
});

test('the LD label gives full directions as well as arrows', () => {
  assert.deepEqual(ruleLabel('LD'), { arrows: '← ↓', text: 'Left, then Down' });
});
