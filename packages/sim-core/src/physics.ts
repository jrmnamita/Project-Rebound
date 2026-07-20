/**
 * ============================================================
 *  physics.ts — the Physics: gravity, motion, and ground contact
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Advances a player's body by exactly one tick: applies the jump
 *    hold boost, pulls the player down with gravity, moves them
 *    forward at the speed the match dictates, and resolves the one
 *    physical relationship in the game — the player versus the
 *    ground. Landing, walking along slopes, and rolling off edges
 *    all happen here, and nowhere else.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §6.1: depth comes from "the interaction of one input with
 *      the world" — this file is that interaction's rulebook.
 *    - GDD §12 Pillar 3 (auto-forward): forward speed is HANDED IN
 *      by the caller each tick (from the match speed curve, GDD
 *      §8.5). Physics moves the player at exactly that speed and
 *      cannot change it — no slope pushes, no friction, no per-
 *      player drift. The prototype broke this (its slopes altered
 *      vx); here the violation is impossible because speed is a
 *      parameter, not a variable.
 *    - GDD §5.1: the jump must feel "weighty" — weight is gravity
 *      plus a terminal fall speed, both defined here.
 *    - ARCHITECTURE §3: fixed 60-tick timestep. One call = one tick,
 *      always — never scaled by frame time. The prototype's frame-
 *      rate-dependent physics was the audit's fatal finding; the
 *      fixed step is the cure.
 *
 *  HOW IT FITS
 *    The Simulation (Game Loop module, later) calls, per tick and in
 *    this order: intent application (player.ts) → stepPhysics (this
 *    file). Terrain is consumed through the tiny GroundQuery
 *    interface below, which the Level module will satisfy — physics
 *    needs to know WHERE the ground is, never what it is made of.
 *    Deaths (gaps, spikes, hazards) are DETECTED by the Match module
 *    using this file's outputs plus Level queries; physics moves
 *    bodies, it does not judge them.
 *
 *  WHAT IT MUST NEVER DO
 *    Change forward speed, read input, know terrain content types,
 *    apply randomness, or vary with frame rate. Pure functions only
 *    — inside the determinism boundary.
 * ============================================================
 */

import {
  applyJumpHold,
  land,
  leaveGround,
  type PlayerState,
} from './player.js';

/**
 * Purpose: The one question physics ever asks the world: "how high
 * is the walkable surface at x?" — a number (y, growing downward),
 * or null where there is no ground (a gap).
 *
 * Why it exists: dependency inversion at the module seam. Physics is
 * being built before the Level module (maintainer's build order), so
 * it declares the minimal interface it CONSUMES instead of importing
 * a terrain implementation. The Level module's terrain will satisfy
 * this shape structurally; tests satisfy it with stubs. The narrow
 * interface is also a guarantee: physics cannot cheat and peek at
 * spikes or pickups, because it cannot even ask.
 *
 * Related systems: implemented by the Level module (terrain
 * queries); floating platforms will extend the contact rules when
 * Level lands (one-way surfaces — a collision rule that will live
 * here, against data that lives there).
 */
export interface GroundQuery {
  groundSurfaceAt(x: number): number | null;
}

/**
 * Purpose: Draft body-and-gravity tunables — the "weight" half of
 * the jump feel (player.ts's JUMP is the "spring" half).
 *
 * Why it exists: GDD §5.1 demands a fair, weighty jump; these
 * numbers ARE the weight. DRAFT values pending feel calibration
 * (GDD §14 keeps tuning playtest-owned); they migrate to
 * constants.ts when the Utilities module lands, and any change is a
 * SIM_VERSION bump once SIM_VERSION exists (CODING_STANDARDS §9).
 *
 * Units: world units and ticks (60 ticks/second); y grows downward,
 * so positive values pull DOWN.
 */
