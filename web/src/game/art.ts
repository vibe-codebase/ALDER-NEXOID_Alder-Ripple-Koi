/**
 * Ripple Koi art: sumi-e ink and wash on rice paper, painted procedurally onto canvases at the
 * device's pixel density. No bitmaps ship with the game.
 */
import type { KoiColor } from './levels';

export type Palette = {
  paper: [string, string];
  waterDeep: string; waterMid: string; waterLight: string;
  rim: string; rimInk: string; moss: string;
  current: string; light: string; accent: string; moon?: boolean;
};

export const PALETTES: Palette[] = [
  { paper: ['#f3ead8', '#e6d8bd'], waterDeep: '#1f4c47', waterMid: '#2f6c63', waterLight: '#5f9a88', rim: '#8d8b80', rimInk: '#3b3a36', moss: '#6f8a4f', current: '#cfe8dc', light: '#fff6dc', accent: '#c8402b' },
  { paper: ['#f1e9da', '#ddd3bf'], waterDeep: '#183f4f', waterMid: '#285e6c', waterLight: '#5b93a0', rim: '#857f78', rimInk: '#34312e', moss: '#5f7f55', current: '#d6eef2', light: '#fff1d6', accent: '#b5462b' },
  { paper: ['#e9e3d6', '#cfc7b6'], waterDeep: '#121a33', waterMid: '#1f2c4f', waterLight: '#4a5c88', rim: '#6f7180', rimInk: '#24252e', moss: '#4c6a5c', current: '#d7e0f7', light: '#f4f2ff', accent: '#a83a35', moon: true },
];

export const KOI_INK: Record<KoiColor, { ring: string; body: string; patch: string; fin: string }> = {
  kohaku: { ring: '#c8402b', body: '#fbf6ec', patch: '#d8452f', fin: 'rgba(255,248,236,0.75)' },
  ogon: { ring: '#c99420', body: '#f6c552', patch: '#e9a92a', fin: 'rgba(255,226,150,0.7)' },
  sumi: { ring: '#26262b', body: '#2b2b31', patch: '#121216', fin: 'rgba(205,208,225,0.55)' },
};

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return { c, g: c.getContext('2d')! };
}

