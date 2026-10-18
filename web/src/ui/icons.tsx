type P = { size?: number };
const s = (size = 22) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const Pause = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9 6.5v11M15 6.5v11" /></svg>;
export const Back = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>;
export const Next = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>;
export const Undo = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9 7 4.5 11.5 9 16" /><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" /></svg>;
export const Restart = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4 4.5v3.5h3.5" /></svg>;
export const Gear = ({ size }: P) => (
  <svg {...s(size)} aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /></svg>
);
/** Concentric rings: the game's mark. */
export const Ripple = ({ size }: P) => <svg {...s(size)} aria-hidden><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="12" cy="12" r="5.5" opacity=".75" /><circle cx="12" cy="12" r="9" opacity=".4" /></svg>;
export const Drop = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z" /></svg>;
export const Pond = ({ size }: P) => <svg {...s(size)} aria-hidden><ellipse cx="12" cy="13" rx="9" ry="6.5" /><path d="M9 12.5c1.5-1.4 3.6-1.4 5 0M7.5 15.5c2.6 1.4 6.4 1.4 9 0" opacity=".6" /></svg>;
export const Play = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></svg>;
export const Lock = ({ size }: P) => <svg {...s(size)} aria-hidden><rect x="6" y="11" width="12" height="9" rx="2" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></svg>;
