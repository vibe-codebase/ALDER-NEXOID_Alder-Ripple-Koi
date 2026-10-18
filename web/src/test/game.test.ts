import { describe, expect, it } from 'vitest';
import { LEVELS, CHAPTERS, FIELD_W, FIELD_H } from '../game/levels';
import { createSim, step, tap, seals, cloneSim, insideField, KOI_R } from '../game/sim';
import { solve, replay } from '../game/bot';
import { parseSave, freshSave, recordResult, isUnlocked, totalStars } from '../state/save';

describe('levels', () => {
  it('has 24 uniquely named ponds, 8 per chapter', () => {
    expect(LEVELS).toHaveLength(24);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(24);
    CHAPTERS.forEach((_, c) => expect(LEVELS.filter((l) => l.chapter === c)).toHaveLength(8));
  });
  it('gives every koi a ring of its colour and keeps everything inside the pond', () => {
    for (const l of LEVELS) {
      for (const c of new Set(l.koi.map((k) => k.c)))
        expect(l.homes.filter((h) => h.c === c).length).toBeGreaterThanOrEqual(l.koi.filter((k) => k.c === c).length);
      for (const k of l.koi) { expect(insideField(k.x, k.y)).toBe(true); for (const s of l.stones ?? []) expect(Math.hypot(k.x - s.x, k.y - s.y)).toBeGreaterThan(s.r + KOI_R); }
      for (const h of l.homes) { expect(h.x).toBeGreaterThan(0); expect(h.x).toBeLessThan(FIELD_W); expect(h.y).toBeGreaterThan(0); expect(h.y).toBeLessThan(FIELD_H); }
    }
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s can be cleared within par', (_id, l) => {
    const taps = solve(l);
    expect(taps).not.toBeNull();
    expect(taps!.length).toBeLessThanOrEqual(l.par);
    expect(replay(l, taps!).done).toBe(true);
  });
});

describe('sim', () => {
  it('is deterministic, and clones are independent', () => {
    const l = LEVELS[12];
    const a = createSim(l), b = createSim(l);
    tap(a, 120, 300); tap(b, 120, 300);
    for (let i = 0; i < 600; i++) { step(l, a); step(l, b); }
    expect(a).toEqual(b);
    const c = cloneSim(a); tap(c, 200, 200); step(l, c);
    expect(a.taps).not.toBe(c.taps);
    for (const k of a.koi) expect(insideField(k.x, k.y)).toBe(true);
  });
  it('pushes a koi away from the drop and ignores taps outside the pond', () => {
    const l = LEVELS[0];
    const s = createSim(l);
    expect(tap(s, -5, 300)).toBe(false);
    expect(tap(s, 180, l.koi[0].y + 20)).toBe(true);
    for (let i = 0; i < 240; i++) step(l, s);
    expect(s.koi[0].y).toBeLessThan(l.koi[0].y - 30);
  });
  it('awards seals by drops against par', () => {
    const l = { ...LEVELS[0], par: 3 };
    expect(seals(l, 2)).toBe(3); expect(seals(l, 3)).toBe(3); expect(seals(l, 5)).toBe(2); expect(seals(l, 6)).toBe(1);
  });
});

describe('save', () => {
  it('survives garbage', () => {
    for (const raw of [null, '', '{', 'null', '[]', '{"v":9}', '{"v":1,"stars":"x","best":{"garden-1":-3},"settings":{"music":"loud"}}'])
      expect(parseSave(raw)).toEqual(expect.objectContaining({ v: 1 }));
    expect(parseSave('{"v":1,"best":{"garden-1":2.5}}').best['garden-1']).toBeUndefined();
  });
  it('only improves and unlocks in order', () => {
    let s = freshSave();
    expect(isUnlocked(s, 1)).toBe(false);
    s = recordResult(s, 'garden-1', 2, 4);
    s = recordResult(s, 'garden-1', 1, 3);
    expect(s.stars['garden-1']).toBe(2);
    expect(s.best['garden-1']).toBe(3);
    expect(isUnlocked(s, 1)).toBe(true);
    expect(totalStars(s)).toBe(2);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
});