export function rng(seed: number) {
  let s = Math.imul(seed | 0, 2654435761) >>> 0;
  s ^= s >>> 15; s = Math.imul(s, 0x2c1b3c6d) >>> 0; s ^= s >>> 12;
  s = s >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Rice paper with fibres and faint tea stains; covers the whole screen. */
export function paperTexture(p: Palette, w: number, h: number, r: number, seed: number) {
  const { c, g } = canvas(w * r, h * r);
  g.scale(r, r);
  const grd = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h / 2, Math.max(w, h) * 0.8);
  grd.addColorStop(0, p.paper[0]); grd.addColorStop(1, p.paper[1]);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const rand = rng(seed);
  for (let i = 0; i < 9; i++) {
    const x = rand() * w, y = rand() * h, rad = 40 + rand() * 120;
    const s = g.createRadialGradient(x, y, 0, x, y, rad);
    s.addColorStop(0, 'rgba(160,130,90,0.06)'); s.addColorStop(1, 'rgba(160,130,90,0)');
    g.fillStyle = s; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.lineCap = 'round';
  for (let i = 0; i < (w * h) / 260; i++) {
    const x = rand() * w, y = rand() * h, len = 4 + rand() * 18, a = rand() * Math.PI;
    g.strokeStyle = rand() < 0.5 ? 'rgba(120,95,60,0.08)' : 'rgba(255,255,255,0.22)';
    g.lineWidth = 0.4 + rand() * 0.5;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.4) * len * 0.5, y + Math.sin(a + 0.4) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  return c;
}

/** Wobbly closed outline used for the pond, stones and pads so nothing looks machine-drawn. */
function blob(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rand: () => number, wob = 0.08, pts = 18) {
  const ps: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const k = 1 + (rand() - 0.5) * wob * 2;
    ps.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  g.beginPath();
  for (let i = 0; i < pts; i++) {
    const [x0, y0] = ps[i], [x1, y1] = ps[(i + 1) % pts];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(x0, y0, mx, my);
  }
  const [x0, y0] = ps[0], [x1, y1] = ps[1];
  g.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  g.closePath();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  g.beginPath();
  g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath();
}

/** The pond itself: wash-painted water inside a rim of ink-outlined stones. `pad` is the paper margin drawn around it. */
export function pondTexture(p: Palette, fw: number, fh: number, pad: number, r: number, seed: number) {
  const W = fw + pad * 2, H = fh + pad * 2;
  const { c, g } = canvas(W * r, H * r);
  g.scale(r, r);
  const rand = rng(seed);
  // water: layered washes, darker toward the rim
  g.save();
  roundRect(g, pad + 4, pad + 4, fw - 8, fh - 8, 46);
  g.clip();
  const wgrd = g.createRadialGradient(W / 2, H * 0.42, 30, W / 2, H / 2, Math.max(fw, fh) * 0.7);
  wgrd.addColorStop(0, p.waterLight); wgrd.addColorStop(0.45, p.waterMid); wgrd.addColorStop(1, p.waterDeep);
  g.fillStyle = wgrd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const x = pad + rand() * fw, y = pad + rand() * fh, rad = 30 + rand() * 90;
    const s = g.createRadialGradient(x, y, 0, x, y, rad);
    const light = rand() < 0.45;
    s.addColorStop(0, light ? hexA(p.waterLight, 0.22) : hexA(p.waterDeep, 0.25));
    s.addColorStop(1, light ? hexA(p.waterLight, 0) : hexA(p.waterDeep, 0));
    g.fillStyle = s; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // pebbles on the pond floor
  for (let i = 0; i < 70; i++) {
    const x = pad + rand() * fw, y = pad + rand() * fh;
    g.fillStyle = hexA(rand() < 0.5 ? p.waterDeep : p.waterLight, 0.18 + rand() * 0.12);
    blob(g, x, y, 2 + rand() * 6, 1.5 + rand() * 4, rand, 0.25, 8); g.fill();
  }
  if (p.moon) {
    const mx = pad + fw * 0.7, my = pad + fh * 0.3;
    const m = g.createRadialGradient(mx, my, 0, mx, my, 120);
    m.addColorStop(0, 'rgba(240,240,255,0.32)'); m.addColorStop(0.25, 'rgba(220,226,255,0.14)'); m.addColorStop(1, 'rgba(220,226,255,0)');
    g.fillStyle = m; g.fillRect(mx - 120, my - 120, 240, 240);
    // the moon's reflection, broken up by the water surface
    g.save(); g.filter = 'blur(2px)';
    for (let i = -6; i <= 6; i++) {
      const y = my + i * 4.2, half = Math.sqrt(Math.max(0, 26 * 26 - (i * 4.2) ** 2)) * (0.85 + rand() * 0.3);
      g.strokeStyle = `rgba(250,250,255,${0.42 - Math.abs(i) * 0.03})`; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(mx - half + rand() * 4, y); g.lineTo(mx + half - rand() * 4, y); g.stroke();
    }
    g.restore();
  }
  // inner edge shadow
  g.lineWidth = 26; g.strokeStyle = hexA(p.waterDeep, 0.55);
  g.filter = 'blur(10px)';
  roundRect(g, pad + 4, pad + 4, fw - 8, fh - 8, 46); g.stroke();
  g.filter = 'none';
  g.restore();

  // stone rim
  const perim: [number, number][] = [];
  const step = 15;
  for (let x = pad + 30; x <= pad + fw - 30; x += step) { perim.push([x, pad + 2]); perim.push([x, pad + fh - 2]); }
  for (let y = pad + 30; y <= pad + fh - 30; y += step) { perim.push([pad + 2, y]); perim.push([pad + fw - 2, y]); }
  for (const [cx, cy] of [[pad + 18, pad + 18], [pad + fw - 18, pad + 18], [pad + 18, pad + fh - 18], [pad + fw - 18, pad + fh - 18]]) perim.push([cx, cy]);
  for (const [x, y] of perim) {
    const jx = x + (rand() - 0.5) * 6, jy = y + (rand() - 0.5) * 6, rx = 9 + rand() * 7, ry = 7 + rand() * 6;
    g.fillStyle = 'rgba(40,35,30,0.18)';
    blob(g, jx + 1.5, jy + 2.5, rx, ry, rand, 0.15, 10); g.fill();
    const sg = g.createLinearGradient(jx - rx, jy - ry, jx + rx, jy + ry);
    sg.addColorStop(0, '#b9b5a8'); sg.addColorStop(1, p.rim);
    g.fillStyle = sg;
    blob(g, jx, jy, rx, ry, rand, 0.15, 10); g.fill();
    g.strokeStyle = hexA(p.rimInk, 0.7); g.lineWidth = 0.9 + rand() * 0.6;
    g.stroke();
    if (rand() < 0.4) { g.fillStyle = hexA(p.moss, 0.55); blob(g, jx - rx * 0.3, jy - ry * 0.4, rx * 0.4, ry * 0.3, rand, 0.3, 8); g.fill(); }
  }
  return c;
}

/** A stepping stone seen from above, with its underwater shadow and a little moss. */
export function stoneTexture(p: Palette, rad: number, r: number, seed: number) {
  const size = rad * 2 + 24;
  const { c, g } = canvas(size * r, size * r);
  g.scale(r, r);
  const rand = rng(seed);
  const cx = size / 2, cy = size / 2;
  g.fillStyle = 'rgba(5,20,20,0.35)';
  g.filter = 'blur(4px)';
  blob(g, cx + 3, cy + 5, rad * 1.02, rad * 0.98, rand, 0.06); g.fill();
  g.filter = 'none';
  const sg = g.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, rad * 0.1, cx, cy, rad * 1.1);
  sg.addColorStop(0, '#d6d2c6'); sg.addColorStop(0.6, '#a19d92'); sg.addColorStop(1, p.rim);
  g.fillStyle = sg;
  blob(g, cx, cy, rad, rad * 0.94, rand, 0.07); g.fill();
  g.strokeStyle = hexA(p.rimInk, 0.85); g.lineWidth = 1.6; g.lineJoin = 'round';
  g.stroke();
  // dry-brush texture strokes
  g.strokeStyle = hexA(p.rimInk, 0.22); g.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2, d = rand() * rad * 0.6;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 3, x + 10 + rand() * 6, y + rand() * 4); g.stroke();
  }
  g.fillStyle = hexA(p.moss, 0.7);
  for (let i = 0; i < 5; i++) { const a = -2.2 + rand() * 1.4; blob(g, cx + Math.cos(a) * rad * 0.62, cy + Math.sin(a) * rad * 0.62, 2 + rand() * 4, 1.5 + rand() * 3, rand, 0.3, 8); g.fill(); }
  return c;
}

