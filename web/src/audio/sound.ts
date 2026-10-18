/**
 * Ripple Koi sound, all synthesised with Web Audio: plucked koto-like strings over a
 * slow drone and soft water ambience. Every ripple is a note, so a good solution sounds like a phrase.
 */

const semis = (root: number, n: number) => root * Math.pow(2, n / 12);
// Japanese pentatonic modes, one per chapter: hirajoshi (garden), yo (stream), in (moon)
const MODES = [
  { root: 293.66, scale: [0, 2, 3, 7, 8, 12, 14, 15, 19, 20] },
  { root: 261.63, scale: [0, 2, 5, 7, 9, 12, 14, 17, 19, 21] },
  { root: 246.94, scale: [0, 1, 5, 7, 10, 12, 13, 17, 19, 22] },
];

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private next = 0;
  private beat = 0;
  private chapter = 0;
  private deg = 4;
  private seed = 11;
  private ambience: { stop(): void } | null = null;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private ducked = false;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.music = ctx.createGain();
      this.sfx = ctx.createGain();
      this.verb = ctx.createConvolver();
      this.verb.buffer = this.impulse(3.4);
      const wet = ctx.createGain(); wet.gain.value = 0.38;
      this.verb.connect(wet).connect(this.master);
      this.music.connect(this.master); this.music.connect(this.verb);
      this.sfx.connect(this.master); this.sfx.connect(this.verb);
      this.noise = this.makeNoise();
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number) { this.musicVol = music; this.sfxVol = sfx; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * 0.5 * (this.ducked ? 0.35 : 1), t, 0.2);
    this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.05);
  }
  duck(on: boolean) { this.ducked = on; this.applyVolumes(); }
  suspend() { void this.ctx?.suspend(); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume(); }

  // ── music: sparse koto phrases over a drone, never quite repeating ─────
  startMusic(chapter: number) {
    if (!this.ctx) return;
    if (this.timer !== null && chapter === this.chapter) return;
    this.chapter = chapter;
    this.next = this.ctx.currentTime + 0.4;
    if (!this.ambience) this.ambience = this.water();
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 150);
  }
  stopMusic() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.ambience?.stop(); this.ambience = null;
  }
  private rnd() { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const step = 60 / 54 / 2; // eighth notes at a slow 54 bpm
    const mode = MODES[this.chapter % MODES.length];
    while (this.next < ctx.currentTime + 0.8) {
      const t = this.next;
      if (this.beat % 32 === 0) this.drone(t, semis(mode.root / 4, 0), step * 32);
      if (this.beat % 32 === 16) this.drone(t, semis(mode.root / 4, 7), step * 16);
      // phrases breathe: four-bar call, four-bar rest with only a few drops
      const inPhrase = this.beat % 64 < 34;
      const chance = inPhrase ? (this.beat % 4 === 0 ? 0.85 : 0.32) : 0.08;
      if (this.rnd() < chance) {
        this.deg = Math.max(0, Math.min(mode.scale.length - 1, this.deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(this.rnd() * 7)]));
        const f = semis(mode.root, mode.scale[this.deg]);
        this.koto(t, f, 0.11 + this.rnd() * 0.05, this.music, 2.6);
        if (this.rnd() < 0.18) this.koto(t + step * 0.5, semis(mode.root, mode.scale[Math.min(mode.scale.length - 1, this.deg + 1)]), 0.06, this.music, 1.8); // grace note
      }
      this.next += step;
      this.beat++;
    }
  }

  /** A plucked string: bright attack, a body resonance, quick decay, a hint of pitch bend. */
  private koto(t: number, f: number, vol: number, bus: GainNode, dur = 2.2) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o2.frequency.setValueAtTime(f * 2.004, t);
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), t + 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(bus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    // the pick
    this.hiss(t, 0.03, vol * 0.6, f * 4, 2, undefined, bus);
  }

  private drone(t: number, f: number, d: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 2.5);
    g.gain.linearRampToValueAtTime(0.0001, t + d + 1.5);
    for (const [m, type] of [[1, 'sine'], [1.5, 'sine'], [2.003, 'triangle']] as const) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f * m;
      o.connect(lp); o.start(t); o.stop(t + d + 1.6);
    }
    lp.connect(g).connect(this.music);
  }

  /** Endless soft water bed: filtered noise with a slow swell. */
  private water() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
    const g = ctx.createGain(); g.gain.value = 0.025;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.012;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(hp).connect(g).connect(this.music);
    src.start(); lfo.start();
    return { stop: () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } } };
  }

  // ── effects ────────────────────────────────────────────────────────────
  private tone(f: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine', glideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.sfx);
    o.start(start); o.stop(start + dur + 0.05);
  }
  private hiss(start: number, dur: number, vol: number, freq: number, q = 1.2, sweepTo?: number, bus?: GainNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(freq, start);
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bp).connect(g).connect(bus ?? this.sfx);
    src.start(start, Math.random() * 1.5); src.stop(start + dur + 0.05);
  }

  /** A water drop, pitched to the scale so a run of taps becomes a melody. x in 0..1 picks the note. */
  drop(x: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const mode = MODES[this.chapter % MODES.length];
    const deg = Math.max(0, Math.min(6, Math.round(x * 6)));
    const f = semis(mode.root * 2, mode.scale[deg]);
    this.tone(f * 1.9, t, 0.16, 0.12, 'sine', f * 0.9);
    this.hiss(t, 0.09, 0.08, 2400, 1.4, 900);
    this.koto(t + 0.02, f, 0.07, this.sfx, 1.4);
  }
  push(strength: number) { if (this.ctx) this.hiss(this.ctx.currentTime, 0.25, 0.04 * strength, 600, 0.8, 300); }
  stone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(160, t, 0.18, 0.12, 'triangle', 90);
    this.hiss(t, 0.06, 0.05, 1200, 3);
  }
  bump() { if (this.ctx) this.tone(240, this.ctx.currentTime, 0.12, 0.06, 'sine', 180); }
  home(i: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const mode = MODES[this.chapter % MODES.length];
    [0, 2, 4].forEach((d, k) => this.koto(t + k * 0.09, semis(mode.root, mode.scale[(d + i) % mode.scale.length]), 0.12, this.sfx, 2.4));
    this.tone(semis(mode.root * 4, mode.scale[2]), t + 0.3, 1.6, 0.04);
  }
  clear() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const mode = MODES[this.chapter % MODES.length];
    [0, 1, 2, 3, 4, 5].forEach((d, k) => this.koto(t + 0.2 + k * 0.11, semis(mode.root, mode.scale[d]), 0.1, this.sfx, 2.8));
    this.tone(semis(mode.root / 2, 0), t + 0.2, 3, 0.08);
  }
  seal(i: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(120 + i * 15, t, 0.22, 0.2, 'sine', 60);
    this.hiss(t, 0.08, 0.1, 800, 1);
  }
  tap() { if (this.ctx) this.koto(this.ctx.currentTime, 880, 0.05, this.sfx, 0.5); }

  private makeNoise() {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    return b;
  }
}

export const sound = new Sound();
