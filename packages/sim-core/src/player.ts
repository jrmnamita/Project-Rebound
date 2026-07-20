/**
 * ============================================================
 *  player.ts — the Player: one character, one verb
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines what a player *is* in the simulation (PlayerState) and
 *    the complete rulebook of the game's only verb: the jump. Press
 *    while grounded to leave the ground; keep holding to climb
 *    higher (up to a cap); release early to cut the jump short.
 *    Everything here is plain data and pure functions — give them
 *    the same state and the same intent, and they return the same
 *    result on any machine, forever.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §6.1: "Tap → normal jump. Hold → higher jump (height
 *      scales with hold, up to a cap; releasing early cuts the jump
 *      short). Jumping is only possible from the ground. There is no
 *      double jump, no air control, no dash."
 *    - GDD §12 Pillar 1 (one input) and Pillar 3 (auto-forward: the
 *      player never steers) — which is why NOTHING in this file can
 *      change horizontal velocity. Forward speed belongs to the
 *      match speed curve (GDD §8.5), not to the player.
 *    - GDD §5.1: the jump must feel "fair, weighty, and instantly
 *      responsive at all times — this feeling is the product."
 *      Responsiveness is structural here: a press while grounded
 *      takes effect the very tick it arrives.
 *
 *  HOW IT FITS
 *    The Input System (input.ts) delivers validated press/release
 *    intents; this file turns them into jump state. The Physics
 *    module (next in the maintainer's build order) will own gravity
 *    and movement integration, calling applyJumpHold() each tick and
 *    land()/leaveGround() when the terrain says so. The Match module
 *    (later) will COMPOSE PlayerState with lives/score/checkpoint
 *    data (GDD §8) rather than editing this file — one module, one
 *    responsibility.
 *
 *  WHAT IT MUST NEVER DO
 *    Read input devices, apply gravity, know about terrain shapes,
 *    touch rendering, or acquire a second verb. It lives inside the
 *    determinism boundary: pure functions only, no hidden state.
 *
 *  COORDINATE CONVENTION (read this once, remember it everywhere)
 *    The simulation uses screen-style axes: x grows forward (the
 *    direction the world scrolls), y grows DOWNWARD. Therefore a
 *    NEGATIVE vy means the player is rising. This matches how the
 *    renderer, and most 2D engines, address pixels — one convention
 *    end to end means no sign-flipping bugs at the boundary.
 * ============================================================
 */

import type { InputIntentType } from './input.js';

/**
 * Purpose: Draft jump-feel tunables — the four numbers that define
 * how the game's only verb feels.
 *
 * Why it exists: GDD §6.1 defines the jump's *shape* (impulse, hold
 * scaling, cap, early cut) but deliberately leaves its *numbers* to
 * playtesting (GDD §14 keeps tuning playtest-owned). These are
 * marked DRAFT: chosen to satisfy the documented shape and the
 * guarantees in player.test.ts, awaiting feel calibration against
 * the archived prototype (roadmap Step 3 gate).
 *
 * Units: velocities are world-units per tick at 60 ticks/second;
 * durations are ticks. Negative = upward (see the coordinate
 * convention in the file header).
 *
 * Why these are not in constants.ts yet: constants.ts belongs to the
 * Utilities module (maintainer's build order), which does not exist
 * yet. They live here, named and documented per CODING_STANDARDS
 * §11, and migrate when that module lands. Any change to these
 * values is a feel change and requires a SIM_VERSION bump once
 * SIM_VERSION exists (CODING_STANDARDS §9).
 *
 * Related systems: read by this file only; the Physics module will
 * add gravity/fall tunables of its own.
 */
export const JUMP = {
  /** Upward velocity granted the instant a grounded press lands —
   *  the "weight" of the tap jump (GDD §5.1: weighty). */
  IMPULSE_VELOCITY: -9,
  /** Extra upward velocity added on each tick the press is still
   *  held — this is literally "height scales with hold" (GDD §6.1). */
  HOLD_BOOST_PER_TICK: -0.5,
  /** How many ticks the hold boost can accumulate — the "up to a
   *  cap" in GDD §6.1. 16 ticks ≈ 0.27 s of thumb commitment. */
  HOLD_BOOST_MAX_TICKS: 16,
  /** On an early release while still rising faster than this, the
   *  rise is clamped to this — "releasing early cuts the jump
   *  short" (GDD §6.1). Without it, tap and hold would differ only
   *  by the boost, and short hops would feel floaty. */
  RELEASE_CUT_VELOCITY: -4.5,
} as const;

