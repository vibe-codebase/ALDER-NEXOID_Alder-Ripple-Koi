// Store icon, adaptive-icon layers and splash, painted with the game's own procedural art.
import * as A from '../src/game/art';
import type { KoiColor } from '../src/game/levels';

const P = A.PALETTES[0];
const R = 4;

function koi(g: CanvasRenderingContext2D, c: KoiColor, x: number, y: number, angle: number, scale: number, seed: number, bend = 0.25) {
  const t = A.koiTextures(c, R, seed);
  const w = t.body.width, h = t.body.height;
  // draw the body in slices so it curves like a swimming fish
  const slices = 24;
  g.save();
  g.translate(x, y); g.rotate(angle); g.scale(scale / R, scale / R);
  // shadow
  g.globalAlpha = 0.25; g.filter = 'blur(6px) brightness(0)';
  for (let i = 0; i < slices; i++) {
    const sx = (w / slices) * i, k = 1 - i / slices, off = Math.sin(k * 2.2) * bend * h * k;
    g.drawImage(t.body, sx, 0, w / slices + 1, h, sx - w / 2 + 10 * R, -h / 2 + off + 16 * R, w / slices + 1, h);
  }
  g.globalAlpha = 1; g.filter = 'none';
  for (let i = 0; i < slices; i++) {
    const sx = (w / slices) * i, k = 1 - i / slices, off = Math.sin(k * 2.2) * bend * h * k;
    g.drawImage(t.body, sx, 0, w / slices + 1, h, sx - w / 2, -h / 2 + off, w / slices + 1, h);
  }
  for (const s of [-1, 1]) {
    g.save(); g.translate(w * 0.18, s * h * 0.2); g.rotate(Math.PI + s * 0.5); g.scale(1, -s); g.drawImage(t.fin, 0, 0); g.restore();
  }
  g.restore();
}

function water(g: CanvasRenderingContext2D, W: number, H: number, round: number) {
  const pond = A.pondTexture(P, W / 2.2, H / 2.2, 0, 2.2, 5);
  g.save();
  g.beginPath(); g.roundRect(0, 0, W, H, round); g.clip();
  g.drawImage(pond, 0, 0, W, H);
  g.restore();
}

function rings(g: CanvasRenderingContext2D, cx: number, cy: number, rads: number[], alpha: number) {
  rads.forEach((r, i) => { g.strokeStyle = `rgba(255,246,220,${alpha * (1 - i / rads.length)})`; g.lineWidth = 6 - i; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); });
}

function emblem(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const enso = A.ensoTexture('#c8402b', 120, R, 21);
  const ew = (enso.width / R) * s;
  g.drawImage(enso, cx - ew / 2, cy - ew / 2, ew, ew);
  rings(g, cx, cy, [36 * s, 62 * s, 88 * s], 0.5);
  g.fillStyle = 'rgba(255,246,220,0.9)'; g.beginPath(); g.arc(cx, cy, 6 * s, 0, Math.PI * 2); g.fill();
  // two koi chasing each other round the ring, yin-yang style
  koi(g, 'kohaku', cx - 62 * s, cy + 18 * s, -Math.PI / 2 - 0.25, 2.3 * s, 3, 0.45);
  koi(g, 'ogon', cx + 62 * s, cy - 18 * s, Math.PI / 2 - 0.25, 2.3 * s, 9, 0.45);
}

export function icon() {
  const { c, g } = A.canvas(1024, 1024);
  water(g, 1024, 1024, 0);
  emblem(g, 512, 512, 1.9);
  return c;
}

export function adaptive() {
  const { c, g } = A.canvas(1024, 1024);
  emblem(g, 512, 512, 1.32);
  return c;
}

export function adaptiveBg() {
  const { c, g } = A.canvas(1024, 1024);
  water(g, 1024, 1024, 0);
  return c;
}

export function splash() {
  const W = 1284, H = 2778;
  const { c, g } = A.canvas(W, H);
  g.drawImage(A.paperTexture(P, W / 2, H / 2, 2, 4), 0, 0, W, H);
  const pw = W * 0.76, ph = pw * 1.25, px = (W - pw) / 2, py = H * 0.4;
  g.save(); g.shadowColor = 'rgba(31,29,26,0.3)'; g.shadowBlur = 40; g.shadowOffsetY = 18;
  g.fillStyle = '#2f6c63'; g.beginPath(); g.roundRect(px, py, pw, ph, 60); g.fill(); g.restore();
  g.save(); g.translate(px, py); water(g, pw, ph, 60); g.restore();
  emblem(g, W / 2, py + ph / 2, 2.1);
  g.textAlign = 'center';
  g.fillStyle = '#1f1d1a';
  g.font = '800 210px "Shippori Mincho", Georgia, serif';
  g.fillText('Ripple Koi', W / 2, H * 0.3);
  g.font = '700 58px "Zen Maru Gothic", sans-serif'; g.fillStyle = '#c8402b'; try { g.letterSpacing = '34px'; } catch { /* */ } g.fillText('ALDER', W / 2 + 17, H * 0.3 - 230); try { g.letterSpacing = '0px'; } catch { /* */ }
  g.fillStyle = '#c8402b';
  g.fillStyle = '#c8402b';
  g.font = '800 64px "Shippori Mincho", Georgia, serif';
  g.fillText('· drop a ripple, guide them home ·', W / 2, H * 0.3 + 110);
  return c;
}

/** The Play Store feature graphic: the pond with two koi circling the ensō on the right, the name on rice paper at the left. */
export function feature() {
  const W = 1024, H = 500;
  const { c, g } = A.canvas(W, H);
  water(g, W, H, 0);
  emblem(g, 800, 250, 1.0);
  const paper = A.paperTexture(P, 300, H / 2, 2, 4);
  g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(560, 0); g.bezierCurveTo(510, 160, 620, 330, 540, H); g.lineTo(0, H); g.closePath(); g.clip();
  g.drawImage(paper, 0, 0, 600, H); g.restore();
  g.save(); g.strokeStyle = 'rgba(31,29,26,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(560, 0); g.bezierCurveTo(510, 160, 620, 330, 540, H); g.stroke(); g.restore();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '700 22px "Zen Maru Gothic", sans-serif'; g.fillStyle = '#c8402b'; try { g.letterSpacing = '13px'; } catch { /* */ } g.fillText('ALDER', 58, 116); try { g.letterSpacing = '0px'; } catch { /* */ }
  g.fillStyle = '#1f1d1a'; g.font = '800 90px "Shippori Mincho", Georgia, serif'; g.fillText('Ripple Koi', 50, 226);
  g.fillStyle = '#c8402b'; g.fillRect(58, 256, 52, 3);
  g.fillStyle = '#1f1d1a'; g.font = '700 27px "Zen Maru Gothic", sans-serif'; g.fillText('Drop a ripple, guide them home.', 58, 304);
  g.fillStyle = 'rgba(31,29,26,0.78)'; g.font = '500 19px "Zen Maru Gothic", sans-serif'; g.fillText('24 ponds · currents, ensō and koto music', 58, 342);
  return c;
}

(window as unknown as { brand: unknown }).brand = { icon, adaptive, adaptiveBg, splash, feature };