/** An ensō: one confident brush circle, thick where the brush lands and dry where it lifts. */
export function ensoTexture(color: string, rad: number, r: number, seed: number) {
  const size = rad * 2 + 30;
  const { c, g } = canvas(size * r, size * r);
  g.scale(r, r);
  const rand = rng(seed);
  const cx = size / 2, cy = size / 2;
  const start = -Math.PI * 0.62 + rand() * 0.3, sweep = Math.PI * 1.86;
  const steps = Math.max(140, Math.round(rad * 5));
  const dark = parseInt(color.slice(1, 3), 16) < 80;
  if (dark) {
    // ink on dark water needs a pale halo to read
    g.save(); g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(235,235,245,0.55)'; g.lineWidth = 9;
    g.beginPath(); g.arc(cx, cy, rad, start, start + sweep); g.stroke(); g.restore();
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const a = start + sweep * t;
      const wob = Math.sin(t * 9 + pass) * 0.8;
      const rr = rad + wob + (pass - 1) * 1.6;
      const w = (t < 0.08 ? 2 + t * 70 : 7.6 - t * 5.2) * (0.75 + pass * 0.12);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      g.fillStyle = hexA(color, (t > 0.8 ? 0.32 * (1 - (t - 0.8) * 3.5) : 0.32) * (pass === 1 ? 1.6 : 0.8));
      if (t > 0.75 && rand() < (t - 0.75) * 2.4) continue; // dry brush breaks up at the end
      g.beginPath(); g.ellipse(x, y, Math.max(0.6, w / 2), Math.max(0.5, w / 2.6), a, 0, Math.PI * 2); g.fill();
    }
  }
  // a soft wash inside the ring
  const wash = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
  wash.addColorStop(0, hexA(color, 0.16)); wash.addColorStop(1, hexA(color, 0.03));
  g.fillStyle = wash; g.beginPath(); g.arc(cx, cy, rad - 2, 0, Math.PI * 2); g.fill();
  return c;
}

