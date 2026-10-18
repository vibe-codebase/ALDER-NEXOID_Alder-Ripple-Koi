/**
 * Ripple Koi levels. The pond is a fixed 360 × 560 field so every level plays identically on every phone.
 * Each koi must be ushered into an ensō ring of its own colour by dropping ripples nearby.
 * `par` is the number of drops the solver needs (see bot.ts); the tests keep it honest.
 */
export const FIELD_W = 360;
export const FIELD_H = 560;

export type KoiColor = 'kohaku' | 'ogon' | 'sumi';
export type KoiStart = { x: number; y: number; c: KoiColor; heading?: number };
export type Home = { x: number; y: number; r: number; c: KoiColor };
export type Stone = { x: number; y: number; r: number };
export type Current = { x: number; y: number; w: number; h: number; fx: number; fy: number };
export type Level = {
  id: string; chapter: 0 | 1 | 2; name: string; kanji: string; par: number;
  koi: KoiStart[]; homes: Home[]; stones?: Stone[]; currents?: Current[]; hint?: string;
};

export const CHAPTERS = [
  { name: 'Garden Pond', kanji: '庭', blurb: 'Still water, mossy stones. Learn how a ripple moves a fish.' },
  { name: 'Temple Stream', kanji: '流', blurb: 'Slow currents carry the koi. Let the water help you.' },
  { name: 'Moon Pool', kanji: '月', blurb: 'Many koi, many colours, narrow gaps between the stones.' },
] as const;

export const KOI_NAMES: Record<KoiColor, string> = { kohaku: 'Kohaku', ogon: 'Ogon', sumi: 'Sumi' };

const K = (x: number, y: number, c: KoiColor = 'kohaku', heading?: number): KoiStart => ({ x, y, c, heading });
const H = (x: number, y: number, c: KoiColor = 'kohaku', r = 34): Home => ({ x, y, r, c });
const S = (x: number, y: number, r = 22): Stone => ({ x, y, r });
const C = (x: number, y: number, w: number, h: number, fx: number, fy: number): Current => ({ x, y, w, h, fx, fy });

