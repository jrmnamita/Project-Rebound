/**
 * ============================================================
 *  camera.ts — the Camera: the portrait window onto a
 *               horizontal world
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Computes, every render frame, which rectangle of the world the
 *    player sees: a fixed zoom derived from a named lookahead
 *    parameter, a rigid horizontal anchor that keeps the player at
 *    ~28% from the left edge, and a smoothed vertical follow with a
 *    dead-zone and a velocity bias. Pure math only — the Phaser
 *    scene (a later module) feeds it player snapshots and applies
 *    the resulting frame to the real rendering camera.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §3 + Pillar 4: "the portrait window IS the difficulty" —
 *      a horizontal side-scroller seen through a narrow 9:16 frame.
 *      The camera is where that signature tension is manufactured.
 *    - GDD §6.3: player in the left third, ~2–3 seconds of lookahead
 *      at base speed, generous vertical framing, identical framing
 *      for every player, portrait-only.
 *    - ARCHITECTURE §2.1: player anchored at the left ~28% of screen
 *      width; smoothed vertical tracking with lookahead bias in the
 *      player's vertical velocity direction; a soft vertical
 *      dead-zone; and "visible-lookahead-in-seconds becomes a NAMED
 *      design parameter, not an accident of resolution" — that
 *      parameter is CAMERA.LOOKAHEAD_SECONDS below.
 *    - ARCHITECTURE §2.1 fairness rule: "camera framing must never
 *      differ between players — same zoom, same anchor, same
 *      lookahead — so no client gains an information advantage."
 *      Enforced structurally: every constant is module-level and
 *      immutable, and no function in this file accepts a per-player
 *      framing parameter. There is no API through which one player
 *      could see more world than another.
 *
 *  HOW IT FITS
 *    The GameHost (Game Loop module, later) passes player snapshots
 *    each render frame; the Phaser scene applies the returned
 *    CameraFrame. The ViewTarget interface below is consumer-defined
 *    (the same pattern as physics.ts's GroundQuery): sim-core's
 *    PlayerState satisfies it structurally, so this file needs no
 *    import from the simulation — presentation observes, never
 *    reaches in.
 *
 *  WHAT IT MUST NEVER DO
 *    Influence gameplay (nothing in the simulation may ever read
 *    camera state), rotate (portrait-only, Pillar 2), or vary its
 *    framing per player. A note on math: this file uses Math.exp —
 *    legal HERE because the camera lives OUTSIDE the determinism
 *    boundary (the sim-core ban on engine-variant math exists to
 *    protect gameplay agreement; a least-significant-bit difference
 *    in a camera ease can never desync a match). The exponential is
 *    chosen deliberately: it makes the follow feel identical at any
 *    frame rate (see stepCamera).
 * ============================================================
 */

/**
 * Purpose: The framing constants — the whole personality of the
 * portrait window, in one place.
 *
 * Why it exists: ARCHITECTURE §2.1 demands the lookahead be a NAMED
 * parameter, and the fairness rule demands one shared truth for all
 * players. DRAFT values within the documented ranges (GDD §6.3:
 * "roughly 2–3 seconds", "left third"); feel calibration is
 * playtest-owned (GDD §14). They migrate to a shared presentation
 * config when the UI module lands.
 */
export const CAMERA = {
  /** Logical design viewport: 9:16 portrait (Pillars 2 and 4). The
   *  scene letterboxes/fits this onto real screens; camera math
   *  always works in these design pixels. */
  DESIGN_WIDTH: 540,
  DESIGN_HEIGHT: 960,
  /** The player's horizontal anchor: 28% from the left edge
   *  (ARCHITECTURE §2.1), maximizing forward visibility — the other
   *  72% of the screen is the future rushing in. */
  PLAYER_ANCHOR_RATIO: 0.28,
  /** THE named design parameter: how many seconds of terrain (at
   *  base match speed) fit between the player and the right edge.
   *  GDD §6.3 says "roughly 2–3 seconds"; as speed rises the same
   *  window holds fewer seconds — that shrinking reaction time IS
   *  the game's difficulty knob (GDD §3). */
  LOOKAHEAD_SECONDS: 2.5,
  /** Vertical dead-zone half-height (design px at zoom 1): small
   *  hops inside this band do not move the camera at all — bounce
   *  without nausea (ARCHITECTURE §2.1's "soft vertical dead-zone",
   *  so "small bounces don't shake the camera"). */
  VERTICAL_DEADZONE: 60,
  /** Velocity bias: the vertical target leads the player by this
   *  many ticks of their current vy, so the camera looks toward
   *  where they are GOING — up when rising, down when dropping
   *  (ARCHITECTURE §2.1 "lookahead bias in the player's vertical
   *  velocity direction"; GDD §6.3 "hills and drops read
   *  beautifully in the tall frame"). */
  VERTICAL_LOOKAHEAD_TICKS: 10,
  /** Time constant (ms) of the vertical ease: after this much real
   *  time the camera has closed ~63% of the remaining distance.
   *  Time-based (not per-frame) so the follow FEELS identical at
   *  60 Hz and 120 Hz — see stepCamera. */
  SMOOTHING_TAU_MS: 180,
} as const;

