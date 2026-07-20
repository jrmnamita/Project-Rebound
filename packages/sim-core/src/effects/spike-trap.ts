/**
 * ============================================================
 *  spike-trap.ts — the Spike Trap: punctuation, planted by a rival
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Computes where a trap spike is planted and how long it stands.
 *    An active trap is an ordinary spike in every way that matters:
 *    same contact rule, same death cause, same tap-jump counterplay.
 *
 *  WHY IT EXISTS (design anchor)
 *    GDD §11.3: "Plants a visible spike hazard on the target's path
 *    a comfortable distance ahead. Counterplay: jump it like any
 *    spike; Shield eats it." The §11.1 tests: telegraphed (same
 *    ahead-placement as the bomb — visible in the lookahead);
 *    survivable (it IS a spike — the tap jump clears it by design);
 *    brief (LIFETIME_TICKS, the ADR-0002 logic extended to traps —
 *    flagged there); counterable (shield, resolved upstream).
 *    ADR-0002's pad immunity applies: no trap on a respawn pad.
 *    (Note: ARCHITECTURE §2.3's "placed at a target checkpoint
 *    zone" wording was found contradictory in review A5; the GDD's
 *    "on the target's path ahead" governs, as the higher document.)
 * ============================================================
 */

import { SAFE_PAD_HALF } from '../constants.js';
import type { EffectContext } from './resolve.js';

/** DRAFT tunables — playtest-owned; changes bump SIM_VERSION. */
export const TRAP = {
  /** Same telegraph as the bomb: ahead, visible, reactable. */
  TELEGRAPH_TICKS: 90,
  /** Trap lifetime: 240 ticks = 4 s (ADR-0002 extension). */
  LIFETIME_TICKS: 240,
  /** Placement needs standing ground; if the aimed spot is over a
   *  gap, scan forward this many times, this far each try, then
   *  give up (a trap over a void fizzles — a gap is already deadly;
   *  doubling it teaches nothing). */
  PLACEMENT_SCAN_STEP: 40,
  PLACEMENT_SCAN_TRIES: 8,
} as const;

/** A planted spike with an expiry — the effect world's entry. */
export interface TrapSpike {
  readonly x: number;
  readonly y: number;
  readonly expiresAtTick: number;
}

/**
 * Purpose: Compute the trap for an activation aimed at a target
 * position — or null when no honest placement exists.
 *
 * The placement rules: lands TELEGRAPH_TICKS × speed ahead; must
 * stand ON ground (its y is the surface — a floating spike would be
 * a lie, and no mechanic may deceive, Vision: Honesty); skips
 * checkpoint pads (ADR-0002); scans forward past gaps/pads up to
 * the bounded try count, then fizzles.
 *
 * Inputs: targetX, ctx. Outputs: the TrapSpike, or null (fizzle).
 * Side effects: none — pure and bounded (the scan cannot loop
 * forever — determinism likes bounded work).
 */
export function placeTrap(targetX: number, ctx: EffectContext): TrapSpike | null {
  let x = targetX + TRAP.TELEGRAPH_TICKS * ctx.speed;

  for (let attempt = 0; attempt < TRAP.PLACEMENT_SCAN_TRIES; attempt += 1) {
    const onPad = ctx.checkpointsIn(x - SAFE_PAD_HALF, x + SAFE_PAD_HALF).length > 0;
    const surfaceY = onPad ? null : ctx.groundSurfaceAt(x);
    if (surfaceY !== null) {
      return { x, y: surfaceY, expiresAtTick: ctx.tick + TRAP.LIFETIME_TICKS };
    }
    x += TRAP.PLACEMENT_SCAN_STEP;
  }
  return null;
}
