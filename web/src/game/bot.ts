import type { Level } from './levels';
import { cloneSim, createSim, insideField, settled, step, tap, type Sim } from './sim';

/**
 * A beam-search solver used by the tests (and to set each level's par).
 * It only ever drops one ripple at a time and waits for the water to calm, so any
 * solution it finds is one a player can reproduce comfortably by hand.
 */
export type Tap = { x: number; y: number };
const MAX_WAIT = 4;

export function settle(level: Level, s: Sim) {
  const end = s.t + MAX_WAIT;
  while (!s.done && s.t < end) {
    step(level, s);
    if (settled(s)) break;
  }
  return s;
}

function cost(level: Level, s: Sim) {
  let c = 0;
  s.koi.forEach((k) => {
    if (k.home >= 0) return;
    let best = Infinity;
    level.homes.forEach((h, hi) => {
      if (h.c !== k.c || s.koi.some((o) => o.home === hi)) return;
      let d = Math.hypot(k.x - h.x, k.y - h.y);
      // detour penalty when a stone sits between the koi and its ring
      for (const st of level.stones ?? []) {
        const vx = h.x - k.x, vy = h.y - k.y, L2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((st.x - k.x) * vx + (st.y - k.y) * vy) / L2));
        const px = k.x + vx * t - st.x, py = k.y + vy * t - st.y;
        if (Math.hypot(px, py) < st.r + 12) d += st.r * 1.6;
      }
      best = Math.min(best, d);
    });
    c += 200 + best;
  });
  return c;
}

function candidates(level: Level, s: Sim): Tap[] {
  const out: Tap[] = [];
  s.koi.forEach((k) => {
    if (k.home >= 0) return;
    const targets = level.homes.filter((h, hi) => h.c === k.c && !s.koi.some((o) => o.home === hi));
    for (const h of targets) {
      const base = Math.atan2(h.y - k.y, h.x - k.x);
      for (const da of [0, -0.35, 0.35, -0.8, 0.8, -1.4, 1.4])
        for (const dist of [18, 40, 70, 110, 150]) {
          const a = base + da;
          const x = k.x - Math.cos(a) * dist, y = k.y - Math.sin(a) * dist;
          if (insideField(x, y)) out.push({ x: Math.round(x), y: Math.round(y) });
        }
    }
  });
  return out;
}

export function solve(level: Level, { beam = 8, depth = 12 } = {}): Tap[] | null {
  type Node = { s: Sim; taps: Tap[]; c: number };
  let layer: Node[] = [{ s: settle(level, createSim(level)), taps: [], c: 0 }];
  layer[0].c = cost(level, layer[0].s);
  for (let d = 0; d < depth; d++) {
    const next: Node[] = [];
    for (const n of layer) {
      for (const t of candidates(level, n.s)) {
        const s = cloneSim(n.s);
        tap(s, t.x, t.y);
        settle(level, s);
        const node = { s, taps: [...n.taps, t], c: cost(level, s) };
        if (s.done) return node.taps;
        next.push(node);
      }
    }
    next.sort((a, b) => a.c - b.c);
    // keep the beam diverse: skip near-identical states
    layer = [];
    for (const n of next) {
      if (layer.some((m) => m.s.koi.every((k, i) => Math.abs(k.x - n.s.koi[i].x) < 6 && Math.abs(k.y - n.s.koi[i].y) < 6))) continue;
      layer.push(n);
      if (layer.length >= beam) break;
    }
  }
  return null;
}

/** Replays a tap list exactly as the solver did (tap, then wait for calm). */
export function replay(level: Level, taps: Tap[]) {
  const s = settle(level, createSim(level));
  for (const t of taps) { tap(s, t.x, t.y); settle(level, s); if (s.done) break; }
  return s;
}