/**
 * Purpose: What the camera needs to know about the thing it films —
 * position and vertical velocity, nothing more.
 *
 * Why it exists: consumer-defined interface, the same seam pattern
 * as physics.ts's GroundQuery. sim-core's PlayerState satisfies this
 * shape structurally, so presentation observes the simulation
 * without importing it — the dependency arrow stays intact even in
 * spirit (FOLDER_STRUCTURE §2: apps depend on packages, but the less
 * surface presentation touches, the less it can be tempted by).
 */
export interface ViewTarget {
  readonly x: number;
  readonly y: number;
  /** Vertical velocity, units/tick, negative = rising (the sim's
   *  convention — see player.ts's coordinate note). */
  readonly vy: number;
}

/** Purpose: the camera's own memory — only the smoothed vertical
 *  center. Horizontal position needs no memory (it is rigidly
 *  derived from the player every frame), so it is not state. */
export interface CameraState {
  readonly centerY: number;
}

/**
 * Purpose: The rectangle of world to render this frame: its top-left
 * corner in world units, and the zoom that maps world units to
 * design pixels.
 *
 * Why it exists: this is the camera's entire OUTPUT — a plain value
 * the Phaser scene applies (scrollX/scrollY/zoom) without knowing
 * any of the rules that produced it. Presentation renders results;
 * it never re-derives rules (CODING_STANDARDS §7).
 */
export interface CameraFrame {
  readonly worldLeft: number;
  readonly worldTop: number;
  readonly zoom: number;
}

/**
 * Purpose: Compute the one fixed zoom used for the whole match —
 * from the named lookahead parameter and the base match speed.
 *
 * Why it exists: ARCHITECTURE §2.1 — lookahead is a design
 * parameter, so zoom must be DERIVED from it, not eyeballed: the 72%
 * of the screen ahead of the player must hold exactly
 * LOOKAHEAD_SECONDS of terrain at base speed. Zoom is computed ONCE
 * (at base speed) and never changes during a match: as the world
 * accelerates, the same window holds fewer seconds — the shrinking
 * reaction window that IS the difficulty (GDD §3). A speed-tracking
 * zoom would cancel the game's core tension; a per-player zoom would
 * break the fairness rule. Neither is expressible with this API.
 *
 * Inputs:
 *   baseSpeedUnitsPerTick — the speed curve's base (Normal-phase
 *     start) speed. Passed in by the caller because the curve module
 *     (Procedural/Utilities work) owns that number — the camera does
 *     not duplicate gameplay constants.
 *   tickRate — simulation ticks per second (the caller passes the
 *     sim's real rate; default 60 per ARCHITECTURE §3).
 * Outputs: zoom in design-pixels per world-unit.
 * Side effects: none — pure function.
 * Related systems: the scene computes this once at match start;
 * every player's client computes the identical value (fairness).
 */
export function computeFixedZoom(baseSpeedUnitsPerTick: number, tickRate = 60): number {
  const worldUnitsAhead = baseSpeedUnitsPerTick * tickRate * CAMERA.LOOKAHEAD_SECONDS;
  const designPxAhead = CAMERA.DESIGN_WIDTH * (1 - CAMERA.PLAYER_ANCHOR_RATIO);
  return designPxAhead / worldUnitsAhead;
}

