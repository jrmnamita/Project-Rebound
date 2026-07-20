/**
 * ============================================================
 *  slow.ts — the Slow: heavier, stickier, briefly
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Grants the slow status and answers the one question physics
 *    asks about it: what gravity scale applies to this player right
 *    now?
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §11.3: "Briefly dampens the target's jump feel (heavier,
 *    stickier) — pressure, not paralysis. Counterplay: play
 *    conservative lines for a few seconds; Shield." Critically,
 *    Slow must NOT touch forward speed — Pillar 7 (identical speed
 *    for all) admits no exception, and the review's A7 analysis
 *    confirmed feel-effects may only touch the VERTICAL game. So
 *    Slow is a gravity multiplier: jumps peak lower and end sooner
 *    (heavier), falls bite faster (stickier) — the world's demands
 *    stay identical, the tool for meeting them is briefly blunter.
 *    §11.1: brief (DURATION_TICKS), survivable (conservative lines
 *    always exist — the generator's margins are wider than the
 *    dampened jump only at the extremes of its ranges, which is the
 *    pressure), telegraphed + counterable (resolve.ts).
 * ============================================================
 */

import type { MatchPlayer } from '../match.js';

/** DRAFT tunables — playtest-owned; changes bump SIM_VERSION. */
export const SLOW = {
  /** 180 ticks = 3 s — inside §11.1's "seconds, not phases". */
  DURATION_TICKS: 180,
  /** Gravity multiplier while slowed: 1.3 keeps the full-hold jump
   *  clearing every generated large gap (verified in the effects
   *  suite against real metrics) — pressure, never paralysis. */
  GRAVITY_SCALE: 1.3,
} as const;

/**
 * Purpose: Apply (or refresh) the slow on its victim.
 * Why refresh, not stack: overlapping slows reset the window — the
 * review's C3 stacking question, answered with the least-cruel
 * deterministic rule (flagged working default).
 * Inputs: mp, tick. Outputs: the slowed player. Pure.
 */
export function applySlow(mp: MatchPlayer, tick: number): MatchPlayer {
  return { ...mp, effects: { ...mp.effects, slowUntilTick: tick + SLOW.DURATION_TICKS } };
}

/**
 * Purpose: The gravity scale physics should use for this player
 * this tick — 1 when unslowed, SLOW.GRAVITY_SCALE while slowed.
 * Inputs: mp, tick. Outputs: the multiplier. Pure.
 * Related systems: the Simulation passes this into stepPhysics's
 * gravityScale option each tick — physics itself never knows the
 * Slow exists, only that gravity has a scale today.
 */
export function gravityScaleFor(mp: MatchPlayer, tick: number): number {
  return tick <= mp.effects.slowUntilTick ? SLOW.GRAVITY_SCALE : 1;
}
