/**
 * ============================================================
 *  Hud.tsx — the in-match heads-up display
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Renders the always-visible match readout: score, phase pill,
 *    best, and the three lives dots, across the top of the portrait
 *    frame. Reads the store; decides nothing.
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §9 (the live readout is core), §8.3 (3 lives, visible),
 *    §8.5 (the current phase is shared public drama). The whole
 *    overlay is pointer-events-none: the ENTIRE screen is the jump
 *    button (GDD §12 Pillar 1) and no HUD pixel may ever steal a
 *    tap — a swallowed jump is a stolen death (GDD §5.1).
 * ============================================================
 */
import { useUiStore } from '../state/store.js';
import { PHASE_COLORS, THEME } from '../theme.js';

/** Score as a stable-width figure so it ticks without jittering. */
function formatScore(score: number): string {
  return Math.floor(score).toString().padStart(5, '0');
}

export function Hud(): JSX.Element {
  const hud = useUiStore((s) => s.hud);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
      {/* Score + lives: the player's own story, top-left. */}
      <div
        className="rounded-2xl border px-3 py-2 backdrop-blur-sm"
        style={{ background: THEME.surface, borderColor: THEME.surfaceBorder }}
      >
        <div className="text-[10px] font-bold tracking-widest" style={{ color: THEME.textDim }}>
          SCORE
        </div>
        <div
          className="text-xl font-black tabular-nums"
          style={{ color: THEME.textPrimary }}
          data-testid="hud-score"
        >
          {formatScore(hud.score)}
        </div>
        {/* Lives as dots — 3 per GDD §8.3. The last one turns danger-
            colored: peril must be legible at a glance (GDD §5.2). */}
        <div className="mt-1 flex gap-1" data-testid="hud-lives" aria-label={`${hud.lives} lives`}>
          {[0, 1, 2].map((slot) => (
            <span
              key={slot}
              data-testid={slot < hud.lives ? 'life-full' : 'life-empty'}
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background:
                  slot < hud.lives
                    ? hud.lives === 1
                      ? THEME.danger
                      : THEME.lifeFull
                    : THEME.lifeEmpty,
              }}
            />
          ))}
        </div>
      </div>

      {/* Phase pill: the room's shared clock, top-center. Pulses
          gently while spawn-protected so the immunity window is
          visible, never secret (GDD §8.3). */}
      <div
        className={`rounded-full border px-3 py-1 text-xs font-black tracking-widest ${hud.spawnProtected ? 'animate-pulse' : ''}`}
        style={{
          background: THEME.surface,
          borderColor: THEME.surfaceBorder,
          color: PHASE_COLORS[hud.phaseName],
        }}
        data-testid="hud-phase"
      >
        {hud.phaseName.toUpperCase()}
      </div>

      {/* Best: the score-chaser's north star (GDD §4), top-right. */}
      <div
        className="rounded-2xl border px-3 py-2 text-right backdrop-blur-sm"
        style={{ background: THEME.surface, borderColor: THEME.surfaceBorder }}
      >
        <div className="text-[10px] font-bold tracking-widest" style={{ color: THEME.textDim }}>
          BEST
        </div>
        <div className="text-xl font-black tabular-nums" style={{ color: THEME.textPrimary }}>
          {formatScore(hud.bestScore)}
        </div>
      </div>
    </div>
  );
}