/**
 * Purpose: Create the camera's starting state, centered on the
 * player — no easing artifacts on the first frame of a match.
 *
 * Inputs: target — the player snapshot at match start.
 * Outputs: a CameraState centered on them.
 * Side effects: none — pure function.
 */
export function createCamera(target: ViewTarget): CameraState {
  return { centerY: target.y };
}

/**
 * Purpose: Advance the smoothed vertical follow by one RENDER frame.
 *
 * Why it exists — three rules composed, each from ARCHITECTURE §2.1:
 *   1. Velocity bias: the ideal center leads the player by
 *      VERTICAL_LOOKAHEAD_TICKS of vy, so drops reveal what is
 *      below and jumps reveal what is above.
 *   2. Dead-zone: if that ideal sits within VERTICAL_DEADZONE of the
 *      current center, the camera does not move — the rhythm bounce
 *      of normal play (GDD §7's moment loop) leaves the horizon
 *      still.
 *   3. Time-based ease: outside the dead-zone, the camera closes the
 *      gap exponentially with time constant SMOOTHING_TAU_MS. The
 *      easing factor is computed from REAL elapsed milliseconds, so
 *      a 120 Hz client eases along the same curve as a 60 Hz client
 *      — smoothness may not become an information advantage
 *      (fairness rule, §2.1). This is the presentation-layer mirror
 *      of the sim's fixed timestep: the sim fixes dt to stay
 *      deterministic; the camera parameterizes by dt to stay FAIR.
 *
 * Inputs: camera — current state; target — the player snapshot;
 * dtMs — real milliseconds since the previous render frame.
 * Outputs: the next CameraState (same object if inside dead-zone).
 * Side effects: none — pure function.
 * Related systems: called by the scene every render frame, between
 * sim ticks; interpolated player positions (Game Loop module) feed
 * it for extra smoothness.
 */
export function stepCamera(camera: CameraState, target: ViewTarget, dtMs: number): CameraState {
  // Rule 1 — where the camera WANTS to look: ahead of the motion.
  const idealCenterY = target.y + target.vy * CAMERA.VERTICAL_LOOKAHEAD_TICKS;

  // Rule 2 — the dead-zone: small errors are not worth moving for.
  const error = idealCenterY - camera.centerY;
  if (Math.abs(error) <= CAMERA.VERTICAL_DEADZONE) {
    return camera;
  }
  // Chase only the part of the error that sticks out of the band —
  // this is what makes the zone's edge SOFT rather than a jerk.
  const desiredCenterY = idealCenterY - Math.sign(error) * CAMERA.VERTICAL_DEADZONE;

  // Rule 3 — frame-rate-independent exponential ease. Math.exp is
  // legal outside the determinism boundary (see file header).
  const easeFactor = 1 - Math.exp(-dtMs / CAMERA.SMOOTHING_TAU_MS);
  return { centerY: camera.centerY + (desiredCenterY - camera.centerY) * easeFactor };
}

/**
 * Purpose: Turn camera state + player position into the world
 * rectangle to render — the camera's only deliverable.
 *
 * Why it exists (the rules it implements):
 *   - Horizontal is RIGID, no easing: auto-forward (Pillar 3) means
 *     forward motion is perfectly steady, so any horizontal lag
 *     would read as rubber-banding. The player sits at exactly
 *     PLAYER_ANCHOR_RATIO of the frame width, every frame — the
 *     "left third" of GDD §6.3.
 *   - Vertical comes from the smoothed centerY (stepCamera).
 *   - Zoom is the fixed match zoom (computeFixedZoom).
 *
 * Inputs: camera — smoothed state; target — the player snapshot;
 * zoom — the fixed zoom.
 * Outputs: the CameraFrame for the renderer.
 * Side effects: none — pure function.
 */
export function frameCamera(camera: CameraState, target: ViewTarget, zoom: number): CameraFrame {
  const visibleWorldWidth = CAMERA.DESIGN_WIDTH / zoom;
  const visibleWorldHeight = CAMERA.DESIGN_HEIGHT / zoom;
  return {
    worldLeft: target.x - CAMERA.PLAYER_ANCHOR_RATIO * visibleWorldWidth,
    worldTop: camera.centerY - visibleWorldHeight / 2,
    zoom,
  };
}