/** A floating lily pad with a notch and radial veins. Purely decorative. */
export function lilyTexture(rad: number, r: number, seed: number, flower: string | null) {
  const size = rad * 2 + 16;
  const { c, g } = canvas(size * r, size * r);
  g.scale(r, r);
  const rand = rng(seed);
  const cx = size / 2, cy = size / 2, notch = 0.28, rot = rand() * Math.PI * 2;
  g.translate(cx, cy); g.rotate(rot);
  g.fillStyle = 'rgba(0,20,20,0.28)';
  g.beginPath(); g.moveTo(3, 4); g.arc(3, 4, rad, notch, Math.PI * 2 - notch); g.closePath(); g.fill();
  const lg = g.createRadialGradient(-rad * 0.3, -rad * 0.3, 2, 0, 0, rad);
  lg.addColorStop(0, '#9fbf72'); lg.addColorStop(1, '#4f7a45');
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rad, notch, Math.PI * 2 - notch); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,50,25,0.75)'; g.lineWidth = 1.1; g.stroke();
  g.strokeStyle = 'rgba(220,240,190,0.35)'; g.lineWidth = 0.7;
  for (let i = 1; i < 9; i++) { const a = notch + (i / 9) * (Math.PI * 2 - notch * 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * rad * 0.9, Math.sin(a) * rad * 0.9); g.stroke(); }
  g.rotate(-rot);
  if (flower) {
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + k * 0.45;
        const pr = rad * (0.55 - k * 0.15);
        g.fillStyle = k ? '#fff7f2' : flower;
        g.beginPath(); g.ellipse(Math.cos(a) * pr * 0.5, Math.sin(a) * pr * 0.5 - 2, pr * 0.22, pr * 0.5, a + Math.PI / 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(120,50,60,0.35)'; g.lineWidth = 0.6; g.stroke();
      }
    g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(0, -2, rad * 0.12, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/**
 * Koi body, drawn head-right along x so a Rope can bend it. Returns the body (with tail fin) and a pectoral fin.
 * Patterns are seeded so each fish is an individual.
 */
export const KOI_LEN = 46;
export function koiTextures(color: KoiColor, r: number, seed: number) {
  const ink = KOI_INK[color];
  const L = KOI_LEN, Wd = 18, tail = 14;
  const { c, g } = canvas((L + tail) * r, Wd * 1.6 * r);
  g.scale(r, r);
  const rand = rng(seed);
  const cy = Wd * 0.8;
  const hx = tail + L; // head tip x
  // tail fin: translucent fan
  g.fillStyle = ink.fin;
  g.beginPath(); g.moveTo(tail + 4, cy);
  g.quadraticCurveTo(tail * 0.4, cy - Wd * 0.75, 0, cy - Wd * 0.6);
  g.quadraticCurveTo(tail * 0.5, cy, 0, cy + Wd * 0.6);
  g.quadraticCurveTo(tail * 0.4, cy + Wd * 0.75, tail + 4, cy);
  g.fill();
  g.strokeStyle = 'rgba(40,30,30,0.25)'; g.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(tail + 2, cy); g.lineTo(2, cy + i * Wd * 0.22); g.stroke(); }
  // body outline: plump front, tapering to the tail
  const body = () => {
    g.beginPath();
    g.moveTo(hx, cy);
    g.bezierCurveTo(hx - 1, cy - Wd * 0.42, hx - L * 0.35, cy - Wd * 0.52, hx - L * 0.55, cy - Wd * 0.42);
    g.bezierCurveTo(hx - L * 0.8, cy - Wd * 0.28, tail + 4, cy - Wd * 0.1, tail + 2, cy);
    g.bezierCurveTo(tail + 4, cy + Wd * 0.1, hx - L * 0.8, cy + Wd * 0.28, hx - L * 0.55, cy + Wd * 0.42);
    g.bezierCurveTo(hx - L * 0.35, cy + Wd * 0.52, hx - 1, cy + Wd * 0.42, hx, cy);
    g.closePath();
  };
  body();
  const bg = g.createLinearGradient(0, cy - Wd * 0.5, 0, cy + Wd * 0.5);
  bg.addColorStop(0, ink.body); bg.addColorStop(0.5, color === 'sumi' ? '#3a3a42' : '#ffffff'); bg.addColorStop(1, ink.body);
  g.fillStyle = color === 'ogon' ? (() => { const og = g.createLinearGradient(tail, 0, hx, 0); og.addColorStop(0, '#e9a92a'); og.addColorStop(0.6, '#f8cf63'); og.addColorStop(1, '#ffe596'); return og; })() : bg;
  g.fill();
  // patches, clipped to the body
  g.save(); body(); g.clip();
  const patches = color === 'kohaku' ? 3 + Math.floor(rand() * 2) : color === 'sumi' ? 4 : 0;
  for (let i = 0; i < patches; i++) {
    const px = tail + 8 + rand() * (L - 10), py = cy + (rand() - 0.5) * Wd * 0.6;
    g.fillStyle = color === 'sumi' ? 'rgba(240,240,245,0.85)' : ink.patch;
    const rx = color === 'sumi' ? 2 + rand() * 3 : 5 + rand() * 7;
    blob(g, px, py, rx, rx * (0.6 + rand() * 0.4), rand, 0.25, 10); g.fill();
  }
  if (color === 'kohaku') { g.fillStyle = ink.patch; blob(g, hx - 7, cy, 6, 5, rand, 0.2, 10); g.fill(); } // tancho-ish head spot
  if (color === 'ogon') { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(tail, cy - Wd * 0.2, L, 2.2); }
  // scale shimmer
  g.strokeStyle = color === 'sumi' ? 'rgba(255,255,255,0.12)' : 'rgba(120,60,30,0.12)'; g.lineWidth = 0.5;
  for (let x = tail + 8; x < hx - 8; x += 3.2) for (let y = cy - Wd * 0.4; y < cy + Wd * 0.4; y += 3.2) { g.beginPath(); g.arc(x, y + ((x / 3.2) % 2) * 1.6, 1.6, -1.2, 1.2); g.stroke(); }
  g.restore();
  body();
  g.strokeStyle = color === 'sumi' ? 'rgba(225,228,240,0.75)' : 'rgba(30,22,20,0.55)'; g.lineWidth = color === 'sumi' ? 1.1 : 0.8; g.stroke();
  // dorsal line and eyes
  g.strokeStyle = color === 'sumi' ? 'rgba(255,255,255,0.18)' : 'rgba(60,40,30,0.25)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(hx - L * 0.25, cy); g.lineTo(hx - L * 0.7, cy); g.stroke();
  g.fillStyle = color === 'sumi' ? '#d9d9e0' : '#20181a';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(hx - 5, cy + s * 4.2, 1.1, 0, Math.PI * 2); g.fill(); }
  // barbels
  g.strokeStyle = 'rgba(40,30,30,0.4)'; g.lineWidth = 0.5;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx - 1, cy + s * 1.5); g.quadraticCurveTo(hx + 2, cy + s * 3, hx + 1, cy + s * 5); g.stroke(); }

  const fin = canvas(14 * r, 10 * r);
  {
    const f = fin.g; f.scale(r, r);
    f.fillStyle = ink.fin;
    f.beginPath(); f.moveTo(1, 1); f.quadraticCurveTo(12, 2, 13, 8); f.quadraticCurveTo(6, 9, 1, 1); f.fill();
    f.strokeStyle = 'rgba(40,30,30,0.3)'; f.lineWidth = 0.5; f.stroke();
  }
  return { body: c, fin: fin.c, len: L + tail, height: Wd * 1.6 };
}

