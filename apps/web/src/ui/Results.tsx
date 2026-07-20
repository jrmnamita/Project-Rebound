/**
 * ============================================================
 *  Results.tsx — the results screen: the rematch lives or dies here
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Shows the finished match's verdict — score, best, new-best
 *    celebration, phase reached — with REMATCH as the huge primary
 *    action in the thumb zone and MENU as the quiet secondary.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §7, the rematch rule: "from the results screen, a player
 *      must be able to start the next match within TWO TAPS and a
 *      few seconds. This is a hard design requirement, not polish —
 *      the session loop lives or dies here." Here it is ONE tap:
 *      the REMATCH button calls the rematch intent directly.
 *    - GDD §5.2 ("one more game"): defeat must feel immediately
 *      redeemable — so REMATCH is the biggest, closest, most
 *      colorful thing on the screen, and MENU is deliberately small.
 *    - GDD §5.5 (lightness): a new best celebrates loudly; an
 *      ordinary run is stated plainly. Losing is comedy, never
 *      punishment — no "GAME OVER" doom framing.
 * ============================================================
 */
import { useUiStore } from '../state/store.js';
import { PHASE_COLORS, THEME } from '../theme.js';
import type { GameIntents } from '../state/store.js';

export function Results({ intents }: { intents: GameIntents }): JSX.Element | null {
  const results = useUiStore((s) => s.results);
  if (results === null) return null;
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-between p-8"
      style={{ background: 'rgba(16, 20, 35, 0.92)' }}
      data-testid="results"
    >
      <div className="mt-14 text-center">
        <h2 className="text-3xl font-black tracking-widest" style={{ color: THEME.textPrimary }}>
          {results.isNewBest ? 'NEW BEST!' : 'THE WORLD WINS'}
        </h2>
        <p className="mt-1 text-xs tracking-widest" style={{ color: PHASE_COLORS[results.phaseReached] }}>
          REACHED {results.phaseReached.toUpperCase()}
        </p>
      </div>

      <div
        className="w-full max-w-xs rounded-3xl border p-6 text-center"
        style={{ background: THEME.surface, borderColor: THEME.surfaceBorder }}
      >
        <div className="text-[10px] font-bold tracking-widest" style={{ color: THEME.textDim }}>
          SCORE
        </div>
        <div
          className="text-5xl font-black tabular-nums"
          style={{ color: results.isNewBest ? THEME.celebrate : THEME.textPrimary }}
          data-testid="results-score"
        >
          {Math.floor(results.score)}
        </div>
        <div className="mt-2 text-xs tabular-nums" style={{ color: THEME.textDim }}>
          BEST {Math.floor(results.bestScore)}
        </div>
      </div>

      {/* The thumb zone: rematch is one tap — half the budget the
          rematch rule allows (GDD §7). */}
      <div className="mb-8 w-full max-w-xs text-center">
        <button
          type="button"
          onClick={() => intents.rematch()}
          data-testid="results-rematch"
          className="w-full rounded-3xl py-5 text-2xl font-black tracking-widest text-white transition-transform active:translate-y-1"
          style={{ background: THEME.accent, boxShadow: `0 6px 0 ${THEME.accentDark}` }}
        >
          REMATCH
        </button>
        <button
          type="button"
          onClick={() => intents.backToMenu()}
          data-testid="results-menu"
          className="mt-3 text-xs font-bold tracking-widest"
          style={{ color: THEME.textDim }}
        >
          MENU
        </button>
      </div>
    </div>
  );
}
