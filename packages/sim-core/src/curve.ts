/**
 * ============================================================
 *  curve.ts — the speed curve: the signature mechanic
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines the named, versioned curve that maps the shared match
 *    clock (the tick) to the world's forward speed, through the four
 *    documented phases: Normal → Faster → Very Fast → Extreme
 *    Survival — with an Extreme tail that rises forever.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §8.5: "The world accelerates through named phases on a
 *      SHARED MATCH CLOCK — every player in the room experiences the
 *      same speed at the same moment." Speed is a function of tick,
 *      never of distance or of any player — which is why respawns
 *      "never reset or slow the clock" for free: the clock simply
 *      does not know players exist.
 *    - GDD §12 Pillar 8: "The world always wins." The unbounded
 *      Extreme ramp is that pillar as arithmetic: there is no speed
 *      cap, so no run survives forever, so every match ends by
 *      escalation, not by a timer.
 *    - ARCHITECTURE §2.2: "forward speed is a named, versioned curve
 *      keyed to the shared match clock"; match length is "a tuning
 *      output, not a timer."
 *    - GDD §14 Q2: exact timings are an OPEN QUESTION with a working
 *      default of ~3.5 min median match. CURVE_DRAFT_1's numbers are
 *      that working default — DRAFT, playtest-owned, and any change
 *      bumps SIM_VERSION (CODING_STANDARDS §9).
 *
 *  HOW IT FITS
 *    The Simulation asks speedAt(tick) once per tick and hands the
 *    result to every player's physics step — Pillar 7 fairness is
 *    the caller giving everyone the same number. Phase changes
 *    become events (the banner and the audio beat). The camera's
 *    fixed zoom derives from BASE speed (camera.ts): the same window
 *    holds fewer seconds as speed rises — the game's difficulty.
 *
 *  WHAT IT MUST NEVER DO
 *    Consult players, distance, wall-clocks, or randomness. A curve
 *    is a pure function of the tick — that is the whole point.
 * ============================================================
 */

/** The four phase names, spelled exactly as GDD §8.5 spells them —
 *  this is the canonical type (CODING_STANDARDS §1: vocabulary from
 *  the GDD; the UI's theme.ts mirrors these strings). */
export type PhaseName = 'Normal' | 'Faster' | 'Very Fast' | 'Extreme Survival';

export interface SpeedCurve {
  /** Curve identity — replays and rooms name the curve they ran. */
  readonly id: string;
  /** Phase boundaries on the match clock, ascending. */
  readonly phases: ReadonlyArray<{ readonly name: PhaseName; readonly startTick: number }>;
  /** Piecewise-linear speed keyframes (units/tick), ascending. */
  readonly keys: ReadonlyArray<{ readonly tick: number; readonly speed: number }>;
  /** Speed added per tick beyond the last keyframe — the unbounded
   *  Extreme tail (Pillar 8: the world always wins). */
  readonly extremeRampPerTick: number;
}

const SECONDS = 60; // ticks per second — ARCHITECTURE §3's fixed rate

/**
 * Purpose: The draft launch curve — GDD §14 Q2's working default,
 * targeting a ~3.5 minute median match.
 *
 * Shape rationale: Normal is a readable warm-up ("nobody should die
 * here except by throwing", §8.5) with a gentle rise; each phase
 * steepens; Extreme starts barely sustainable and ramps ~+1.4
 * units/tick per minute forever. Base speed (4.2) is the number the
 * generator sizes challenges at and the camera derives its zoom
 * from — one number, three consumers, consistency-tested.
 */
export const CURVE_DRAFT_1: SpeedCurve = {
  id: 'draft-1',
  phases: [
    { name: 'Normal', startTick: 0 },
    { name: 'Faster', startTick: 45 * SECONDS },
    { name: 'Very Fast', startTick: 105 * SECONDS },
    { name: 'Extreme Survival', startTick: 175 * SECONDS },
  ],
  keys: [
    { tick: 0, speed: 4.2 },
    { tick: 45 * SECONDS, speed: 5.4 },
    { tick: 105 * SECONDS, speed: 7.2 },
    { tick: 175 * SECONDS, speed: 9.6 },
  ],
  extremeRampPerTick: 0.0004,
};

/**
 * Purpose: The world's speed at a tick — piecewise-linear between
 * keyframes, then the endless Extreme ramp.
 *
 * Inputs: curve — a SpeedCurve; tick — the match clock (≥ 0).
 * Outputs: forward speed in world units/tick. Monotonically
 * non-decreasing in tick (tested) — the world never relents.
 * Side effects: none — pure function (plain +, −, ×, ÷ only).
 */
export function speedAt(curve: SpeedCurve, tick: number): number {
  const keys = curve.keys;
  const last = keys[keys.length - 1];
  if (last === undefined) throw new Error('speedAt: curve has no keyframes');
  if (tick >= last.tick) {
    return last.speed + (tick - last.tick) * curve.extremeRampPerTick;
  }
  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1];
    const b = keys[i];
    if (a !== undefined && b !== undefined && tick < b.tick) {
      const t = (tick - a.tick) / (b.tick - a.tick);
      return a.speed + t * (b.speed - a.speed);
    }
  }
  return last.speed;
}

/**
 * Purpose: Which phase the match clock is in (0..3) and its name —
 * for the banner, the beat, and the results screen.
 * Inputs: curve, tick. Outputs: the highest phase whose startTick
 * has been reached. Side effects: none — pure.
 */
export function phaseIndexAt(curve: SpeedCurve, tick: number): number {
  let index = 0;
  for (let i = 0; i < curve.phases.length; i += 1) {
    const phase = curve.phases[i];
    if (phase !== undefined && tick >= phase.startTick) index = i;
  }
  return index;
}
export function phaseNameAt(curve: SpeedCurve, tick: number): PhaseName {
  const phase = curve.phases[phaseIndexAt(curve, tick)];
  return phase === undefined ? 'Normal' : phase.name;
}
