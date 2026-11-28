import { cellsFor } from './engine.mjs';

export const INK = '#22312d';

export function roundBox(ctx, x, y, w, h, r = 12) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function dimensions(piece, rotation = 0) {
  const cells = cellsFor(piece, rotation);
  return {
    cells,
    cols: Math.max(...cells.map(([x]) => x)) + 1,
    rows: Math.max(...cells.map(([, y]) => y)) + 1,
  };
}

function silhouette(ctx, cells, cell) {
  ctx.beginPath();
  for (const [x, y] of cells) ctx.rect(x * cell, y * cell, cell, cell);
}

function outline(ctx, cells, cell) {
  const occupied = new Set(cells.map(([x, y]) => x + ',' + y));
  ctx.beginPath();
  for (const [x, y] of cells) {
    if (!occupied.has(x + ',' + (y - 1))) {
      ctx.moveTo(x * cell, y * cell);
      ctx.lineTo((x + 1) * cell, y * cell);
    }
    if (!occupied.has((x + 1) + ',' + y)) {
      ctx.moveTo((x + 1) * cell, y * cell);
      ctx.lineTo((x + 1) * cell, (y + 1) * cell);
    }
    if (!occupied.has(x + ',' + (y + 1))) {
      ctx.moveTo((x + 1) * cell, (y + 1) * cell);
      ctx.lineTo(x * cell, (y + 1) * cell);
    }
    if (!occupied.has((x - 1) + ',' + y)) {
      ctx.moveTo(x * cell, (y + 1) * cell);
      ctx.lineTo(x * cell, y * cell);
    }
  }
  ctx.stroke();
}