/** Soft caustic light pattern that tiles; drawn once and scrolled. */
export function causticTexture(p: Palette, size: number, r: number, seed: number) {
  const { c, g } = canvas(size * r, size * r);
  g.scale(r, r);
  const rand = rng(seed);
  g.strokeStyle = hexA(p.light, 0.18); g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = rand() * size, y = rand() * size, rad = 8 + rand() * 22;
    g.lineWidth = 0.8 + rand() * 1.6;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      g.beginPath(); g.ellipse(x + ox, y + oy, rad, rad * (0.5 + rand() * 0.4), rand() * Math.PI, rand() * 2, rand() * 2 + 2.4); g.stroke();
    }
  }
  return c;
}

/** Brush streaks for a current; tile horizontally, rotated per current direction. */
export function currentTexture(p: Palette, w: number, h: number, r: number, seed: number) {
  const { c, g } = canvas(w * r, h * r);
  g.scale(r, r);
  const rand = rng(seed);
  g.lineCap = 'round';
  for (let i = 0; i < Math.max(6, (w * h) / 900); i++) {
    const y = rand() * h, x = rand() * w, len = 20 + rand() * 50;
    g.strokeStyle = hexA(p.current, 0.18 + rand() * 0.22); g.lineWidth = 0.8 + rand() * 1.4;
    for (const ox of [-w, 0, w]) {
      g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + len * 0.5, y - 2 + rand() * 4, x + ox + len, y); g.stroke();
    }
  }
  return c;
}

export function petalTexture(r: number, color = '#f6c9cf') {
  const { c, g } = canvas(10 * r, 8 * r);
  g.scale(r, r);
  g.fillStyle = color;
  g.beginPath(); g.moveTo(1, 4); g.quadraticCurveTo(5, -1, 9, 3); g.quadraticCurveTo(7, 4, 9, 5); g.quadraticCurveTo(5, 9, 1, 4); g.fill();
  g.strokeStyle = 'rgba(160,80,90,0.3)'; g.lineWidth = 0.4; g.stroke();
  return c;
}

export function dotTexture(color: string, rad: number, r: number, core = 0.3) {
  const { c, g } = canvas(rad * 2 * r, rad * 2 * r);
  g.scale(r, r);
  const grd = g.createRadialGradient(rad, rad, 0, rad, rad, rad);
  grd.addColorStop(0, color); grd.addColorStop(core, hexA(color.startsWith('#') ? color : '#ffffff', 0.5)); grd.addColorStop(1, hexA(color.startsWith('#') ? color : '#ffffff', 0));
  g.fillStyle = grd; g.fillRect(0, 0, rad * 2, rad * 2);
  return c;
}