export const PHYSICS = {
  /** Downward acceleration per tick — the constant pull that turns
   *  an impulse into an arc (GDD §5.1: weighty). */
  GRAVITY_PER_TICK: 0.55,
  /** Terminal fall speed. Two jobs: falls stay readable at high
   *  match speeds (GDD §6.2: readable at extreme speed), and no
   *  body can ever move farther per tick than its own radius —
   *  which makes the landing detection below tunnel-proof by
   *  arithmetic, not by luck. */
  MAX_FALL_SPEED: 18,
  /** The player body's radius. Ground contact happens at the body's
   *  BOTTOM (y + RADIUS). Shared with rendering so what you see is
   *  what collides — mismatched sizes read as stolen deaths
   *  (GDD §5.1, "never a death that feels stolen"). */
  PLAYER_RADIUS: 20,
  /** Walking downhill, the surface may drop this much in one tick
   *  and the player still follows it (rolling down a slope).
   *  A larger drop means the ground fell away — an edge — and the
   *  player becomes airborne and falls like anything else
   *  (GDD §6.2: gaps and drops are the world's timing checks). */
  STEP_DOWN_TOLERANCE: 12,
} as const;

/**
 * Purpose: What one tick of physics did to the player — the new
 * state plus the two contact transitions, called out explicitly.
 *
 * Why it exists: the transitions are events other modules care
 * about: the renderer plays landing squash/particles on `landed`
 * (presentation reads results, never re-derives rules), and the
 * Match module will hang clean-landing logic on it later (GDD §6.2
 * rewards clean landings). Booleans — not a mutable event bus —
 * keep this pure and replay-safe.
 */
export interface PhysicsStepResult {
  readonly player: PlayerState;
  /** True exactly on the tick an airborne player touched down. */
  readonly landed: boolean;
  /** True exactly on the tick a grounded player lost the ground
   *  (walked off an edge — NOT a jump; jumps announce themselves
   *  through the input system). */
  readonly leftGround: boolean;
}

/**
 * Purpose: Advance one player's body by exactly one simulation tick.
 *
 * Why it exists: this is the game's only law of motion, applied in a
 * fixed order so that every machine computes the identical tick:
 *   1. jump hold boost (player.ts — "height scales with hold")
 *   2. gravity, when airborne (capped at terminal speed)
 *   3. forward motion at the dictated speed (auto-forward, Pillar 3)
 *   4. ground resolution (follow / land / leave)
 * The order is part of the determinism contract: reordering it would
 * change every replay and desync every match (ARCHITECTURE §3).
 *
 * Inputs:
 *   player       — the body to advance (intents for this tick must
 *                  already be applied — the Simulation owns that
 *                  sequencing).
 *   forwardSpeed — this tick's match speed, world units/tick, from
 *                  the speed curve (GDD §8.5). Same value for every
 *                  player in the room — Pillar 7 fairness is the
 *                  CALLER handing everyone the same number.
 *   terrain      — the world, seen only as GroundQuery.
 *
 * Outputs: PhysicsStepResult — new state + contact transitions.
 * Side effects: none — pure function.
 * Related systems: player.ts (hold boost, land/leaveGround
 * transitions), Level module (the real GroundQuery), Match module
 * (death judgment on the results), renderer (transition feedback).
 */
export function stepPhysics(
  player: PlayerState,
  forwardSpeed: number,
  terrain: GroundQuery,
  /** Gravity multiplier for THIS player THIS tick — 1 normally;
   *  the Slow effect passes >1 ("heavier, stickier", GDD §11.3,
   *  effects/slow.ts). Physics does not know why gravity scales —
   *  it only obeys; effect knowledge stays in the Effects module.
   *  Vertical-only by construction: forwardSpeed is untouched, so
   *  Pillar 7 (identical speed) survives every effect. */
  gravityScale = 1,
): PhysicsStepResult {
  return player.onGround
    ? stepGrounded(player, forwardSpeed, terrain)
    : stepAirborne(player, forwardSpeed, terrain, gravityScale);
}

/**
 * Purpose: One tick for a player who starts it standing on ground:
 * roll forward and either follow the surface or lose it.
 *
 * Why it exists (the rule it implements): GDD §6.2 — slopes are
 * "flow", edges are where gaps begin. Following a surface means the
 * body's bottom tracks the ground line exactly; losing it (a gap, or
 * a drop steeper than STEP_DOWN_TOLERANCE) hands the body to
 * gravity. Uphill surfaces are followed without limit because the
 * documented world has no walls — grades are bounded by generation
 * (GDD §6.2: "natural and smooth... not an obstacle grid"), so
 * physics does not second-guess the generator.
 *
 * Inputs/Outputs/Side effects: as stepPhysics (pure).
 */
