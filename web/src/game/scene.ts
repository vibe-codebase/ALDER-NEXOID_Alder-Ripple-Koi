import Phaser from 'phaser';
import * as A from './art';
import { FIELD_H, FIELD_W, LEVELS, type Level } from './levels';
import { cloneSim, createSim, insideField, RIPPLE_MAX, seals, step, tap, DT, type Sim } from './sim';
import { solve, settle } from './bot';
import { sound } from '../audio/sound';

export type Finish = { level: Level; taps: number; seals: number };
type Hooks = {
  onFinish?: (f: Finish) => void;
  onTaps?: (taps: number, canUndo: boolean) => void;
  onHome?: (homed: number, total: number) => void;
  onHaptic?: (style: 'light' | 'medium' | 'success' | 'warning') => void;
  onFirstTap?: () => void;
};

/** Bridge between React and the Phaser scene. */
export const pond = {
  hooks: {} as Hooks,
  scene: null as PondScene | null,
  reducedMotion: false,
  insets: { top: 64, bottom: 92 },
  show(mode: 'menu' | 'play', level: Level) { this.scene?.show(mode, level); },
  setPaused(p: boolean) { this.scene?.setPaused(p); },
  undo() { this.scene?.undo(); },
  restart() { this.scene?.show('play', this.scene.level); },
  setInsets(top: number, bottom: number) { this.insets = { top, bottom }; this.scene?.relayout(); },
  debug() { return this.scene?.debugState(); },
  /** QA only: solve the level instantly with the test solver (or drop one ripple at a field point). */
  qaSolve() { this.scene?.qaSolve(); },
  qaTap(x: number, y: number) { this.scene?.dropAt(x, y); },
};
(window as unknown as { __pond: typeof pond }).__pond = pond;

const PAD = 12;
const MENU_LEVEL: Level = {
  id: 'menu', chapter: 0, name: '', kanji: '', par: 0,
  koi: [{ x: 110, y: 330, c: 'kohaku' }, { x: 250, y: 380, c: 'ogon' }, { x: 180, y: 470, c: 'kohaku' }, { x: 90, y: 470, c: 'sumi' }],
  homes: [], stones: [{ x: 290, y: 250, r: 24 }],
};

type KoiView = { body: Phaser.GameObjects.Rope; shadow: Phaser.GameObjects.Rope; finL: Phaser.GameObjects.Image; finR: Phaser.GameObjects.Image; phase: number; vx: number; vy: number; vh: number; homeT: number; orbit: number; seed: number };

export class PondScene extends Phaser.Scene {
  level: Level = LEVELS[0];
  private mode: 'menu' | 'play' = 'menu';
  private sim!: Sim;
  private history: Sim[] = [];
  private paused = false;
  private finished = false;
  private everTapped = false;
  private acc = 0;
  private r = 2;
  private texSeq = 0;
  private runId = 0;
  private demoTimer = 0;
  private koi: KoiView[] = [];
  private enso: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  private ripples!: Phaser.GameObjects.Graphics;
  private currents: { ts: Phaser.GameObjects.TileSprite; fx: number; fy: number }[] = [];
  private caustic!: Phaser.GameObjects.TileSprite;
  private petals: { img: Phaser.GameObjects.Image; vx: number; vy: number; spin: number }[] = [];
  private paper!: Phaser.GameObjects.Image;

  constructor() { super('pond'); }

