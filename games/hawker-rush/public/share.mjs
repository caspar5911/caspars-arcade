// 📸 A results picture to share (WhatsApp, Instagram…): a cute card in the player's theme, with Mochi the cat, the
// day, the stars, the takings and a few highlights. Drawn on a canvas; shared as an image where the phone allows it,
// otherwise saved as a file.

const W = 720, H = 900;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** An SVG string (as the game draws them) as an image the canvas can draw. */
function svgImage(markup) {
  const withNs = markup.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([withNs], { type: 'image/svg+xml' }));
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * The picture, as a PNG blob. `card`: { title, stars (null for a speed run), big (money or time), lines: [label, value][],
 * cat (svg markup), colours: { ground, panel, ink, muted, accent, line, glow } }.
 */
export async function resultPicture(card) {
  try {
    await document.fonts?.ready;
  } catch {
    // (the system font, then)
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const col = card.colours;
  const font = (size, weight = 700) => `${weight} ${size}px Fredoka, "Baloo 2", system-ui, sans-serif`;
  // the background: the theme's colour, a soft glow, little dots
  g.fillStyle = col.ground;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 0, 20, W / 2, 0, 700);
  glow.addColorStop(0, col.glow);
  glow.addColorStop(1, col.ground); // (into the background, not through grey)
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.fillStyle = col.line;
  g.globalAlpha = .35;
  for (let y = 30; y < H; y += 60) for (let x = (y / 60) % 2 ? 30 : 60; x < W; x += 60) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // an awning across the top
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? '#fffaf0' : col.accent;
    g.beginPath();
    g.moveTo(i * 60, 0);
    g.lineTo(i * 60 + 60, 0);
    g.lineTo(i * 60 + 60, 44);
    g.quadraticCurveTo(i * 60 + 30, 72, i * 60, 44);
    g.closePath();
    g.fill();
  }
  // the card, as tall as what's on it
  const lines = card.lines.slice(0, 4);
  const dishes = (await Promise.all((card.dishes ?? []).slice(0, 5).map(svgImage))).filter(Boolean);
  const bottom = 320 + (card.stars ? 80 : 0) + 96 + 30 + 56 * lines.length + (dishes.length ? 120 : 0) + 50;
  g.fillStyle = col.line;
  roundRect(g, 50, 128, W - 100, bottom - 120, 36);
  g.fill();
  g.fillStyle = col.panel;
  roundRect(g, 50, 120, W - 100, bottom - 120, 36);
  g.fill();
  // Mochi
  const cat = card.cat ? await svgImage(card.cat) : null;
  if (cat) g.drawImage(cat, W / 2 - 80, 72, 160, 160);
  g.textAlign = 'center';
  g.fillStyle = col.ink;
  g.font = font(30, 600);
  g.fillText('Hawker Rush', W / 2, 262);
  g.font = font(48);
  g.fillText(card.title, W / 2, 320);
  let y = 320;
  if (card.stars) {
    g.font = font(64);
    g.fillStyle = '#f5b324';
    g.fillText(card.stars, W / 2, y += 80);
  }
  g.fillStyle = col.accent;
  g.font = font(76);
  g.fillText(card.big, W / 2, y += 96);
  // the highlights
  g.font = font(30, 600);
  y += 30;
  for (const [label, value] of lines) {
    y += 56;
    g.textAlign = 'left';
    g.fillStyle = col.muted;
    g.fillText(label, 110, y);
    g.textAlign = 'right';
    g.fillStyle = col.ink;
    g.fillText(String(value), W - 110, y);
  }
  // the dishes served most, in a row
  if (dishes.length) {
    const size = 92, gap = 14, x0 = W / 2 - (dishes.length * size + (dishes.length - 1) * gap) / 2;
    dishes.forEach((img, k) => g.drawImage(img, x0 + k * (size + gap), y + 26, size, size * .9));
  }
  // where to play
  g.textAlign = 'center';
  g.fillStyle = col.ink;
  g.font = font(28, 600);
  g.fillText('Can you beat it? Play free at', W / 2, H - 46);
  g.font = font(26, 500);
  g.fillStyle = col.muted;
  g.fillText(card.link, W / 2, H - 14);
  return new Promise(resolve => c.toBlob(resolve, 'image/png'));
}

/** Share the picture (the phone's share sheet), or save it when sharing files isn't possible. 'shared' | 'saved' | null */
export async function sharePicture(blob, text) {
  if (!blob) return null;
  const file = new File([blob], 'hawker-rush.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (error) {
    if (error?.name === 'AbortError') return null; // (the player closed the share sheet)
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hawker-rush.png';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