function stepGrounded(
  player: PlayerState,
  forwardSpeed: number,
  terrain: GroundQuery,
): PhysicsStepResult {
  const newX = player.x + forwardSpeed;
  const surfaceY = terrain.groundSurfaceAt(newX);
  const currentBottom = player.y + PHYSICS.PLAYER_RADIUS;

  // A gap, or a drop too steep to roll down: the ground is gone.
  // vy stays 0 this tick; gravity begins next tick — the body
  // leaves an edge horizontally, which is what makes short gaps
  // clearable by pure timing (GDD §6.2: "a confident tap").
  if (surfaceY === null || surfaceY - currentBottom > PHYSICS.STEP_DOWN_TOLERANCE) {
    return {
      player: { ...leaveGround(player), x: newX },
      landed: false,
      leftGround: true,
    };
  }

  // Follow the surface: bottom rides the ground line exactly.
  return {
    player: { ...player, x: newX, y: surfaceY - PHYSICS.PLAYER_RADIUS },
    landed: false,
    leftGround: false,
  };
}

/**
 * Purpose: One tick for an airborne player: boost, gravity, move,
 * and land if — and only if — a surface is crossed while falling.
 *
 * Why it exists (the rules it implements):
 *   - Hold boost before gravity: the fixed interleave that makes a
 *     held jump climb smoothly (GDD §6.1) identically on every
 *     machine (ARCHITECTURE §3 fixed order).
 *   - Landing requires falling (vy >= 0): a rising player crossing
 *     up past a ledge's surface line must NOT stick to it from
 *     below — surfaces are one-way from above. Without this rule,
 *     jumping beside higher ground would glue the player to its
 *     edge mid-rise.
 *   - The crossing test compares the body's bottom before and after
 *     the move against the surface at the LANDING x: sound because
 *     MAX_FALL_SPEED < PLAYER_RADIUS (see PHYSICS) — a body cannot
 *     pass from "above the line" to "below the line, out of reach"
 *     in one tick. Tunnel-proof by arithmetic.
 *
 * Inputs/Outputs/Side effects: as stepPhysics (pure).
 */
function stepAirborne(
  player: PlayerState,
  forwardSpeed: number,
  terrain: GroundQuery,
  gravityScale: number,
): PhysicsStepResult {
  // 1. Hold boost (no-op unless a held jump is still rising).
  const boosted = applyJumpHold(player);

  // 2. Gravity — scaled (Slow effect makes it heavier; see
  //    stepPhysics), capped at the SAME terminal speed: the
  //    tunnel-proofing arithmetic (MAX_FALL_SPEED < PLAYER_RADIUS)
  //    must hold under every legal gravity scale.
  const vy = Math.min(
    boosted.vy + PHYSICS.GRAVITY_PER_TICK * gravityScale,
    PHYSICS.MAX_FALL_SPEED,
  );

  // 3. Integrate motion: forward at the dictated speed, vertical by vy.
  const newX = boosted.x + forwardSpeed;
  const newY = boosted.y + vy;

  // 4. Landing: only while falling, only if the body's bottom
  //    reached the surface line this very tick.
  if (vy >= 0) {
    const surfaceY = terrain.groundSurfaceAt(newX);
    if (surfaceY !== null) {
      const bottomBefore = boosted.y + PHYSICS.PLAYER_RADIUS;
      const bottomAfter = newY + PHYSICS.PLAYER_RADIUS;
      if (bottomAfter >= surfaceY && bottomBefore <= surfaceY) {
        // Touchdown: player.ts defines what landing MEANS (snap,
        // zero vertical motion, re-arm the jump — GDD §6.1).
        return {
          player: { ...land(boosted, surfaceY - PHYSICS.PLAYER_RADIUS), x: newX },
          landed: true,
          leftGround: false,
        };
      }
    }
  }

  // Still airborne: carry the integrated motion.
  return {
    player: { ...boosted, x: newX, y: newY, vy },
    landed: false,
    leftGround: false,
  };
}