  create() {
    pond.scene = this;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.mode !== 'play' || this.paused || this.finished) return;
      this.dropAt(p.worldX, p.worldY);
    });
    this.scale.on('resize', () => this.rebuild());
    this.rebuild();
  }

  debugState() {
    return { mode: this.mode, paused: this.paused, finished: this.finished, taps: this.sim?.taps, t: this.sim?.t, koi: this.sim?.koi.map((k) => ({ x: Math.round(k.x), y: Math.round(k.y), home: k.home })) };
  }

  show(mode: 'menu' | 'play', level: Level) {
    this.mode = mode;
    this.level = level;
    this.paused = false;
    this.finished = false;
    this.everTapped = false;
    this.history = [];
    this.runId++;
    this.rebuild();
    this.emitTaps();
  }
  setPaused(p: boolean) { this.paused = p; }
  relayout() { this.layoutCamera(); }

  private emitTaps() { pond.hooks.onTaps?.(this.sim?.taps ?? 0, this.history.length > 0 && !this.finished); }

  // ── layout ────────────────────────────────────────────────────────────
  private layoutCamera() {
    const pw = this.scale.width, ph = this.scale.height;
    const dpr = pw / Math.max(1, this.game.canvas.clientWidth || pw);
    const top = pond.insets.top * dpr, bottom = pond.insets.bottom * dpr, side = 8 * dpr;
    const zoom = Math.min((pw - side * 2) / (FIELD_W + PAD * 2), (ph - top - bottom) / (FIELD_H + PAD * 2));
    const cyPx = top + (ph - top - bottom) / 2;
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(FIELD_W / 2, FIELD_H / 2 - (cyPx - ph / 2) / zoom);
    if (this.paper) {
      const v = cam.worldView;
      this.paper.setPosition(cam.midPoint.x, cam.midPoint.y).setDisplaySize(Math.max(v.width, pw / zoom) + 4, Math.max(v.height, ph / zoom) + 4);
    }
    return zoom;
  }

  private tex(prefix: string, c: HTMLCanvasElement) {
    const k = `${prefix}-${++this.texSeq}`;
    this.textures.addCanvas(k, c);
    return k;
  }
  private img(x: number, y: number, c: HTMLCanvasElement, prefix: string) {
    return this.add.image(x, y, this.tex(prefix, c)).setScale(1 / this.r);
  }

  private rebuild() {
    const stale = this.textures.getTextureKeys().filter((k) => /-\d+$/.test(k));
    this.tweens.killAll();
    this.children.removeAll(true);
    if (stale.length) this.events.once('postrender', () => stale.forEach((k) => this.textures.exists(k) && this.textures.remove(k)));
    this.koi = []; this.enso = []; this.currents = []; this.petals = [];

    const L = this.mode === 'menu' ? MENU_LEVEL : this.level;
    const p = A.PALETTES[this.level.chapter];
    const seed = A.rng(L.id.length * 97 + this.level.chapter * 13)() * 1e6 | 0;
    this.paper = undefined as unknown as Phaser.GameObjects.Image;
    const zoom = this.layoutCamera();
    this.r = Math.min(2, Math.max(1, zoom));
    const r = this.r;
    this.cameras.main.setBackgroundColor(p.paper[1]);

    const pw = this.scale.width / zoom, ph = this.scale.height / zoom;
    this.paper = this.add.image(0, 0, this.tex('paper', A.paperTexture(p, Math.min(900, pw + 8), Math.min(1600, ph + 8), Math.min(r, 1.5), seed)));
    this.layoutCamera();

    this.img(FIELD_W / 2, FIELD_H / 2, A.pondTexture(p, FIELD_W, FIELD_H, PAD, r, seed + 1), 'pond');
    const cKey = this.tex('caustic', A.causticTexture(p, 160, r, seed + 2));
    this.caustic = this.add.tileSprite(FIELD_W / 2, FIELD_H / 2, (FIELD_W - 20) * r, (FIELD_H - 20) * r, cKey).setScale(1 / r).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);

    (L.currents ?? []).forEach((cu, i) => {
      const vertical = Math.abs(cu.fy) > Math.abs(cu.fx);
      const tw = vertical ? cu.h : cu.w, th = vertical ? cu.w : cu.h;
      let c = A.currentTexture(p, Math.max(60, Math.min(tw, 240)), th, r, seed + 10 + i);
      if (vertical) c = rotate90(c);
      const ts = this.add.tileSprite(cu.x + cu.w / 2, cu.y + cu.h / 2, cu.w * r, cu.h * r, this.tex('cur', c)).setScale(1 / r).setAlpha(0.9);
      const band = this.add.rectangle(cu.x + cu.w / 2, cu.y + cu.h / 2, cu.w, cu.h, Phaser.Display.Color.HexStringToColor(p.current).color, 0.07);
      band.setDepth(0);
      this.currents.push({ ts, fx: cu.fx, fy: cu.fy });
    });

    L.homes.forEach((h, i) => {
      const ink = A.KOI_INK[h.c];
      const glow = this.img(h.x, h.y, A.dotTexture(h.c === 'sumi' ? '#e9e6ff' : '#fff2c8', h.r + 18, r, 0.4), 'hg').setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      const im = this.img(h.x, h.y, A.ensoTexture(ink.ring, h.r, r, seed + 30 + i), 'enso');
      if (!pond.reducedMotion) this.tweens.add({ targets: im, angle: { from: -2, to: 2 }, duration: 4200 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.enso.push({ img: im, glow });
    });

    (L.stones ?? []).forEach((st, i) => this.img(st.x, st.y, A.stoneTexture(p, st.r, r, seed + 50 + i), 'stone'));

    // koi: a bending rope body plus its shadow on the pond floor and two pectoral fins
    this.sim = createSim(L);
    this.sim.koi.forEach((k, i) => {
      const t = A.koiTextures(k.c, r, seed + 70 + i * 7);
      const key = this.tex('koi', t.body), finKey = this.tex('fin', t.fin);
      const pts = ropePoints(t.len * r);
      const shadow = this.add.rope(k.x, k.y, key, undefined, pts.map((q) => q.clone()), true).setScale(1 / r).setAlpha(0.26);
      shadow.setColors(0x06201c); shadow.tintFill = true;
      const finL = this.add.image(0, 0, finKey).setOrigin(0.1, 0.1).setScale(1 / r);
      const finR = this.add.image(0, 0, finKey).setOrigin(0.1, 0.1).setScale(1 / r, -1 / r);
      const body = this.add.rope(k.x, k.y, key, undefined, pts.map((q) => q.clone()), true).setScale(1 / r);
      this.koi.push({ body, shadow, finL, finR, phase: i * 1.7, vx: k.x, vy: k.y, vh: k.heading, homeT: 0, orbit: 0, seed: i });
    });

    // decorative lily pads float above the koi (fish glide beneath them)
    const rand = A.rng(seed + 90);
    const keepOut = [...L.homes.map((h) => ({ x: h.x, y: h.y, r: h.r + 26 })), ...(L.stones ?? []).map((s) => ({ x: s.x, y: s.y, r: s.r + 30 })), ...L.koi.map((k) => ({ x: k.x, y: k.y, r: 46 }))];
    let placed = 0;
    for (let tries = 0; tries < 60 && placed < 3; tries++) {
      const edge = rand() < 0.5;
      const x = edge ? (rand() < 0.5 ? 40 + rand() * 30 : FIELD_W - 40 - rand() * 30) : 40 + rand() * (FIELD_W - 80);
      const y = edge ? 40 + rand() * (FIELD_H - 80) : (rand() < 0.5 ? 40 + rand() * 30 : FIELD_H - 40 - rand() * 30);
      const rad = 15 + rand() * 9;
      if (keepOut.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + rad)) continue;
      keepOut.push({ x, y, r: rad + 30 });
      const im = this.img(x, y, A.lilyTexture(rad, r, seed + 100 + tries, placed === 0 ? (this.level.chapter === 2 ? '#e6e3f7' : '#f3b8c4') : null), 'lily');
      if (!pond.reducedMotion) this.tweens.add({ targets: im, angle: { from: -3, to: 3 }, x: im.x + 2, duration: 5000 + placed * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      placed++;
    }

    this.ripples = this.add.graphics();

    const petalColor = ['#f6c9cf', '#e9965a', '#e6e8f7'][this.level.chapter];
    const pKey = this.tex('petal', A.petalTexture(r, petalColor));
    for (let i = 0; i < 6; i++) {
      const im = this.add.image(rand() * FIELD_W, rand() * FIELD_H, pKey).setScale((0.8 + rand() * 0.5) / r).setAlpha(0.85).setAngle(rand() * 360);
      this.petals.push({ img: im, vx: 3 + rand() * 5, vy: 2 + rand() * 4, spin: (rand() - 0.5) * 40 });
    }

    this.acc = 0;
    this.demoTimer = 1.2;
    this.layoutCamera();
    this.placeKoi(0);
  }

  // ── input ─────────────────────────────────────────────────────────────
  dropAt(x: number, y: number) {
    if (this.mode !== 'play' || this.finished || !insideField(x, y)) return;
    const before = cloneSim(this.sim);
    if (!tap(this.sim, x, y)) return;
    this.history.push(before);
    if (this.history.length > 40) this.history.shift();
    this.splashFx(x, y);
    sound.drop(x / FIELD_W);
    pond.hooks.onHaptic?.('light');
    if (!this.everTapped) { this.everTapped = true; pond.hooks.onFirstTap?.(); }
    this.emitTaps();
  }

  undo() {
    if (this.finished || !this.history.length) return;
    this.sim = this.history.pop()!;
    this.sim.koi.forEach((k, i) => { const v = this.koi[i]; v.vx = k.x; v.vy = k.y; v.vh = k.heading; v.homeT = k.home >= 0 ? 1 : 0; });
    this.enso.forEach((e, i) => e.glow.setAlpha(this.sim.koi.some((k) => k.home === i) ? 0.5 : 0));
    pond.hooks.onHome?.(this.sim.koi.filter((k) => k.home >= 0).length, this.sim.koi.length);
    sound.tap();
    this.emitTaps();
  }

  qaSolve() {
    if (this.mode !== 'play' || this.finished) return;
    const taps = solve(this.level) ?? [];
    this.sim = settle(this.level, createSim(this.level));
    this.history = [];
    for (const t of taps) {
      if (this.sim.done) break;
      tap(this.sim, t.x, t.y);
      settle(this.level, this.sim);
      this.handleEvents();
    }
    this.emitTaps();
  }

  // ── loop ──────────────────────────────────────────────────────────────
  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.1, deltaMs / 1000);
    if (!this.sim) return;
    this.animateWater(dt);
    if (!this.paused) {
      if (this.mode === 'menu') this.demo(dt);
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 24) {
        this.acc -= DT; n++;
        step(this.mode === 'menu' ? MENU_LEVEL : this.level, this.sim);
        this.handleEvents();
      }
      if (n >= 24) this.acc = 0;
    }
    this.placeKoi(this.paused ? 0 : dt);
    this.drawRipples();
  }

  private demo(dt: number) {
    // On the title screen an unseen hand drops a ripple now and then, so the koi drift about.
    this.demoTimer -= dt;
    if (this.demoTimer > 0) return;
    this.demoTimer = 2.6 + Math.random() * 1.8;
    const k = this.sim.koi[Math.floor(Math.random() * this.sim.koi.length)];
    const towardCenter = Math.atan2(320 - k.y, 180 - k.x) + (Math.random() - 0.5) * 2.2;
    const x = k.x - Math.cos(towardCenter) * 55, y = k.y - Math.sin(towardCenter) * 55;
    if (insideField(x, y)) { tap(this.sim, x, y); this.splashFx(x, y, 0.6); }
  }

  private handleEvents() {
    for (const e of this.sim.events) {
      if (e.kind === 'push') { if (this.mode === 'play') sound.push(e.strength); }
      else if (e.kind === 'stone') { if (this.mode === 'play') { sound.stone(); pond.hooks.onHaptic?.('light'); } }
      else if (e.kind === 'bump') { if (this.mode === 'play') sound.bump(); }
      else if (e.kind === 'home') {
        const v = this.koi[e.koi];
        v.homeT = 0.0001;
        const en = this.enso[e.home];
        if (en) {
          en.glow.setAlpha(0.9);
          this.tweens.add({ targets: en.glow, alpha: 0.5, duration: 900, ease: 'Sine.out' });
          this.tweens.add({ targets: en.img, scale: { from: 1.12 / this.r, to: 1 / this.r }, duration: 700, ease: 'Back.out' });
          this.bloomFx(this.level.homes[e.home].x, this.level.homes[e.home].y, this.level.homes[e.home].r);
        }
        sound.home(e.home);
        pond.hooks.onHaptic?.('medium');
        pond.hooks.onHome?.(this.sim.koi.filter((k) => k.home >= 0).length, this.sim.koi.length);
      } else if (e.kind === 'clear' && this.mode === 'play') this.finish();
    }
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    const taps = this.sim.taps;
    const s = seals(this.level, taps);
    pond.hooks.onHaptic?.('success');
    window.setTimeout(() => sound.clear(), 350);
    const run = this.runId;
    window.setTimeout(() => { if (run === this.runId) pond.hooks.onFinish?.({ level: this.level, taps, seals: s }); }, 1700);
    this.emitTaps();
  }

  // ── visuals ───────────────────────────────────────────────────────────
  private placeKoi(dt: number) {
    const L = this.mode === 'menu' ? MENU_LEVEL : this.level;
    this.sim.koi.forEach((k, i) => {
      const v = this.koi[i];
      if (!v) return;
      const speed = Math.hypot(k.vx, k.vy);
      let tx = k.x, ty = k.y, th = k.heading;
      if (k.home >= 0) {
        // settle into a slow lap inside the ring
        const h = L.homes[k.home];
        v.homeT = Math.min(1, v.homeT + dt * 1.4);
        v.orbit += dt * 0.7;
        const rad = Math.max(4, h.r * 0.32);
        const ox = h.x + Math.cos(v.orbit) * rad, oy = h.y + Math.sin(v.orbit) * rad;
        tx = v.homeT >= 1 ? ox : v.vx + (ox - v.vx) * Math.min(1, dt * 3);
        ty = v.homeT >= 1 ? oy : v.vy + (oy - v.vy) * Math.min(1, dt * 3);
        th = v.orbit + Math.PI / 2;
      } else if (speed < 6 && !pond.reducedMotion) {
        th = k.heading + Math.sin(this.time.now / 1300 + v.seed * 2) * 0.12; // idle sway
      }
      // smooth heading so turns read as swimming, not snapping
      let dh = th - v.vh;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      v.vh += dh * Math.min(1, dt * (k.home >= 0 ? 6 : 5) + (dt === 0 ? 1 : 0));
      v.vx = tx; v.vy = ty;
      const swim = k.home >= 0 ? 0.6 : Math.min(1, speed / 60);
      v.phase += dt * (3 + swim * 9);
      const amp = pond.reducedMotion ? 0.6 : 1.3 + swim * 2.6;
      bend(v.body, v.phase, amp * this.r);
      bend(v.shadow, v.phase, amp * this.r);
      v.body.setPosition(tx, ty).setRotation(v.vh);
      v.shadow.setPosition(tx + 4, ty + 7).setRotation(v.vh);
      const cos = Math.cos(v.vh), sin = Math.sin(v.vh);
      const fx = 9, fy = 6;
      const flap = 0.7 + Math.sin(v.phase * 1.3) * 0.3;
      v.finL.setPosition(tx + cos * fx - sin * -fy, ty + sin * fx + cos * -fy).setRotation(v.vh + Math.PI - 0.5).setScale(flap / this.r, -1 / this.r);
      v.finR.setPosition(tx + cos * fx - sin * fy, ty + sin * fx + cos * fy).setRotation(v.vh + Math.PI + 0.5).setScale(flap / this.r, 1 / this.r);
    });
  }

  private drawRipples() {
    const g = this.ripples;
    g.clear();
    const p = A.PALETTES[this.level.chapter];
    const light = Phaser.Display.Color.HexStringToColor(p.light).color;
    const dark = Phaser.Display.Color.HexStringToColor(p.waterDeep).color;
    for (const rp of this.sim.ripples) {
      const f = 1 - rp.r / RIPPLE_MAX;
      const a = Math.pow(f, 1.3);
      g.lineStyle(3.2 * f + 0.6, dark, 0.22 * a); g.strokeCircle(rp.x, rp.y + 1.5, Math.max(0.1, rp.r - 1));
      g.lineStyle(2.2 * f + 0.5, light, 0.75 * a); g.strokeCircle(rp.x, rp.y, rp.r);
      if (rp.r > 14) { g.lineStyle(1.2, light, 0.35 * a); g.strokeCircle(rp.x, rp.y, rp.r * 0.72); }
      if (rp.r > 30) { g.lineStyle(0.8, light, 0.2 * a); g.strokeCircle(rp.x, rp.y, rp.r * 0.45); }
    }
  }

  private splashFx(x: number, y: number, k = 1) {
    if (pond.reducedMotion) return;
    const p = A.PALETTES[this.level.chapter];
    const c = Phaser.Display.Color.HexStringToColor(p.light).color;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4, sp = (10 + Math.random() * 12) * k;
      const d = this.add.circle(x, y, 1.1 + Math.random() * 1.1, c, 0.9);
      this.tweens.add({ targets: d, x: x + Math.cos(a) * sp, y: y + Math.sin(a) * sp - 4, alpha: 0, scale: 0.4, duration: 420 + Math.random() * 200, ease: 'Quad.out', onComplete: () => d.destroy() });
    }
    const ink = this.add.circle(x, y, 5 * k, Phaser.Display.Color.HexStringToColor(p.waterDeep).color, 0.35);
    this.tweens.add({ targets: ink, scale: 2.4, alpha: 0, duration: 520, ease: 'Quad.out', onComplete: () => ink.destroy() });
  }

  private bloomFx(x: number, y: number, rad: number) {
    if (pond.reducedMotion) return;
    const key = this.textures.getTextureKeys().find((k) => k.startsWith('petal-'));
    if (!key) return;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const im = this.add.image(x, y, key).setScale(1 / this.r).setAngle((a * 180) / Math.PI);
      this.tweens.add({ targets: im, x: x + Math.cos(a) * (rad + 14), y: y + Math.sin(a) * (rad + 14), alpha: 0, angle: im.angle + 90, duration: 900 + Math.random() * 300, ease: 'Cubic.out', onComplete: () => im.destroy() });
    }
  }

  private animateWater(dt: number) {
    if (pond.reducedMotion) return;
    this.caustic.tilePositionX += dt * 6 * this.r;
    this.caustic.tilePositionY += dt * 3.5 * this.r;
    this.caustic.setAlpha(0.45 + Math.sin(this.time.now / 2100) * 0.12);
    for (const c of this.currents) { c.ts.tilePositionX -= c.fx * dt * this.r * 1.2; c.ts.tilePositionY -= c.fy * dt * this.r * 1.2; }
    for (const pt of this.petals) {
      pt.img.x += pt.vx * dt; pt.img.y += pt.vy * dt; pt.img.angle += pt.spin * dt;
      if (pt.img.x > FIELD_W - 18) pt.img.x = 18;
      if (pt.img.y > FIELD_H - 18) pt.img.y = 18;
    }
  }
}

