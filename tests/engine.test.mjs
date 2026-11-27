import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRules,direction,checkPath,solve,candidates} from '../games/rulereaper/public/src/engine.mjs';
const path=[0,1,2,3,4,9,14,19,24];
test('valid win',()=>assert.equal(checkPath(path,[]).ok,true));
test('wraparound and diagonals',()=>{assert.equal(direction(4,5),null);assert.equal(direction(0,6),null);});
test('forbidden pair',()=>assert.equal(checkPath(path,['RR']).ok,false));
test('revisits rejected',()=>assert.equal(checkPath([0,1,0],[],false).ok,false));
test('wrong endpoint',()=>assert.equal(checkPath([0,1],[]).ok,false));
test('invalid rules',()=>{for(const r of [['XX'],['RR','RR'],['RL'],null])assert.throws(()=>normalizeRules(r));});
test('solver witness',()=>{const s=solve(['RR','DD']);assert.equal(s.status,'solved');assert.equal(checkPath(s.witness,['RR','DD']).ok,true);});
test('unsolvable',()=>assert.equal(solve(['RR','RD','DR','DD']).status,'unsolvable'));
test('budget fail closed',()=>assert.equal(solve([],0).status,'unknown'));
test('reaps remove prior solution and preserve witness',()=>{const cs=candidates(path,[]);assert.ok(cs.length);for(const c of cs.filter(x=>x.status==='solved')){assert.equal(checkPath(path,[c.rule]).ok,false);assert.equal(checkPath(c.witness,[c.rule]).ok,true);}});
test('reaps must originate in winning path',()=>{assert.deepEqual(candidates(path,[]).map(x=>x.rule),['DD','RD','RR']);assert.throws(()=>candidates([0,1],[]));});
test('unknown candidates never claim solved',()=>assert.ok(candidates(path,[],0).every(c=>c.status==='unknown')));
test('chain maintains invariants',()=>{let r=[];for(let i=0;i<8;i++){const s=solve(r);assert.equal(s.status,'solved');const c=candidates(s.witness,r).find(x=>x.status==='solved');if(!c)break;const n=normalizeRules([...r,c.rule]);assert.equal(checkPath(s.witness,n).ok,false);assert.equal(checkPath(c.witness,n).ok,true);r=n;}});

test('maze walls, start and exit are checked on every path', () => {
  const maze = { start: 5, exit: 8, walls: [7] };
  assert.equal(checkPath([0, 1], [], false, maze).ok, false);
  assert.equal(checkPath([5, 6, 7], [], false, maze).ok, false);
  assert.equal(checkPath([5, 6, 1, 2, 3, 8], [], true, maze).ok, true);
  assert.equal(checkPath([5, 6, 1, 2, 3, 8, 9], [], false, maze).ok, false);
});

test('a forbidden turn identifies its exact three tiles', () => {
  const result = checkPath([0, 1, 6, 5, 10], ['LD'], false);
  assert.equal(result.ok, false);
  assert.equal(result.pair, 'LD');
  assert.deepEqual(result.tiles, [6, 5, 10]);
});

test('solver and reap candidates stay on the selected board', () => {
  const maze = { start: 5, exit: 8, walls: [7] };
  const shortcut = [5, 6, 1, 2, 3, 8];
  const result = solve([], 100000, maze);
  assert.equal(result.status, 'solved');
  assert.equal(checkPath(result.witness, [], true, maze).ok, true);
  const offered = candidates(shortcut, [], 100000, maze).filter(option => option.status === 'solved');
  assert.ok(offered.length);
  for (const { rule, witness } of offered) {
    assert.equal(checkPath(shortcut, [rule], true, maze).ok, false);
    assert.equal(checkPath(witness, [rule], true, maze).ok, true);
  }
});

test('a wall can make the board unsolvable', () => {
  assert.equal(solve([], 100000, { start: 0, exit: 2, walls: [1, 5] }).status, 'unsolvable');
});