/**
 * Purpose: Everything the simulation knows about one player's body
 * and jump, at one instant.
 *
 * Why it exists: this is the player's complete kinematic truth —
 * small enough to hash every tick (statehash, ARCHITECTURE beacon
 * model), to snapshot for rendering, and to reproduce exactly in
 * replays. Match-level facts (lives, score, checkpoint, spawn
 * protection — GDD §8) are deliberately NOT here: the Match module
 * owns those and will compose this state, keeping each module's
 * responsibility singular.
 *
 * Why every field is readonly: states are history. The step
 * functions below return NEW states instead of editing old ones, so
 * a replay, a ghost, and a validator can all hold references to past
 * ticks without any risk of one consumer corrupting another's view.
 *
 * Related systems: Input (intents mutate jump state), Physics
 * (integrates x/y/vy), Camera (reads y for framing), Networking
 * Phase 2 (beacons carry position), replay/ghosts.
 */
export interface PlayerState {
  /** Stable identity — matches InputIntent.playerId (input.ts). */
  readonly id: string;
  /** Forward position in world units. Only the Physics module moves
   *  it, and only via the shared speed curve — never the player
   *  (GDD §12 Pillar 3: auto-forward). */
  readonly x: number;
  /** Vertical position in world units (y grows downward). */
  readonly y: number;
  /** Vertical velocity in units/tick. Negative = rising. There is
   *  deliberately no vx field: forward speed is match state, not
   *  player state — storing it here would invite per-player speed,
   *  which Pillar 7 (identical speed for all) forbids. */
  readonly vy: number;
  /** True when standing on terrain. Jumping is legal ONLY from the
   *  ground (GDD §6.1: no double jump). */
  readonly onGround: boolean;
  /** True from a grounded press until its release (or until the
   *  rise ends). While true, the hold boost may still accumulate. */
  readonly isHoldingJump: boolean;
  /** How many ticks of hold boost this jump has consumed — counts
   *  up to JUMP.HOLD_BOOST_MAX_TICKS and stops. */
  readonly holdTicksUsed: number;
}

/**
 * Purpose: Create a player at a spawn position, airborne and idle.
 *
 * Why it exists: match start and (later) checkpoint respawns both
 * need a well-defined initial state. Players spawn airborne with no
 * vertical speed and settle onto the terrain via normal physics —
 * one code path for "entering the world" instead of a special
 * "already grounded" state that collision code never verified.
 *
 * Inputs: id — stable player identity; x, y — spawn position in
 * world units (the Level module will supply safe positions,
 * GDD §8.4: respawns are safe by construction).
 * Outputs: a fresh PlayerState (airborne, vy = 0, no hold).
 * Side effects: none — pure function.
 * Related systems: Match module (spawning/respawning), Physics
 * (settles the spawn onto the ground).
 */
export function createPlayer(id: string, x: number, y: number): PlayerState {
  return {
    id,
    x,
    y,
    vy: 0,
    onGround: false,
    isHoldingJump: false,
    holdTicksUsed: 0,
  };
}

/**
 * Purpose: Apply one validated input intent (press or release) to a
 * player — the moment the thumb becomes gameplay.
 *
 * Why it exists: this function IS the control scheme. Every rule of
 * GDD §6.1 that concerns "what an input does" lives in these few
 * branches, and nowhere else:
 *   press  + on ground  → the jump starts, this very tick
 *                         (GDD §5.1: instantly responsive).
 *   press  + airborne   → nothing. No double jump, no air control —
 *                         a permanent ban (GDD §6.1, §12 Pillar 1).
 *   release + rising fast → the rise is clamped: an early release
 *                         cuts the jump short (GDD §6.1).
 *   release otherwise   → just ends the hold.
 *
 * Inputs: player — the state to advance; intent — 'press' or
 * 'release' (already validated by the IntentBuffer, so this function
 * trusts alternation — CODING_STANDARDS §10: validate at boundaries,
 * trust inside).
 * Outputs: the next PlayerState. When an intent changes nothing (a
 * press in mid-air), the SAME object is returned — callers and tests
 * can use identity to detect "no effect".
 * Side effects: none — pure function.
 * Related systems: called by the Simulation for each intent in a
 * tick's batch (input.ts TickInputs), in batch order — order matters
 * for a tap that presses and releases within a single tick.
 */