function ropePoints(len: number) {
  const n = 9, pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < n; i++) pts.push(new Phaser.Math.Vector2(-len / 2 + (len * i) / (n - 1), 0));
  return pts;
}
/** Swim: a travelling wave that is strongest at the tail (index 0) and still at the head. */
function bend(rope: Phaser.GameObjects.Rope, phase: number, amp: number) {
  const n = rope.points.length;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(1 - i / (n - 1), 1.6);
    rope.points[i].y = Math.sin(phase - i * 0.75) * amp * w;
  }
  rope.setDirty();
}

function rotate90(src: HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = src.height; c.height = src.width;
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export function startGame(parent: HTMLElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#efe6d2',
    scale: { mode: Phaser.Scale.NONE, width: parent.clientWidth * dpr, height: parent.clientHeight * dpr, zoom: 1 / dpr },
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    audio: { noAudio: true },
    fps: { target: 60, smoothStep: false },
    input: { activePointers: 2 },
    scene: [PondScene],
    banner: false,
  });
  const onResize = () => {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    game.scale.setZoom(1 / d);
    game.scale.resize(parent.clientWidth * d, parent.clientHeight * d);
  };
  window.addEventListener('resize', onResize);
  return () => { window.removeEventListener('resize', onResize); game.destroy(true); };
}
