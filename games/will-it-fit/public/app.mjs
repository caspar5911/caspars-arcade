import * as E from './engine.mjs';
import { INK, dimensions, drawLid, drawPiece, drawSuitcase } from './draw.mjs';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const storageKey = 'will-it-fit-v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* This visit still works. */ }
const completed = saved.completed && typeof saved.completed === 'object' && !Array.isArray(saved.completed) ? saved.completed : {};
let muted = saved.muted === true;
let level = Number.isInteger(saved.level) ? Math.max(0, Math.min(E.LEVELS.length - 1, saved.level)) : 0;
let mode = 'campaign';
let dailyDate;
let game;
let selected = null;
let aim = null;
let pointer = null;
let scrollFrame = null;
let layout;
let closing = 0;
let frame = null;
let audio;
let started;

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ completed, level, muted }));
  } catch { /* Storage may be disabled. */ }
}

function sound(kind) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const sequence = kind === 'win' ? [523, 659, 784, 1046] : kind === 'wrong' ? [150, 110] : [450 + Math.random() * 100];
    sequence.forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + i * .09;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.001, at);
      gain.gain.exponentialRampToValueAtTime(.09, at + .01);
      gain.gain.exponentialRampToValueAtTime(.001, at + .16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + .17);
    });
  } catch { /* Audio is optional. */ }
}

function message(text) {
  $('status').textContent = text;
}

function loadPuzzle(index = level, nextMode = 'campaign', date) {
  cancelAnimationFrame(frame);
  stopDragScroll();
  if ($('win').open) $('win').close();
  level = index;
  mode = nextMode;
  game = E.createGame(mode === 'daily' ? E.dailyPuzzle(date ?? new Date()) : E.LEVELS[level]);
  dailyDate = mode === 'daily' ? game.puzzle.id.slice(6) : undefined;
  document.querySelector('.game').classList.toggle('dense', game.puzzle.pieces.length > 4);
  selected = null;
  aim = null;
  pointer = null;
  closing = 0;
  started = performance.now();
  $('trip').textContent = game.puzzle.title;
  $('levels').textContent = mode === 'daily' ? 'Daily bag' : `Bag ${level + 1} / ${E.LEVELS.length}`;
  $('daily').textContent = mode === 'daily' ? 'Trip bags' : 'Daily bag';
  message(level === 0 && mode === 'campaign'
    ? 'Drag things into the bag. Tap Rotate to turn them.'
    : 'A little rearranging goes a long way.');
  refresh();
  persist();
}

function refresh() {
  const packed = Object.keys(game.placements).length;
  $('count').textContent = `${packed} / ${game.puzzle.pieces.length} packed`;
  $('close').classList.toggle('ready', E.isComplete(game));
  $('undo').disabled = game.history.length === 0 || closing > 0;
  $('rotate').disabled = !selected || closing > 0;
  $('hint').disabled = E.isComplete(game) || closing > 0;
  $('reset').disabled = game.history.length === 0 || closing > 0;
  const items = $('itemButtons');
  items.replaceChildren();
  for (const piece of game.puzzle.pieces) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = piece.name + (game.placements[piece.id] ? ', packed' : '');
    const shape = E.cellsFor(piece, selected?.id === piece.id ? selected.rotation : 0);
    button.setAttribute('aria-label', piece.name + '. Occupies relative column and row cells '
      + shape.map(([x, y]) => `${x + 1},${y + 1}`).join('; ')
      + (game.placements[piece.id] ? '. Packed.' : '. Unpacked.'));
    button.setAttribute('aria-pressed', String(selected?.id === piece.id));
    button.addEventListener('click', () => {
      select(piece.id);
      canvas.focus({ preventScroll: true });
    });
    items.append(button);
  }
  describeBoard();
  resize();
}

function describeBoard() {
  const table = $('boardAccess');
  table.replaceChildren();
  const caption = table.createCaption();
  caption.textContent = `${game.puzzle.cols} columns by ${game.puzzle.rows} rows. ${game.puzzle.title}.`;
  const contents = new Map(game.puzzle.blocked.map(([x, y]) => [`${x},${y}`, 'Wheel pocket']));
  for (const piece of game.puzzle.pieces) {
    const placement = game.placements[piece.id];
    if (!placement) continue;
    for (const [x, y] of E.cellsFor(piece, placement.rotation)) {
      contents.set(`${x + placement.x},${y + placement.y}`, piece.name);
    }
  }
  for (let y = 0; y < game.puzzle.rows; y++) {
    const row = table.insertRow();
    for (let x = 0; x < game.puzzle.cols; x++) {
      row.insertCell().textContent = `Column ${x + 1}, row ${y + 1}. ${contents.get(`${x},${y}`) ?? 'Empty'}.`;
    }
  }
}