export function applyIntent(player: PlayerState, intent: InputIntentType): PlayerState {
  if (intent === 'press') {
    if (!player.onGround) {
      // No double jump (GDD §6.1). Returning the identical object —
      // not a copy — keeps "nothing happened" cheap and observable.
      return player;
    }
    // Liftoff: the whole tap jump is granted at once so the very
    // first tick of the jump already moves at full rise — the
    // "instantly responsive" requirement (GDD §5.1) in one line.
    return {
      ...player,
      vy: JUMP.IMPULSE_VELOCITY,
      onGround: false,
      isHoldingJump: true,
      holdTicksUsed: 0,
    };
  }

  // Release. Ending the hold always; cutting the rise only when the
  // player is still rising faster than the cut threshold — that is
  // what makes a quick tap produce a visibly shorter jump than a
  // full hold (GDD §6.1: "releasing early cuts the jump short").
  const shouldCutRise = player.isHoldingJump && player.vy < JUMP.RELEASE_CUT_VELOCITY;
  if (!player.isHoldingJump) {
    return player; // Release with no active hold: nothing to end.
  }
  return {
    ...player,
    isHoldingJump: false,
    vy: shouldCutRise ? JUMP.RELEASE_CUT_VELOCITY : player.vy,
  };
}

/**
 * Purpose: Advance the hold-boost by one tick — the "height scales
 * with hold" rule, paid out in per-tick installments.
 *
 * Why it exists: GDD §6.1 says hold height scales with hold duration
 * up to a cap. Rather than deciding the jump's height at press time
 * (which would need to know the future), the boost is added tick by
 * tick WHILE the thumb stays down, and simply stops at the cap or at
 * the apex. The player's real-time commitment is the input — exactly
 * the depth-from-one-verb the design bets on (GDD §2).
 *
 * The three stop conditions, each a rule:
 *   - not holding        → the thumb decides the height (§6.1);
 *   - cap reached        → "up to a cap" (§6.1) — endless boost
 *                          would be flight, which is banned (§11.3);
 *   - no longer rising   → boosting while falling would be air
 *                          control, which does not exist (§6.1).
 *
 * Inputs: player — the state to advance.
 * Outputs: the next PlayerState (same object when no boost applies).
 * Side effects: none — pure function.
 * Related systems: the Physics module calls this exactly once per
 * tick, before gravity, so hold strength and gravity interleave
 * deterministically in a fixed order (ARCHITECTURE §3: fixed
 * 60-tick timestep).
 */
export function applyJumpHold(player: PlayerState): PlayerState {
  const boostActive =
    player.isHoldingJump &&
    player.holdTicksUsed < JUMP.HOLD_BOOST_MAX_TICKS &&
    player.vy < 0;
  if (!boostActive) {
    return player;
  }
  return {
    ...player,
    vy: player.vy + JUMP.HOLD_BOOST_PER_TICK,
    holdTicksUsed: player.holdTicksUsed + 1,
  };
}

/**
 * Purpose: Transition a player onto the ground — the landing.
 *
 * Why it exists: landing is a state change with rules (the jump
 * machinery resets so the NEXT press can jump again), and those
 * rules belong to the Player module. The Physics module will detect
 * WHERE and WHEN a landing happens (terrain collision); this
 * function defines WHAT a landing means. That split keeps terrain
 * knowledge out of the player and jump knowledge out of physics.
 *
 * Inputs: player — the state to ground; groundY — the terrain
 * surface's y at the landing point (the player's y snaps to it;
 * world units, y grows downward).
 * Outputs: a grounded PlayerState with vertical motion zeroed and
 * the hold machinery cleared.
 * Side effects: none — pure function.
 * Related systems: Physics (caller, on collision), and later the
 * Match module (a clean landing is where checkpoint credit and
 * landing feedback hang — GDD §6.2's reward for clean landings is
 * presentation/scoring, not physics).
 */
export function land(player: PlayerState, groundY: number): PlayerState {
  return {
    ...player,
    y: groundY,
    vy: 0,
    onGround: true,
    isHoldingJump: false,
    holdTicksUsed: 0,
  };
}

/**
 * Purpose: Transition a player off the ground WITHOUT a jump —
 * walking off an edge into a gap.
 *
 * Why it exists: GDD §6.2 builds challenges from gaps; rolling off
 * an edge must NOT grant jump privileges mid-air. This is a
 * different transition from jumping: vy stays as-is (gravity, owned
 * by Physics, takes over) and — critically — no hold is started, so
 * a press while falling still does nothing (GDD §6.1: jumping is
 * only possible from the ground).
 *
 * Inputs: player — the state that just lost its footing.
 * Outputs: the airborne PlayerState (same object if already
 * airborne).
 * Side effects: none — pure function.
 * Related systems: Physics (caller, when terrain queries report no
 * ground under the player).
 */
export function leaveGround(player: PlayerState): PlayerState {
  if (!player.onGround) {
    return player;
  }
  return {
    ...player,
    onGround: false,
  };
}
