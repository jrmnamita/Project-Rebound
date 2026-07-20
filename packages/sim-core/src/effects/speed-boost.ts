/**
 * ============================================================
 *  speed-boost.ts — the Speed Boost: a score-rate surge
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Grants the boost status and answers scoring's one question:
 *    what score-rate multiplier applies to this player right now?
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §11.3: "Brief score-rate surge for the user (racing ahead
 *    of the pressure). Counterplay: none needed — it doesn't touch
 *    rivals." THE NAMING CAVEAT, taught here so nobody "fixes" it
 *    into a bug: despite the name, this does NOT change movement
 *    speed — it CANNOT, because Pillar 7 mandates identical speed
 *    for every player at every moment (the review's A7 finding; a
 *    rename to "Score Surge" is proposed there and awaits the
 *    terminology ruling — the wire id 'speedBoost' stays until a
 *    PROTOCOL_VERSION/SIM_VERSION bump says otherwise). What surges
 *    is the RATE at which survival converts to points — the §8.2
 *    scoring function gains a deterministic modifier, which §8.2's
 *    amended wording ("distance × deterministic modifiers") was
 *    written to admit.
 * ============================================================
 */

import type { MatchPlayer } from '../match.js';

/** DRAFT tunables — playtest-owned; changes bump SIM_VERSION. */
export const BOOST = {
  /** 180 ticks = 3 s (brief, §11.1). */
  DURATION_TICKS: 180,
  /** Score accrues at 1.5× while boosted. Self-only: no rival's
   *  anything is touched — the one power-up with no victim. */
  SCORE_RATE_MULTIPLIER: 1.5,
} as const;

/**
 * Purpose: Apply (or refresh) the boost on its collector.
 * Inputs: mp, tick. Outputs: the boosted player. Pure.
 */
export function applySpeedBoost(mp: MatchPlayer, tick: number): MatchPlayer {
  return { ...mp, effects: { ...mp.effects, boostUntilTick: tick + BOOST.DURATION_TICKS } };
}

/**
 * Purpose: The score-rate multiplier for this player this tick.
 * Inputs: mp, tick. Outputs: 1, or SCORE_RATE_MULTIPLIER while
 * boosted. Pure.
 * Related systems: consumed by match.ts's accrueScore — scoring
 * stays a pure function of survived distance × modifiers, exactly
 * recomputable by the Phase 2 validator.
 */
export function scoreRateFor(mp: MatchPlayer, tick: number): number {
  return tick <= mp.effects.boostUntilTick ? BOOST.SCORE_RATE_MULTIPLIER : 1;
}