function describeAim() {
  if (!selected || !aim) return;
  const piece = game.puzzle.pieces.find(item => item.id === selected.id);
  const valid = E.canPlace(game, selected.id, aim.x, aim.y, selected.rotation);
  message(`${piece.name}, column ${aim.x + 1}, row ${aim.y + 1}, ${selected.rotation * 90} degrees. ${valid ? 'Fits here. Enter to pack.' : 'Cannot fit here.'}`);
}

function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { cols, rows, pieces } = game.puzzle;
  const trayRows = pieces.length > 4 ? 2 : 1;
  const cell = Math.floor(Math.min(80, (width - 36) / cols, (height - 60 - trayRows * 86) / rows));
  const boardWidth = cols * cell;
  const boardHeight = rows * cell;
  const board = { x: (width - boardWidth) / 2, y: 40, cell, width: boardWidth, height: boardHeight };
  const trayTop = board.y + boardHeight + 47;
  const trayColumns = Math.min(4, pieces.length);
  const slotWidth = width / trayColumns;
  const availableHeight = height - trayTop;
  const slotHeight = Math.min(125, availableHeight / trayRows);
  const trayOffset = Math.max(0, (availableHeight - slotHeight * trayRows) / 2);
  const slots = pieces.map((piece, index) => {
    const rotation = selected?.id === piece.id ? selected.rotation : 0;
    const size = dimensions(piece, rotation);
    const scale = Math.min(cell * .72, (slotWidth - 18) / size.cols, (slotHeight - 25) / size.rows);
    return {
      id: piece.id, cell: scale, rotation, width: slotWidth,
      x: (index % trayColumns) * slotWidth + (slotWidth - size.cols * scale) / 2,
      y: trayTop + trayOffset + Math.floor(index / trayColumns) * slotHeight
        + (slotHeight - 28 - size.rows * scale) / 2,
      labelX: (index % trayColumns + .5) * slotWidth,
      labelY: trayTop + trayOffset + (Math.floor(index / trayColumns) + 1) * slotHeight - 6,
    };
  });
  layout = { width, height, board, trayTop, slots };
  draw();
}

function draw() {
  if (!layout) return;
  const { width, height, board, slots, trayTop } = layout;
  ctx.clearRect(0, 0, width, height);
  drawSuitcase(ctx, board, game.puzzle);
  for (const piece of game.puzzle.pieces) {
    const placement = game.placements[piece.id];
    if (placement && !(pointer?.moved && pointer.id === piece.id)) {
      drawPiece(ctx, piece, placement.rotation, board.x + placement.x * board.cell,
        board.y + placement.y * board.cell, board.cell, { selected: selected?.id === piece.id });
    }
  }
  ctx.fillStyle = '#6b786c';
  ctx.font = '600 11px "DM Sans", system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(E.isComplete(game) ? 'EVERYTHING’S IN.' : 'STILL TO PACK', width / 2, trayTop - 16);
  for (const slot of slots) {
    const piece = game.puzzle.pieces.find(item => item.id === slot.id);
    const packed = Boolean(game.placements[slot.id]);
    if (!packed) {
      if (!(pointer?.moved && pointer.id === piece.id)) {
        drawPiece(ctx, piece, slot.rotation, slot.x, slot.y, slot.cell, { selected: selected?.id === piece.id });
      }
      ctx.fillStyle = INK;
    } else {
      ctx.fillStyle = '#9bab9b';
      ctx.beginPath();
      ctx.arc(slot.labelX, slot.y + slot.cell * .7, 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#b3c5b1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('✓', slot.labelX, slot.y + slot.cell * .7 + 5);
    }
    ctx.font = '500 13px "DM Sans", system-ui';
    ctx.textAlign = 'center';
    const shortNames = {
      shoe: 'Trainers', book: 'Book', camera: 'Camera', headphones: 'Headphones',
      shirt: 'Tee', bottle: 'Bottle', mug: 'Mug', keys: 'Keys', brush: 'Brush',
    };
    ctx.fillText(shortNames[piece.kind] ?? piece.name, slot.labelX, slot.labelY, slot.width - 7);
  }
  if (selected && aim && !closing) {
    const piece = game.puzzle.pieces.find(item => item.id === selected.id);
    const valid = E.canPlace(game, piece.id, aim.x, aim.y, selected.rotation);
    drawPiece(ctx, piece, selected.rotation, board.x + aim.x * board.cell,
      board.y + aim.y * board.cell, board.cell,
      { alpha: .58, shadow: false, invalid: !valid });
  }
  if (pointer?.moved && !aim && selected) {
    const piece = game.puzzle.pieces.find(item => item.id === selected.id);
    drawPiece(ctx, piece, selected.rotation, pointer.x - pointer.offsetX,
      pointer.y - pointer.offsetY, board.cell, { alpha: .92, lifted: true });
  }
  drawLid(ctx, board, closing);
  if (closing > .35 && !reducedMotion) {
    const burst = (closing - .35) / .65;
    const colors = ['#ed7868', '#e6b94c', '#63ada7', '#ab96d6'];
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.4;
      const radius = burst * (70 + i % 6 * 17);
      ctx.save();
      ctx.translate(width / 2 + Math.cos(angle) * radius,
        board.y + board.height / 2 + Math.sin(angle) * radius + burst * burst * 45);
      ctx.rotate(angle + burst * 3);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 1 - burst * .35;
      ctx.fillRect(-3, -5, 6, 10);
      ctx.restore();
    }
  }
}

