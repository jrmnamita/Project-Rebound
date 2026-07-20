/**
 * ============================================================
 *  Menu.tsx — the front door: mid-match in seconds
 * ============================================================
 *  WHAT THIS FILE DOES
 *    The pre-match screen: working title, one big PRACTICE button in
 *    the thumb zone, the whole control scheme in one line, and the
 *    player's best score.
 *
 *  WHY IT EXISTS (design anchor)
 *    - Vision (Player Experience: "Instant"): "from opening the game
 *      to playing it: seconds." One screen, one primary action, zero
 *      settings between a stranger and the game.
 *    - GDD §6.1: "the entire game — menus included — must be
 *      comfortably playable with one thumb in portrait." The button
 *      sits in the bottom third: the natural thumb arc.
 *    - GDD §2: "a stranger can be mid-match twenty seconds after
 *      opening it" — the controls hint is the whole tutorial's text
 *      form; the tier-0 terrain is its practical form.
 * ============================================================
 */
import { useUiStore } from '../state/store.js';
import { THEME } from '../theme.js';
import type { GameIntents } from '../state/store.js';

export function Menu({ intents }: { intents: GameIntents }): JSX.Element {
  const best = useUiStore((s) => s.hud.bestScore);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-8" style={{ background: THEME.background }}>
      {/* Title block — working title, per GDD §14 Q5. */}
      <div className="mt-16 text-center">
        <h1 className="text-5xl font-black leading-none tracking-tight" style={{ color: THEME.textPrimary }}>
          PROJECT
          <br />
          <span style={{ color: THEME.accent }}>REBOUND</span>
        </h1>
        <p className="mt-3 text-sm" style={{ color: THEME.textDim }}>
          Four players. One accelerating world. One button.
        </p>
      </div>

      {best > 0 && (
        <div className="text-center" data-testid="menu-best">
          <div className="text-[10px] font-bold tracking-widest" style={{ color: THEME.textDim }}>
            BEST
          </div>
          <div className="text-3xl font-black tabular-nums" style={{ color: THEME.celebrate }}>
            {Math.floor(best)}
          </div>
        </div>
      )}

      {/* The thumb zone: one primary action (Vision: "Instant"). */}
      <div className="mb-8 w-full max-w-xs text-center">
        <button
          type="button"
          onClick={() => intents.startPractice()}
          data-testid="menu-practice"
          className="w-full rounded-3xl py-5 text-2xl font-black tracking-widest text-white transition-transform active:translate-y-1"
          style={{ background: THEME.accent, boxShadow: `0 6px 0 ${THEME.accentDark}` }}
        >
          PRACTICE
        </button>
        {/* The entire control scheme fits in one line — that is the
            design bet (GDD §2: one perfect input). */}
        <p className="mt-4 text-xs tracking-widest" style={{ color: THEME.textDim }}>
          TAP = JUMP · HOLD = HIGHER JUMP
        </p>
      </div>
    </div>
  );
}
