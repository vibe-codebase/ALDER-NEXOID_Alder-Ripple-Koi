import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, LEVELS, levelIndex, type Level } from './game/levels';
import { pond, startGame, type Finish } from './game/scene';
import { sound } from './audio/sound';
import { haptic, onNative, toNative } from './bridge';
import { freshSave, isUnlocked, loadSave, recordResult, totalStars, writeSave, type Save } from './state/save';
import * as I from './ui/icons';

type Screen = 'home' | 'levels' | 'play' | 'settings';
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八'];

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState<Save>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('home');
  const [chapter, setChapter] = useState(0);
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(null);
  const [coach, setCoach] = useState(false);
  const [taps, setTaps] = useState({ n: 0, undo: false });
  const [homed, setHomed] = useState({ n: 0, of: 1 });
  const [settingsFrom, setSettingsFrom] = useState<Screen>('home');
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!host.current) return;
    pond.reducedMotion = save.settings.reducedMotion;
    return startGame(host.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { writeSave(save); }, [save]);
  useEffect(() => {
    sound.setVolumes(save.settings.music, save.settings.sfx);
    pond.reducedMotion = save.settings.reducedMotion;
    document.documentElement.dataset.motion = save.settings.reducedMotion ? 'reduced' : 'full';
  }, [save.settings]);

  // the pond leaves room for the HUD while playing, and fills the screen behind menus
  useEffect(() => {
    const h = window.innerHeight;
    if (screen === 'play') pond.setInsets(72, 96);
    else if (screen === 'home') pond.setInsets(Math.min(250, h * 0.3), Math.min(210, h * 0.27));
    else pond.setInsets(0, 0);
  }, [screen]);

  const buzz = useCallback((s: 'light' | 'medium' | 'success' | 'warning') => haptic(s, saveRef.current.settings.haptics), []);

  useEffect(() => {
    const unlock = () => { sound.unlock(); sound.startMusic(chapter); };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [chapter]);

  const startLevel = useCallback((l: Level) => {
    sound.unlock();
    sound.startMusic(l.chapter);
    sound.duck(false);
    setLevel(l);
    setChapter(l.chapter);
    setFinish(null);
    setPaused(false);
    setHomed({ n: 0, of: l.koi.length });
    setCoach(Boolean(l.hint) && !saveRef.current.seenHints.includes(l.id));
    setScreen('play');
    pond.setInsets(72, 96);
    pond.show('play', l);
  }, []);

  useEffect(() => {
    pond.hooks = {
      onFinish: (f) => {
        setFinish(f);
        setSave((s) => recordResult(s, f.level.id, f.seals, f.taps));
        sound.duck(true);
      },
      onTaps: (n, undo) => setTaps({ n, undo }),
      onHome: (n, of) => setHomed({ n, of }),
      onFirstTap: () => {
        setCoach(false);
        setSave((s) => (s.seenHints.includes(level.id) ? s : { ...s, seenHints: [...s.seenHints, level.id] }));
      },
      onHaptic: buzz,
    };
  }, [buzz, level.id]);

  const showMenuPond = useCallback((c: number) => pond.show('menu', LEVELS.find((l) => l.chapter === c) ?? LEVELS[0]), []);
  const goHome = useCallback(() => { setScreen('home'); setFinish(null); setPaused(false); sound.duck(false); showMenuPond(chapter); }, [chapter, showMenuPond]);
  const goLevels = useCallback(() => { setScreen('levels'); setFinish(null); setPaused(false); sound.duck(false); showMenuPond(chapter); }, [chapter, showMenuPond]);
  const pause = useCallback((p: boolean) => { setPaused(p); pond.setPaused(p); sound.duck(p); }, []);

  useEffect(() => onNative((e) => {
    if (e.type === 'native.lifecycle') {
      if (e.state === 'background') { sound.suspend(); if (screen === 'play' && !finish) pause(true); }
      else sound.resume();
      return;
    }
    if (screen === 'play') {
      if (finish) goLevels();
      else if (!paused) pause(true);
      else goLevels();
    } else if (screen === 'levels') goHome();
    else if (screen === 'settings') setScreen(settingsFrom);
    else toNative({ type: 'exit' });
  }), [screen, paused, finish, pause, goHome, goLevels, settingsFrom]);

  useEffect(() => {
    const vis = () => { if (document.hidden) { sound.suspend(); if (screen === 'play' && !finish) pause(true); } else sound.resume(); };
    document.addEventListener('visibilitychange', vis);
    const key = (e: KeyboardEvent) => {
      if (screen !== 'play' || finish) return;
      if (e.key === 'Escape') pause(!paused);
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') pond.undo();
    };
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('keydown', key); };
  }, [screen, paused, finish, pause]);

  const nextLevel = useMemo(() => {
    const i = levelIndex(level.id);
    return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
  }, [level]);

  const firstOpen = useMemo(() => {
    const i = LEVELS.findIndex((l, idx) => isUnlocked(save, idx) && !save.stars[l.id]);
    return LEVELS[i >= 0 ? i : 0];
  }, [save]);

  return (
    <div className={`app ch-${chapter}`}>
      <div className="stage" ref={host} />
      {screen === 'home' && (
        <Home seals={totalStars(save)} resume={save.stars[LEVELS[0].id] ? firstOpen : null} onPlay={() => startLevel(firstOpen)}
          onLevels={() => { setChapter(firstOpen.chapter); setScreen('levels'); showMenuPond(firstOpen.chapter); }}
          onSettings={() => { setSettingsFrom('home'); setScreen('settings'); }} />
      )}
      {screen === 'levels' && (
        <Levels save={save} chapter={chapter} onChapter={(c) => { setChapter(c); sound.startMusic(c); showMenuPond(c); }} onPick={startLevel} onBack={goHome} />
      )}
      {screen === 'play' && (
        <Hud level={level} taps={taps.n} canUndo={taps.undo} homed={homed} coach={coach} dim={paused || !!finish}
          onPause={() => pause(true)} onUndo={() => pond.undo()} onRestart={() => { sound.tap(); startLevel(level); }} />
      )}
      {screen === 'play' && paused && !finish && (
        <PauseCard level={level} onResume={() => pause(false)} onRestart={() => startLevel(level)} onLevels={goLevels}
          onSettings={() => { setSettingsFrom('play'); setScreen('settings'); }} />
      )}
      {screen === 'play' && finish && (
        <ResultCard finish={finish} best={save.best[finish.level.id]} next={nextLevel} onNext={(l) => startLevel(l)} onRetry={() => startLevel(level)} onLevels={goLevels} />
      )}
      {screen === 'settings' && (
        <Settings save={save} onChange={(st) => setSave((s) => ({ ...s, settings: st }))}
          onReset={() => setSave((s) => ({ ...freshSave(), settings: s.settings }))}
          onBack={() => { setScreen(settingsFrom); if (settingsFrom === 'play') pause(true); }} />
      )}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────
function Home({ seals, resume, onPlay, onLevels, onSettings }: { seals: number; resume: Level | null; onPlay: () => void; onLevels: () => void; onSettings: () => void }) {
  return (
    <div className="screen home">
      <header className="title-block">
        <div className="vertical" aria-hidden>波紋と鯉</div>
        <div className="title-text">
          <h1><small>Alder</small>Ripple<br />Koi</h1>
          <p>Never touch the fish. Drop a ripple, and let the water carry each koi home.</p>
        </div>
      </header>
      <div className="home-actions">
        <button className="ink-btn" onClick={() => { sound.tap(); onPlay(); }} data-testid="play">
          <I.Ripple size={20} /> {resume ? <>Continue <small>{resume.name}</small></> : 'Begin'}
        </button>
        <div className="row">
          <button className="paper-btn" onClick={() => { sound.tap(); onLevels(); }}><I.Pond /> Ponds</button>
          <button className="paper-btn round" aria-label="Settings" onClick={() => { sound.tap(); onSettings(); }}><I.Gear /></button>
        </div>
        <div className="seal-total"><span className="mini-seal">印</span> {seals} / {LEVELS.length * 3} seals</div>
      </div>
    </div>
  );
}

// ── Level select: each chapter is a folded paper with eight stones ────────
function Levels({ save, chapter, onChapter, onPick, onBack }: { save: Save; chapter: number; onChapter: (c: number) => void; onPick: (l: Level) => void; onBack: () => void }) {
  const levels = LEVELS.filter((l) => l.chapter === chapter);
  const got = levels.reduce((a, l) => a + (save.stars[l.id] ?? 0), 0);
  const chapterOpen = (c: number) => isUnlocked(save, LEVELS.findIndex((l) => l.chapter === c));
  return (
    <div className="screen levels">
      <div className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => { sound.tap(); onBack(); }}><I.Back /></button>
        <div className="tabs" role="tablist">
          {CHAPTERS.map((c, i) => (
            <button key={c.name} role="tab" aria-selected={i === chapter} className={`tab ${i === chapter ? 'on' : ''}`} disabled={!chapterOpen(i)}
              onClick={() => { sound.tap(); onChapter(i); }} aria-label={`${c.name}${chapterOpen(i) ? '' : ' (locked)'}`}>
              <span className="tab-kanji">{c.kanji}</span>
            </button>
          ))}
        </div>
        <span className="chip"><span className="mini-seal">印</span>{got}/24</span>
      </div>
      <div className="sheet">
        <div className="sheet-head">
          <h2>{CHAPTERS[chapter].name}</h2>
          <p>{CHAPTERS[chapter].blurb}</p>
        </div>
        <ol className="stones">
          {levels.map((l, i) => {
            const idx = levelIndex(l.id);
            const open = isUnlocked(save, idx);
            const st = save.stars[l.id] ?? 0;
            return (
              <li key={l.id}>
                <button className={`stone ${open ? 'open' : 'locked'} ${st ? 'done' : ''}`} disabled={!open} onClick={() => { sound.tap(); onPick(l); }}
                  aria-label={`${i + 1}. ${l.name}${open ? '' : ' (locked)'}`} data-testid={`level-${idx + 1}`}>
                  <span className="stone-kanji">{open ? KANJI_NUM[i] : <I.Lock size={18} />}</span>
                  <span className="stone-name">{l.name}</span>
                  <span className="stone-seals">{[0, 1, 2].map((k) => <i key={k} className={k < st ? 'on' : ''} />)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ── HUD ───────────────────────────────────────────────────────────────────
function Hud({ level, taps, canUndo, homed, coach, dim, onPause, onUndo, onRestart }: {
  level: Level; taps: number; canUndo: boolean; homed: { n: number; of: number }; coach: boolean; dim: boolean;
  onPause: () => void; onUndo: () => void; onRestart: () => void;
}) {
  const n = LEVELS.filter((l) => l.chapter === level.chapter).indexOf(level);
  const over = taps > level.par;
  return (
    <div className={`hud ${dim ? 'dim' : ''}`}>
      <div className="hud-top">
        <button className="icon-btn" aria-label="Pause" onClick={() => { sound.tap(); onPause(); }} data-testid="pause"><I.Pause /></button>
        <div className="hud-title">
          <span className="hud-kanji">{CHAPTERS[level.chapter].kanji}{KANJI_NUM[n]}</span>
          <strong>{level.name}</strong>
        </div>
        <div className={`drops ${over ? 'over' : ''}`} aria-label={`${taps} drops, par ${level.par}`}>
          <I.Drop size={15} /><b>{taps}</b><span>/ {level.par}</span>
        </div>
      </div>
      <div className="hud-bottom">
        <button className="paper-btn" onClick={() => { sound.tap(); onUndo(); }} disabled={!canUndo} data-testid="undo"><I.Undo /> Undo</button>
        <div className="homed" aria-label={`${homed.n} of ${homed.of} koi home`}>
          {Array.from({ length: homed.of }, (_, i) => <i key={i} className={i < homed.n ? 'on' : ''} />)}
        </div>
        <button className="paper-btn" onClick={onRestart} data-testid="restart"><I.Restart /> Again</button>
      </div>
      {coach && level.hint && (
        <div className="coach" role="note"><span className="coach-ring" aria-hidden /><p>{level.hint}</p></div>
      )}
    </div>
  );
}

function PauseCard({ level, onResume, onRestart, onLevels, onSettings }: { level: Level; onResume: () => void; onRestart: () => void; onLevels: () => void; onSettings: () => void }) {
  return (
    <div className="veil">
      <div className="card" role="dialog" aria-label="Paused">
        <span className="eyebrow">{level.name}</span>
        <h2>A quiet moment</h2>
        <button className="ink-btn" onClick={() => { sound.tap(); onResume(); }} data-testid="resume"><I.Play size={18} /> Return to the pond</button>
        <div className="row">
          <button className="paper-btn" onClick={() => { sound.tap(); onRestart(); }}><I.Restart /> Again</button>
          <button className="paper-btn" onClick={() => { sound.tap(); onLevels(); }}><I.Pond /> Ponds</button>
          <button className="paper-btn round" aria-label="Settings" onClick={() => { sound.tap(); onSettings(); }}><I.Gear /></button>
        </div>
      </div>
    </div>
  );
}

const TITLES = ['Home at last', 'Calm water', 'Perfect stillness'];
function ResultCard({ finish, best, next, onNext, onRetry, onLevels }: { finish: Finish; best: number | undefined; next: Level | null; onNext: (l: Level) => void; onRetry: () => void; onLevels: () => void }) {
  const [stamped, setStamped] = useState(0);
  useEffect(() => {
    const timers = [0, 1, 2].filter((i) => i < finish.seals).map((i) => window.setTimeout(() => { setStamped(i + 1); sound.seal(i); }, 420 + i * 380));
    return () => timers.forEach(clearTimeout);
  }, [finish.seals]);
  const lv = finish.level;
  return (
    <div className="veil soft">
      <div className="card result" role="dialog" aria-label="Pond cleared">
        <span className="eyebrow">{lv.name}</span>
        <h2>{TITLES[finish.seals - 1]}</h2>
        <div className="seals">
          {['静', '流', '心'].map((ch, i) => <span key={ch} className={`seal ${i < stamped ? 'stamped' : ''}`}>{ch}</span>)}
        </div>
        <p className="tally">
          {finish.taps} {finish.taps === 1 ? 'drop' : 'drops'} · par {lv.par}
          {best !== undefined && best < finish.taps && <> · best {best}</>}
        </p>
        <p className="advice">{finish.seals === 3 ? 'Every koi home within par.' : `Three seals at ${lv.par} drops or fewer. ${finish.seals === 1 ? `Two at ${lv.par + 2}.` : ''}`}</p>
        {next ? (
          <button className="ink-btn" onClick={() => { sound.tap(); onNext(next); }} data-testid="next"><I.Next size={18} /> Next pond <small>{next.name}</small></button>
        ) : (
          <button className="ink-btn" onClick={() => { sound.tap(); onLevels(); }} data-testid="finish">All ponds are calm</button>
        )}
        <div className="row">
          <button className="paper-btn" onClick={() => { sound.tap(); onRetry(); }} data-testid="retry"><I.Restart /> Again</button>
          <button className="paper-btn" onClick={() => { sound.tap(); onLevels(); }}><I.Pond /> Ponds</button>
        </div>
      </div>
    </div>
  );
}

function Settings({ save, onChange, onReset, onBack }: { save: Save; onChange: (s: Save['settings']) => void; onReset: () => void; onBack: () => void }) {
  const st = save.settings;
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen settings">
      <div className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => { sound.tap(); onBack(); }}><I.Back /></button>
        <h2 className="settings-title">Settings</h2>
        <span />
      </div>
      <div className="card flat">
        <label className="slider">Music <input type="range" min={0} max={1} step={0.05} value={st.music} onChange={(e) => onChange({ ...st, music: +e.target.value })} /><output>{Math.round(st.music * 100)}</output></label>
        <label className="slider">Sounds <input type="range" min={0} max={1} step={0.05} value={st.sfx} onChange={(e) => onChange({ ...st, sfx: +e.target.value })} /><output>{Math.round(st.sfx * 100)}</output></label>
        <label className="toggle">Vibration <input type="checkbox" checked={st.haptics} onChange={(e) => onChange({ ...st, haptics: e.target.checked })} /><i /></label>
        <label className="toggle">Reduce motion <input type="checkbox" checked={st.reducedMotion} onChange={(e) => onChange({ ...st, reducedMotion: e.target.checked })} /><i /></label>
        <div className="reset">
          {confirm ? (
            <>
              <span>Erase all seals?</span>
              <button className="paper-btn danger" onClick={() => { onReset(); setConfirm(false); }}>Erase</button>
              <button className="paper-btn" onClick={() => setConfirm(false)}>Keep</button>
            </>
          ) : (
            <button className="paper-btn" onClick={() => setConfirm(true)}>Reset progress</button>
          )}
        </div>
      </div>
      <p className="small-print">Plays fully offline. No ads, accounts or tracking.</p>
    </div>
  );
}