function select(id) {
  const placement = game.placements[id];
  const rotation = selected?.id === id ? selected.rotation : placement?.rotation ?? 0;
  selected = { id, rotation };
  aim = null;
  const piece = game.puzzle.pieces.find(item => item.id === id);
  message(`${piece.name} selected. Rotate it, then choose a space.`);
  refresh();
}

function position(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function boardPoint(point) {
  const { board } = layout;
  const x = Math.floor((point.x - board.x) / board.cell);
  const y = Math.floor((point.y - board.y) / board.cell);
  return x >= 0 && y >= 0 && x < game.puzzle.cols && y < game.puzzle.rows ? { x, y } : null;
}

function stopDragScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = null;
}

function updateDrag(point) {
  pointer.x = point.x;
  pointer.y = point.y;
  const { board } = layout;
  const x = Math.round((point.x - pointer.offsetX - board.x) / board.cell);
  const y = Math.round((point.y - pointer.offsetY - board.y) / board.cell);
  aim = point.y < layout.trayTop - 18 ? { x, y } : null;
  draw();
}

function autoScrollDrag() {
  if (!pointer?.moved || pointer.panning) {
    stopDragScroll();
    return;
  }
  const edge = 64;
  let amount = 0;
  if (pointer.clientY < edge) amount = -8;
  else if (pointer.clientY > innerHeight - edge) amount = 8;
  if (amount) {
    window.scrollBy(0, amount);
    updateDrag(position({ clientX: pointer.clientX, clientY: pointer.clientY }));
  }
  scrollFrame = requestAnimationFrame(autoScrollDrag);
}

function hitItem(point) {
  const grid = boardPoint(point);
  if (grid) {
    for (const piece of [...game.puzzle.pieces].reverse()) {
      const placement = game.placements[piece.id];
      if (placement && E.cellsFor(piece, placement.rotation).some(([x, y]) =>
        x + placement.x === grid.x && y + placement.y === grid.y)) return piece.id;
    }
  }
  for (const slot of layout.slots) {
    if (game.placements[slot.id]) continue;
    const piece = game.puzzle.pieces.find(item => item.id === slot.id);
    const size = dimensions(piece, slot.rotation);
    if (point.x >= slot.x - 6 && point.x <= slot.x + size.cols * slot.cell + 6 &&
        point.y >= slot.y - 5 && point.y <= slot.y + size.rows * slot.cell + 14) return piece.id;
  }
  return null;
}

function placeSelected(target) {
  if (!selected || !target) return false;
  const { id, rotation } = selected;
  if (!E.place(game, id, target.x, target.y, rotation)) {
    sound('wrong');
    message('Almost. Give it a turn or find a different gap.');
    draw();
    return false;
  }
  selected = null;
  aim = null;
  sound('place');
  message(E.isComplete(game) ? 'Everything’s in. The lid is the moment of truth.' : 'Nice fit. What goes in next?');
  refresh();
  return true;
}

