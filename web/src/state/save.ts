import { LEVELS } from '../game/levels';

export type Settings = { music: number; sfx: number; haptics: boolean; reducedMotion: boolean };
export type Save = { v: 1; stars: Record<string, number>; best: Record<string, number>; seenHints: string[]; settings: Settings };

const KEY = 'ripple-koi.save.v1';
export const DEFAULT_SETTINGS: Settings = { music: 0.6, sfx: 0.8, haptics: true, reducedMotion: false };
export const freshSave = (): Save => ({ v: 1, stars: {}, best: {}, seenHints: [], settings: { ...DEFAULT_SETTINGS } });

const clamp01 = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);

/** Parse defensively: any malformed field falls back to its default instead of breaking the game. */
export function parseSave(raw: string | null): Save {
  const out = freshSave();
  if (!raw) return out;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || d.v !== 1) return out;
    const ids = new Set(LEVELS.map((l) => l.id));
    for (const [k, v] of Object.entries(d.stars ?? {})) if (ids.has(k) && Number.isInteger(v) && (v as number) > 0) out.stars[k] = Math.min(3, v as number);
    for (const [k, v] of Object.entries(d.best ?? {})) if (ids.has(k) && typeof v === 'number' && Number.isInteger(v) && (v as number) > 0) out.best[k] = v as number;
    if (Array.isArray(d.seenHints)) out.seenHints = d.seenHints.filter((h: unknown) => typeof h === 'string' && ids.has(h));
    const s = d.settings ?? {};
    out.settings = { music: clamp01(s.music, DEFAULT_SETTINGS.music), sfx: clamp01(s.sfx, DEFAULT_SETTINGS.sfx), haptics: s.haptics !== false, reducedMotion: s.reducedMotion === true };
  } catch { /* corrupted: start fresh */ }
  return out;
}

export function loadSave(): Save {
  try { return parseSave(localStorage.getItem(KEY)); } catch { return freshSave(); }
}
export function writeSave(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: progress stays in memory */ }
}

/** Record a cleared pond. Seals and fewest drops only ever improve. */
export function recordResult(s: Save, id: string, stars: number, taps: number): Save {
  if (stars <= 0) return s;
  const prevBest = s.best[id];
  return {
    ...s,
    stars: { ...s.stars, [id]: Math.max(s.stars[id] ?? 0, stars) },
    best: { ...s.best, [id]: prevBest === undefined ? taps : Math.min(prevBest, taps) },
  };
}

/** A level is open when it is the first, or the one before it has been cleared. */
export function isUnlocked(s: Save, index: number) {
  return index === 0 || (s.stars[LEVELS[index - 1].id] ?? 0) > 0;
}
export const totalStars = (s: Save) => Object.values(s.stars).reduce((a, b) => a + b, 0);