function details(ctx, piece, cells, cell, cols, rows) {
  const unit = Math.min(cell, 48);
  ctx.strokeStyle = 'rgba(34,49,45,.48)';
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.lineWidth = Math.max(1.5, cell * .045);
  ctx.lineCap = 'round';
  const x = cols * cell / 2;
  const y = rows * cell / 2;
  if (piece.kind === 'book') {
    ctx.fillRect(cols * cell - cell * .18, 7, cell * .1, rows * cell - 14);
    ctx.fillRect(cell * .14, cell * .25, Math.max(12, cols * cell - cell * .55), cell * .09);
    ctx.fillRect(cell * .14, cell * .48, Math.max(8, cols * cell - cell * .8), cell * .055);
  } else if (piece.kind === 'camera') {
    ctx.beginPath();
    ctx.arc(x, y, unit * .3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, unit * .15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillRect(cell * .16, cell * .16, cell * .2, cell * .12);
  } else if (piece.kind === 'shoe') {
    const [cx, cy] = cells[Math.floor(cells.length / 2)];
    for (let n = 0; n < 3; n++) {
      ctx.beginPath();
      ctx.moveTo(cx * cell + cell * .2, cy * cell + cell * (.2 + n * .2));
      ctx.lineTo(cx * cell + cell * .75, cy * cell + cell * (.35 + n * .2));
      ctx.stroke();
    }
  } else if (piece.kind === 'bottle') {
    for (const [cx, cy] of cells) {
      ctx.fillRect(cx * cell + cell * .18, cy * cell + cell * .44, cell * .64, cell * .17);
    }
  } else if (piece.kind === 'shirt') {
    ctx.beginPath();
    ctx.arc(x, cell * .1, cell * .26, 0, Math.PI);
    ctx.stroke();
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x, cell * .5);
    ctx.lineTo(x, rows * cell - 8);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (piece.kind === 'headphones') {
    for (const [cx, cy] of [cells[0], cells[cells.length - 1]]) {
      roundBox(ctx, cx * cell + cell * .22, cy * cell + cell * .2, cell * .56, cell * .6, 5);
      ctx.fill();
      ctx.stroke();
    }
  } else if (piece.kind === 'mug') {
    ctx.beginPath();
    ctx.ellipse(cell * .5, cell * .32, cell * .3, cell * .12, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#805342';
    ctx.fill();
    ctx.stroke();
  } else {
    const [cx, cy] = cells[0];
    ctx.beginPath();
    ctx.arc(cx * cell + cell * .5, cy * cell + cell * .5, cell * .2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx * cell + cell * .68, cy * cell + cell * .5);
    ctx.lineTo(cols * cell - cell * .15, cy * cell + cell * .5);
    ctx.stroke();
  }
}

export function drawPiece(ctx, piece, rotation, x, y, cell, options = {}) {
  const { cells, cols, rows } = dimensions(piece, rotation);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = options.alpha ?? 1;
  if (options.shadow !== false) {
    ctx.save();
    ctx.translate(0, options.lifted ? 9 : 3);
    silhouette(ctx, cells, cell);
    ctx.fillStyle = 'rgba(34,49,45,.2)';
    ctx.fill();
    ctx.restore();
  }
  silhouette(ctx, cells, cell);
  ctx.fillStyle = options.invalid ? '#e9a09b' : piece.color;
  ctx.fill();
  ctx.save();
  silhouette(ctx, cells, cell);
  ctx.clip();
  details(ctx, piece, cells, cell, cols, rows);
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  for (const [cx, cy] of cells) ctx.fillRect(cx * cell + 3, cy * cell + 3, cell - 6, 3);
  ctx.restore();
  ctx.strokeStyle = options.selected ? '#fffdf6' : INK;
  ctx.lineWidth = options.selected ? 4 : 2;
  ctx.lineJoin = 'round';
  outline(ctx, cells, cell);
  ctx.restore();
}

export function drawSuitcase(ctx, board, puzzle) {
  const { x, y, cell, width, height } = board;
  ctx.save();
  ctx.fillStyle = '#c47a5b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  roundBox(ctx, x + width / 2 - 31, y - 32, 62, 27, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8d8b2';
  roundBox(ctx, x - 12, y - 12, width + 24, height + 26, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8c49d';
  roundBox(ctx, x - 4, y - 4, width + 8, height + 8, 7);
  ctx.fill();
  ctx.stroke();
  for (let row = 0; row < puzzle.rows; row++) {
    for (let col = 0; col < puzzle.cols; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#efd4b3' : '#f4ddbf';
      ctx.fillRect(x + col * cell + 1, y + row * cell + 1, cell - 2, cell - 2);
      ctx.fillStyle = '#c8a88a';
      ctx.beginPath();
      ctx.arc(x + (col + .5) * cell, y + (row + .5) * cell, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const [col, row] of puzzle.blocked) {
    ctx.fillStyle = '#9c7f69';
    ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
    ctx.strokeStyle = '#775f51';
    ctx.lineWidth = 1;
    for (let n = 4; n < cell; n += 8) {
      ctx.beginPath();
      ctx.moveTo(x + col * cell + n, y + row * cell);
      ctx.lineTo(x + col * cell, y + row * cell + n);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#324b43';
  for (const left of [x + 10, x + width - 28]) {
    roundBox(ctx, left, y + height + 6, 18, 10, 3);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLid(ctx, board, progress) {
  if (!progress) return;
  ctx.save();
  const { x, y, width, height } = board;
  ctx.translate(x + width / 2, y + height / 2);
  const scale = .18 + .82 * progress;
  ctx.scale(1, scale);
  ctx.globalAlpha = Math.min(1, progress * 2);
  ctx.fillStyle = '#ed866a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  roundBox(ctx, -width / 2 - 12, -height / 2 - 12, width + 24, height + 26, 16);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#c65c49';
  ctx.lineWidth = 5;
  for (const fraction of [-.28, .28]) {
    ctx.beginPath();
    ctx.moveTo(width * fraction, -height / 2 + 14);
    ctx.lineTo(width * fraction, height / 2 - 14);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff7d3';
  ctx.rotate(-.12);
  roundBox(ctx, -48, -26, 96, 52, 8);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = 'bold 16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('IT FITS!', 0, 6);
  ctx.restore();
}