canvas.addEventListener('pointerdown', event => {
  if (closing || event.button !== 0 || !event.isPrimary) return;
  const point = position(event);
  const id = hitItem(point);
  const grid = boardPoint(point);
  const selectedPiece = selected && game.puzzle.pieces.find(piece => piece.id === selected.id);
  if (selectedPiece && aim && grid && E.canPlace(game, selected.id, aim.x, aim.y, selected.rotation) &&
      E.cellsFor(selectedPiece, selected.rotation).some(([x, y]) => x + aim.x === grid.x && y + aim.y === grid.y)) {
    placeSelected(aim);
    return;
  }
  if (selected && grid && id !== selected.id &&
      E.canPlace(game, selected.id, grid.x, grid.y, selected.rotation)) {
    placeSelected(grid);
    return;
  }
  const existing = id ? game.placements[id] : null;
  if (id && selected?.id === id && existing && selected.rotation !== existing.rotation && aim) {
    placeSelected(aim);
    return;
  }
  if (!id) {
    if (selected) {
      aim = boardPoint(point);
      placeSelected(aim);
    } else if (document.documentElement.scrollHeight > innerHeight) {
      pointer = { pointerId: event.pointerId, panning: true, clientY: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    }
    return;
  }
  select(id);
  const piece = game.puzzle.pieces.find(item => item.id === id);
  const placement = game.placements[id];
  const { board } = layout;
  const shape = dimensions(piece, selected.rotation);
  const offsetX = placement ? point.x - board.x - placement.x * board.cell : shape.cols * board.cell / 2;
  const offsetY = placement ? point.y - board.y - placement.y * board.cell : shape.rows * board.cell / 2;
  pointer = { id, pointerId: event.pointerId, startX: point.x, startY: point.y,
    x: point.x, y: point.y, clientX: event.clientX, clientY: event.clientY,
    offsetX, offsetY, moved: false };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', event => {
  if (!pointer || pointer.pointerId !== event.pointerId) return;
  if (pointer.panning) {
    window.scrollBy(0, pointer.clientY - event.clientY);
    pointer.clientY = event.clientY;
    return;
  }
  const point = position(event);
  pointer.moved ||= Math.hypot(point.x - pointer.startX, point.y - pointer.startY) > 7;
  pointer.clientX = event.clientX;
  pointer.clientY = event.clientY;
  if (pointer.moved) {
    updateDrag(point);
    if (scrollFrame === null) scrollFrame = requestAnimationFrame(autoScrollDrag);
  }
});

canvas.addEventListener('pointerup', event => {
  if (!pointer || pointer.pointerId !== event.pointerId) return;
  if (pointer.moved) {
    if (aim) placeSelected(aim);
    else if (position(event).y >= layout.trayTop - 18 && E.remove(game, pointer.id)) {
      selected = null;
      message('Back in the pile. Try a new arrangement.');
      refresh();
    }
  }
  pointer = null;
  stopDragScroll();
  draw();
});

canvas.addEventListener('pointercancel', () => {
  pointer = null;
  aim = null;
  stopDragScroll();
  draw();
});

function rotate() {
  if (!selected || closing) return;
  selected.rotation = (selected.rotation + 1) % 4;
  const placement = game.placements[selected.id];
  if (placement && !aim) aim = { x: placement.x, y: placement.y };
  sound('place');
  message('Turned. Find its little corner.');
  describeAim();
  resize();
}

canvas.addEventListener('keydown', event => {
  if (closing) return;
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); rotate(); return; }
  if (event.key === 'Escape') { selected = null; aim = null; refresh(); return; }
  if (!selected) return;
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    E.remove(game, selected.id);
    selected = null;
    aim = null;
    refresh();
    return;
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    aim ??= { x: 0, y: 0 };
    const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    aim.x = Math.max(0, Math.min(game.puzzle.cols - 1, aim.x + movement[0]));
    aim.y = Math.max(0, Math.min(game.puzzle.rows - 1, aim.y + movement[1]));
    describeAim();
    draw();
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    aim ??= { x: 0, y: 0 };
    placeSelected(aim);
  }
});

$('rotate').addEventListener('click', rotate);
$('undo').addEventListener('click', () => {
  E.undo(game);
  selected = null;
  aim = null;
  message('A little room to rethink.');
  refresh();
});
$('reset').addEventListener('click', () => {
  E.reset(game);
  selected = null;
  aim = null;
  message('Fresh start. Try the biggest thing first.');
  refresh();
});
$('hint').addEventListener('click', () => {
  const next = E.hint(game);
  if (!next) {
    message('This arrangement needs a rethink. Undo or move a packed item.');
    return;
  }
  selected = { id: next.id, rotation: next.rotation };
  aim = { x: next.x, y: next.y };
  const piece = game.puzzle.pieces.find(item => item.id === next.id);
  message(`Try ${piece.name.toLowerCase()} in the highlighted space. Tap it to pack.`);
  refresh();
  canvas.focus({ preventScroll: true });
});

