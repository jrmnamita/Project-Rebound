/**
 * ============================================================
 *  PhaseBanner.tsx — the announced phase transition
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Splashes the new phase name across mid-screen for ~1.6 s when
 *    the store's phaseBanner changes, then fades itself out via CSS
 *    (index.css) — no timers, no state cleanup.
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §8.5: "Phase transitions are announced and felt — a
 *    visual/audio beat the whole room shares. These are the match's
 *    dramatic act breaks." This is the visual half; the Audio module
 *    (later) adds the beat. Keyed by phase name so a new transition
 *    restarts the animation naturally. pointer-events-none: drama
 *    never blocks the thumb (Pillar 1).
 * ============================================================
 */
import { useUiStore } from '../state/store.js';
import { PHASE_COLORS } from '../theme.js';

export function PhaseBanner(): JSX.Element | null {
  const phase = useUiStore((s) => s.phaseBanner);
  if (phase === null) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div
        key={phase} // new phase → fresh element → animation restarts
        className="phase-banner-anim px-6 text-center text-4xl font-black tracking-widest"
        style={{ color: PHASE_COLORS[phase], textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}
        data-testid="phase-banner"
      >
        {phase.toUpperCase()}
      </div>
    </div>
  );
}