export const LEVELS: Level[] = [
  // ── Garden Pond ───────────────────────────────────────────────────────
  { id: 'garden-1', chapter: 0, name: 'First Ripple', kanji: '一', par: 2, koi: [K(180, 380)], homes: [H(180, 200, 'kohaku', 40)],
    hint: 'Tap the water just behind the koi. The ripple pushes it away from your tap.' },
  { id: 'garden-2', chapter: 0, name: 'Sideways', kanji: '二', par: 2, koi: [K(90, 300)], homes: [H(270, 230, 'kohaku', 38)],
    hint: 'Closer taps push harder. Gentle taps from farther away nudge.' },
  { id: 'garden-3', chapter: 0, name: 'Bank Shot', kanji: '三', par: 4, koi: [K(300, 450)], homes: [H(300, 110)], stones: [S(250, 280, 30), S(330, 280, 22)] },
  { id: 'garden-4', chapter: 0, name: 'Mossy Stone', kanji: '四', par: 4, koi: [K(180, 440)], homes: [H(180, 120)], stones: [S(180, 290, 34)] },
  { id: 'garden-5', chapter: 0, name: 'Two Friends', kanji: '五', par: 5, koi: [K(140, 400), K(220, 400)], homes: [H(110, 150), H(250, 150)],
    hint: 'One ripple can move every koi it reaches.' },
  { id: 'garden-6', chapter: 0, name: 'Golden One', kanji: '六', par: 5, koi: [K(120, 300, 'ogon'), K(240, 300)], homes: [H(260, 120, 'ogon'), H(100, 460)],
    hint: 'Each koi only rests in a ring of its own colour.' },
  { id: 'garden-7', chapter: 0, name: 'Stepping Stones', kanji: '七', par: 5, koi: [K(70, 470)], homes: [H(290, 90)], stones: [S(120, 330, 26), S(240, 250, 26), S(150, 160, 22)] },
  { id: 'garden-8', chapter: 0, name: 'Lantern Corner', kanji: '八', par: 5, koi: [K(180, 280, 'ogon'), K(180, 340)], homes: [H(60, 60, 'ogon', 36), H(300, 500, 'kohaku', 36)], stones: [S(110, 160, 24), S(250, 420, 24)] },

  // ── Temple Stream ─────────────────────────────────────────────────────
  { id: 'stream-1', chapter: 1, name: 'Drift', kanji: '一', par: 4, koi: [K(90, 140)], homes: [H(270, 420)], currents: [C(16, 220, 328, 120, 26, 0)],
    hint: 'Pale bands are currents. They slowly carry any koi inside them.' },
  { id: 'stream-2', chapter: 1, name: 'Eddy Stone', kanji: '二', par: 3, koi: [K(80, 280)], homes: [H(290, 280)], stones: [S(190, 280, 34)], currents: [C(16, 200, 328, 60, 18, 0), C(16, 300, 328, 60, -18, 0)] },
  { id: 'stream-3', chapter: 1, name: 'Ferry', kanji: '三', par: 5, koi: [K(60, 470, 'ogon')], homes: [H(300, 90, 'ogon')], currents: [C(150, 16, 70, 528, 0, -24)] },
  { id: 'stream-4', chapter: 1, name: 'Upstream', kanji: '四', par: 6, koi: [K(270, 450)], homes: [H(90, 120)], currents: [C(16, 200, 328, 160, 22, 0)] },
  { id: 'stream-5', chapter: 1, name: 'Mill Race', kanji: '五', par: 6, koi: [K(60, 90)], homes: [H(300, 470)], currents: [C(16, 150, 328, 70, -30, 0), C(16, 330, 328, 70, 30, 0)], stones: [S(250, 270, 24)] },
  { id: 'stream-6', chapter: 1, name: 'Two Currents', kanji: '六', par: 6, koi: [K(180, 470), K(180, 90, 'ogon')], homes: [H(60, 280), H(300, 280, 'ogon')], currents: [C(16, 16, 110, 528, 0, 20), C(234, 16, 110, 528, 0, -20)] },
  { id: 'stream-7', chapter: 1, name: 'Temple Steps', kanji: '七', par: 9, koi: [K(70, 480), K(290, 480)], homes: [H(110, 90), H(250, 90)], stones: [S(70, 300, 24), S(180, 250, 26), S(290, 300, 24)], currents: [C(16, 360, 328, 60, 20, 0)] },
  { id: 'stream-8', chapter: 1, name: 'Crossing', kanji: '八', par: 11, koi: [K(90, 470), K(270, 470, 'ogon')], homes: [H(270, 90), H(90, 90, 'ogon')], currents: [C(16, 240, 328, 70, -14, 0)], stones: [S(180, 300, 26)] },

  // ── Moon Pool ─────────────────────────────────────────────────────────
  { id: 'moon-1', chapter: 2, name: 'Ink Koi', kanji: '一', par: 2, koi: [K(180, 300, 'sumi')], homes: [H(180, 90, 'sumi'), H(180, 480, 'kohaku')], stones: [S(110, 200, 22), S(250, 200, 22)],
    hint: 'Sumi koi are ink-black. Find the dark ring.' },
  { id: 'moon-2', chapter: 2, name: 'Gatehouse', kanji: '二', par: 4, koi: [K(180, 470)], homes: [H(180, 90)], stones: [S(90, 280, 60), S(270, 280, 60)] },
  { id: 'moon-3', chapter: 2, name: 'Lotus Maze', kanji: '三', par: 5, koi: [K(60, 480)], homes: [H(300, 80)], stones: [S(60, 330, 28), S(150, 390, 28), S(210, 250, 28), S(300, 290, 28), S(110, 170, 28), S(240, 130, 22)] },
  { id: 'moon-4', chapter: 2, name: 'Three Colours', kanji: '四', par: 6, koi: [K(120, 280), K(180, 280, 'ogon'), K(240, 280, 'sumi')], homes: [H(70, 90), H(180, 480, 'ogon'), H(290, 90, 'sumi')] },
  { id: 'moon-5', chapter: 2, name: 'Swap', kanji: '五', par: 6, koi: [K(90, 140), K(270, 420, 'ogon')], homes: [H(270, 140, 'ogon'), H(90, 420)], stones: [S(180, 280, 40)] },
  { id: 'moon-6', chapter: 2, name: 'Moonbeam', kanji: '六', par: 10, koi: [K(60, 480, 'sumi'), K(300, 480)], homes: [H(300, 80, 'sumi'), H(60, 80)], currents: [C(140, 16, 80, 528, 0, -20)], stones: [S(180, 200, 22), S(180, 380, 22)] },
  { id: 'moon-7', chapter: 2, name: 'Gathering', kanji: '七', par: 11, koi: [K(80, 120, 'ogon'), K(280, 120, 'sumi'), K(80, 440), K(280, 440, 'ogon')], homes: [H(180, 90, 'ogon'), H(180, 470, 'sumi'), H(320, 280), H(40, 280, 'ogon')] },
  { id: 'moon-8', chapter: 2, name: 'Full Moon', kanji: '八', par: 9, koi: [K(180, 160), K(180, 400, 'ogon'), K(90, 280, 'sumi')], homes: [H(300, 480), H(60, 80, 'ogon'), H(300, 80, 'sumi')], stones: [S(180, 280, 44), S(270, 200, 22), S(90, 400, 22)], currents: [C(16, 470, 328, 74, 18, 0)] },
];

export const levelIndex = (id: string) => LEVELS.findIndex((l) => l.id === id);