function celebrate() {
  const key = game.puzzle.id;
  const seconds = Math.max(1, Math.round((performance.now() - started) / 1000));
  const old = completed[key];
  if (!old || game.moves < old.moves) completed[key] = { moves: game.moves, hints: game.hints, seconds };
  persist();
  $('winTitle').textContent = mode === 'daily' ? 'Today’s bag? Packed.' : level === E.LEVELS.length - 1 ? 'An expert overpacker.' : 'Room for everything.';
  $('winDetail').textContent = `${game.puzzle.pieces.length} things. ${game.moves} moves. ${game.hints ? game.hints + ' helping hand' + (game.hints === 1 ? '.' : 's.') : 'All you.'}`;
  $('next').textContent = mode === 'daily' ? 'Pack a trip bag' : level === E.LEVELS.length - 1 ? 'Pack them all again' : 'Pack the next bag';
  $('shareStatus').textContent = '';
  $('win').showModal();
}

$('close').addEventListener('click', () => {
  if (closing) return;
  if (!E.isComplete(game)) {
    const left = game.puzzle.pieces.length - Object.keys(game.placements).length;
    message(`The lid can wait. ${left} thing${left === 1 ? '' : 's'} still to pack.`);
    sound('wrong');
    return;
  }
  selected = null;
  aim = null;
  closing = .001;
  sound('win');
  refresh();
  const began = performance.now();
  const duration = reducedMotion ? 1 : 850;
  const animate = now => {
    closing = Math.min(1, (now - began) / duration);
    draw();
    if (closing < 1) frame = requestAnimationFrame(animate);
    else celebrate();
  };
  frame = requestAnimationFrame(animate);
});

$('next').addEventListener('click', () => loadPuzzle(mode === 'daily' ? level : (level + 1) % E.LEVELS.length));
$('again').addEventListener('click', () => loadPuzzle(level, mode, dailyDate));
$('daily').addEventListener('click', () => loadPuzzle(level, mode === 'daily' ? 'campaign' : 'daily'));
$('levels').addEventListener('click', () => {
  const grid = $('levelGrid');
  grid.replaceChildren();
  E.LEVELS.forEach((puzzle, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = index + 1;
    const label = document.createElement('small');
    label.textContent = completed[puzzle.id] ? 'Packed' : puzzle.pieces.length + ' things';
    button.append(label);
    button.classList.toggle('complete', Boolean(completed[puzzle.id]));
    button.setAttribute('aria-label', `Bag ${index + 1}, ${puzzle.title}`);
    button.addEventListener('click', () => {
      $('levelPicker').close();
      loadPuzzle(index);
    });
    grid.append(button);
  });
  $('levelPicker').showModal();
});
$('pickerClose').addEventListener('click', () => $('levelPicker').close());
$('sound').addEventListener('click', () => {
  muted = !muted;
  updateSound();
  persist();
  if (!muted) sound('place');
});

function updateSound() {
  $('sound').textContent = muted ? 'Sound off' : 'Sound on';
  $('sound').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
}

$('share').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.search = new URLSearchParams(mode === 'daily' ? { daily: game.puzzle.id } : { bag: String(level + 1) }).toString();
  url.hash = '';
  const text = `Will It Fit? I packed ${game.puzzle.pieces.length} things in ${game.moves} moves${game.hints ? '' : ' without a hint'}. Your turn!`;
  try {
    if (navigator.share) await navigator.share({ title: 'Will It Fit?', text, url: url.href });
    else {
      await navigator.clipboard.writeText(text + '\n' + url.href);
      $('shareStatus').textContent = 'Challenge copied. Send it to your favourite overpacker.';
    }
  } catch (error) {
    if (error.name !== 'AbortError') $('shareStatus').textContent = 'Share this page to challenge a friend.';
  }
});

window.addEventListener('resize', resize);
$('win').addEventListener('cancel', () => {
  closing = 0;
  refresh();
});
const params = new URLSearchParams(location.search);
if (/^([1-9]|1[0-2])$/.test(params.get('bag') ?? '')) level = Number(params.get('bag')) - 1;
let sharedDate;
const dailyId = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(params.get('daily') ?? '');
if (dailyId) {
  try {
    E.dailyPuzzle(dailyId[1]);
    sharedDate = dailyId[1];
  } catch { /* An invalid link opens a normal trip bag. */ }
}
updateSound();
loadPuzzle(level, sharedDate ? 'daily' : 'campaign', sharedDate);
