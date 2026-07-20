/**
 * ============================================================
 *  bomb.ts — the Bomb: easy ground becomes a gap, for a while
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Computes where a bomb's crater lands and how long it lasts.
 *    A crater is a temporary forced gap in the ONE shared world
 *    (ADR-0001) — while it exists, ground queries inside it answer
 *    null, and falling into it is an ordinary fall.
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §11.3: Bomb "blasts a crater into terrain ahead of the
 *    target rival — turning their easy ground into a gap they must
 *    now jump. Counterplay: see it land, size the jump." The four
 *    §11.1 tests, satisfied by construction:
 *      telegraphed — lands TELEGRAPH_TICKS of travel AHEAD of the
 *        target: it is on screen, in the lookahead window, before
 *        anyone reaches it;
 *      survivable — width is a fraction of the measured TAP-jump
 *        distance: clearable with the smallest jump in the game,
 *        with margin;
 *      brief — heals after HEAL_TICKS (ADR-0002);
 *      counterable — the shield eats it in resolve.ts before this
 *        module ever runs.
 *    Pillar 6 holds: the bomb kills nobody. It rearranges ground;
 *    only a missed jump kills.
 * ============================================================
 */

import { SAFE_PAD_HALF } from '../constants.js';
import type { EffectContext } from './resolve.js';

/** DRAFT tunables — playtest-owned; changes bump SIM_VERSION. */
export const BOMB = {
  /** How far ahead the crater lands, in ticks of travel at current
   *  speed — inside the ~2.5 s camera lookahead, so the victim SEES
   *  it form (telegraphed, §11.1). */
  TELEGRAPH_TICKS: 90,
  /** Crater width as a fraction of the measured tap-jump distance —
   *  under 1.0 means tap-clearable with human slack (survivable). */
  CRATER_WIDTH_FACTOR: 0.8,
  /** Crater lifetime: 240 ticks = 4 s (brief — ADR-0002). */
  HEAL_TICKS: 240,
} as const;

/** A temporary hole in the shared world. */
export interface Crater {
  readonly x0: number;
  readonly x1: number;
  readonly healAtTick: number;
}

/**
 * Purpose: Compute the crater for a bomb aimed at a target position.
 *
 * The placement rules, each a documented duty:
 *   - lands TELEGRAPH_TICKS × speed ahead of the target (§11.3
 *     "ahead of the target rival");
 *   - width = CRATER_WIDTH_FACTOR × measured tap distance
 *     (survivable by the real physics, not by hope);
 *   - if the span would overlap a checkpoint safe pad, it shifts to
 *     start just past the pad (ADR-0002: pads are immune — respawns
 *     are never ambushed).
 *
 * Inputs: targetX — the victim's x at activation; ctx — tick,
 * speed, metrics, checkpoint lookup.
 * Outputs: the Crater. Side effects: none — pure.
 * Related systems: resolve.ts adds it to the effect world; the
 * Simulation's ground wrapper makes it a real gap; the renderer
 * (future polish) draws the scorched edges.
 */
export function placeCrater(targetX: number, ctx: EffectContext): Crater {
  const width = ctx.metrics.tapDistance * BOMB.CRATER_WIDTH_FACTOR;
  let x0 = targetX + BOMB.TELEGRAPH_TICKS * ctx.speed;

  // Checkpoint immunity (ADR-0002): the generator's safe pad spans
  // SAFE_PAD_HALF each side of the checkpoint anchor; overlapping
  // spans shift to just past the pad's end.
  for (const cp of ctx.checkpointsIn(x0 - SAFE_PAD_HALF, x0 + width + SAFE_PAD_HALF)) {
    const padEnd = cp + SAFE_PAD_HALF;
    if (x0 < padEnd + 20 && x0 + width > cp - SAFE_PAD_HALF) {
      x0 = padEnd + 20;
    }
  }

  return { x0, x1: x0 + width, healAtTick: ctx.tick + BOMB.HEAL_TICKS };
}
