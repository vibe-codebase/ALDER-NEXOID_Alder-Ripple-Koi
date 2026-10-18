import { FIELD_H, FIELD_W, type Level, type KoiColor } from './levels';

/**
 * Ripple Koi physics. The player never touches a fish: every tap drops a ripple ring that
 * expands across the pond and gives each koi it passes a gentle push away from the drop.
 * Pure and deterministic so the tests and the solver see exactly what the player sees.
 */
export const KOI_R = 11;
export const WALL = 16;              // inner margin of the pond's stone rim
export const RIPPLE_SPEED = 170;     // ring growth (units/s)
export const RIPPLE_MAX = 210;       // ring fades out at this radius
export const PUSH = 125;             // speed given to a koi right next to the drop
export const DRAG = 1.15;            // water resistance (1/s)
export const CURRENT_PULL = 0.9;     // how strongly a current drags koi toward its flow
export const SETTLE_SPEED = 4;
export const DT = 1 / 120;

export type Koi = { x: number; y: number; vx: number; vy: number; c: KoiColor; home: number; heading: number };
export type Ripple = { x: number; y: number; r: number; hit: boolean[] };
export type SimEvent =
  | { kind: 'push'; koi: number; strength: number }
  | { kind: 'home'; koi: number; home: number }
  | { kind: 'stone'; koi: number; speed: number }
  | { kind: 'bump'; a: number; b: number; speed: number }
  | { kind: 'clear' };
export type Sim = { t: number; koi: Koi[]; ripples: Ripple[]; taps: number; done: boolean; events: SimEvent[] };

export function createSim(level: Level): Sim {
  return {
    t: 0, taps: 0, done: false, ripples: [], events: [],
    koi: level.koi.map((k) => ({ x: k.x, y: k.y, vx: 0, vy: 0, c: k.c, home: -1, heading: k.heading ?? -Math.PI / 2 })),
  };
}

export const insideField = (x: number, y: number) => x >= WALL && x <= FIELD_W - WALL && y >= WALL && y <= FIELD_H - WALL;

export function tap(s: Sim, x: number, y: number): boolean {
  if (s.done || !insideField(x, y)) return false;
  s.taps++;
  s.ripples.push({ x, y, r: 0, hit: s.koi.map(() => false) });
  return true;
}

export function step(level: Level, s: Sim, dt = DT): Sim {
  s.events = [];
  if (s.done) return s;
  s.t += dt;

  // rings grow; a ring pushes each koi once, the moment its front reaches the fish
  for (const rp of s.ripples) {
    const r0 = rp.r;
    rp.r += RIPPLE_SPEED * dt;
    s.koi.forEach((k, i) => {
      if (rp.hit[i] || k.home >= 0) return;
      const dx = k.x - rp.x, dy = k.y - rp.y;
      const d = Math.hypot(dx, dy);
      if (d <= rp.r + KOI_R * 0.5 && d >= r0 - KOI_R) {
        rp.hit[i] = true;
        const f = PUSH * Math.max(0, 1 - d / RIPPLE_MAX);
        if (f <= 0) return;
        const nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : -1;
        k.vx += nx * f; k.vy += ny * f;
        s.events.push({ kind: 'push', koi: i, strength: f / PUSH });
      }
    });
  }
  s.ripples = s.ripples.filter((rp) => rp.r < RIPPLE_MAX);

  const decay = Math.exp(-DRAG * dt);
  s.koi.forEach((k, i) => {
    if (k.home >= 0) return;
    for (const cu of level.currents ?? []) {
      if (k.x >= cu.x && k.x <= cu.x + cu.w && k.y >= cu.y && k.y <= cu.y + cu.h) {
        k.vx += (cu.fx - k.vx) * CURRENT_PULL * dt;
        k.vy += (cu.fy - k.vy) * CURRENT_PULL * dt;
      }
    }
    k.vx *= decay; k.vy *= decay;
    k.x += k.vx * dt; k.y += k.vy * dt;

    // pond rim
    const lo = WALL + KOI_R;
    if (k.x < lo) { k.x = lo; k.vx = Math.abs(k.vx) * 0.5; }
    if (k.x > FIELD_W - lo) { k.x = FIELD_W - lo; k.vx = -Math.abs(k.vx) * 0.5; }
    if (k.y < lo) { k.y = lo; k.vy = Math.abs(k.vy) * 0.5; }
    if (k.y > FIELD_H - lo) { k.y = FIELD_H - lo; k.vy = -Math.abs(k.vy) * 0.5; }

    // stepping stones
    for (const st of level.stones ?? []) {
      const dx = k.x - st.x, dy = k.y - st.y, d = Math.hypot(dx, dy), min = st.r + KOI_R;
      if (d < min && d > 0.0001) {
        const nx = dx / d, ny = dy / d;
        k.x = st.x + nx * min; k.y = st.y + ny * min;
        const vn = k.vx * nx + k.vy * ny;
        if (vn < 0) {
          k.vx -= 1.5 * vn * nx; k.vy -= 1.5 * vn * ny;
          if (-vn > 12) s.events.push({ kind: 'stone', koi: i, speed: -vn });
        }
      }
    }
  });

  // koi nudge each other aside
  for (let a = 0; a < s.koi.length; a++)
    for (let b = a + 1; b < s.koi.length; b++) {
      const A = s.koi[a], B = s.koi[b];
      if (A.home >= 0 || B.home >= 0) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), min = KOI_R * 2;
      if (d < min && d > 0.0001) {
        const nx = dx / d, ny = dy / d, push = (min - d) / 2;
        A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
        const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rel < 0) {
          const j = -0.9 * rel;
          A.vx -= j * nx; A.vy -= j * ny; B.vx += j * nx; B.vy += j * ny;
          if (j > 10) s.events.push({ kind: 'bump', a, b, speed: j });
        }
      }
    }

  // a koi that glides into a ring of its own colour is home and stays there
  s.koi.forEach((k, i) => {
    if (k.home >= 0) return;
    if (Math.hypot(k.vx, k.vy) > 1) k.heading = Math.atan2(k.vy, k.vx);
    level.homes.forEach((h, hi) => {
      if (k.home >= 0 || h.c !== k.c || s.koi.some((o) => o.home === hi)) return;
      if (Math.hypot(k.x - h.x, k.y - h.y) < h.r - KOI_R * 0.4) {
        k.home = hi; k.vx = 0; k.vy = 0;
        s.events.push({ kind: 'home', koi: i, home: hi });
      }
    });
  });

  if (s.koi.every((k) => k.home >= 0)) { s.done = true; s.events.push({ kind: 'clear' }); }
  return s;
}

export function settled(s: Sim) {
  return s.ripples.length === 0 && s.koi.every((k) => k.home >= 0 || Math.hypot(k.vx, k.vy) < SETTLE_SPEED);
}

export function cloneSim(s: Sim): Sim {
  return { ...s, koi: s.koi.map((k) => ({ ...k })), ripples: s.ripples.map((r) => ({ ...r, hit: [...r.hit] })), events: [] };
}

/** Seals (stars): within par earns all three; a couple of extra drops still earns two. */
export function seals(level: Level, taps: number) {
  return taps <= level.par ? 3 : taps <= level.par + 2 ? 2 : 1;
}
