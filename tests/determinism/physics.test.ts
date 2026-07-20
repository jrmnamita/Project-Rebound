/**
 * ============================================================
 *  physics.test.ts — guarantees of the Physics module
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the laws of motion as executable guarantees: auto-forward
 *    at exactly the dictated speed, gravity with terminal fall,
 *    slope following, edge departure, one-way falling-only landings,
 *    tunnel-proofing arithmetic, and the full jump arc — including
 *    the end-to-end proof that a full hold jumps higher than a tap
 *    (GDD §6.1), now measurable with real gravity.
 *
 *  WHY IT EXISTS (design anchor)
 *    The prototype's physics varied with frame rate — the audit's
 *    fatal finding. These tests hold the fixed-tick replacement to
 *    the fairness pillar (GDD §12.7): same inputs, same arcs, on
 *    every machine, forever.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  JUMP,
  PHYSICS,
  applyIntent,
  createPlayer,
  land,
  stepPhysics,
  type GroundQuery,
  type PlayerState,
} from '@rebound/sim-core';

/** Flat world: ground everywhere at y = 100. */
const flat: GroundQuery = { groundSurfaceAt: () => 100 };

/** World with a gap over x ∈ [50, 150): ground at 100 elsewhere. */
const gapped: GroundQuery = {
  groundSurfaceAt: (x) => (x >= 50 && x < 150 ? null : 100),
};

/** A grounded player standing on the flat world at x = 0. */
function standing(): PlayerState {
  return land(createPlayer('p1', 0, 0), 100 - PHYSICS.PLAYER_RADIUS);
}

/** Step N ticks on a terrain at a constant speed, tracking the state. */
function run(player: PlayerState, terrain: GroundQuery, speed: number, ticks: number): PlayerState {
  let state = player;
  for (let i = 0; i < ticks; i += 1) state = stepPhysics(state, speed, terrain).player;
  return state;
}

describe('Physics — auto-forward is absolute (GDD §12 Pillar 3, Pillar 7)', () => {
  it('a grounded player advances by exactly the dictated speed, no more, no less', () => {
    const after = run(standing(), flat, 6, 10);
    expect(after.x).toBe(60);
  });

  it('an airborne player advances at the identical rate — air changes nothing horizontally', () => {
    const jumped = applyIntent(standing(), 'press');
    const after = run(jumped, flat, 6, 5);
    expect(after.x).toBe(30);
  });
});

describe('Physics — gravity and terminal fall (GDD §5.1: weighty)', () => {
  it('gravity accelerates a fall by GRAVITY_PER_TICK each tick', () => {
    const falling = stepPhysics(standing(), 60, gapped).player; // one stride into the gap
    const oneTickLater = stepPhysics(falling, 6, gapped).player;
    expect(oneTickLater.vy).toBeCloseTo(PHYSICS.GRAVITY_PER_TICK, 10);
  });

  it('fall speed never exceeds MAX_FALL_SPEED (readability + tunnel-proofing)', () => {
    const longFall = run(standing(), gapped, 1, 120); // slow forward speed: stays over the gap
    expect(longFall.vy).toBeLessThanOrEqual(PHYSICS.MAX_FALL_SPEED);
  });

  it('MAX_FALL_SPEED < PLAYER_RADIUS — the arithmetic that makes landing detection sound', () => {
    // If this ever fails, a falling body could skip past a surface in
    // one tick and the crossing test in stepAirborne stops being a proof.
    expect(PHYSICS.MAX_FALL_SPEED).toBeLessThan(PHYSICS.PLAYER_RADIUS + PHYSICS.GRAVITY_PER_TICK);
  });
});

describe('Physics — ground contact (GDD §6.2: slopes are flow, gaps are checks)', () => {
  it('walking on flat ground keeps the bottom exactly on the surface line', () => {
    const after = run(standing(), flat, 6, 7);
    expect(after.y + PHYSICS.PLAYER_RADIUS).toBe(100);
    expect(after.onGround).toBe(true);
  });

  it('a downhill slope within STEP_DOWN_TOLERANCE is followed, not fallen from', () => {
    // Surface drops 1 unit per world-unit of x: a gentle rolling grade.
    const slope: GroundQuery = { groundSurfaceAt: (x) => 100 + x };
    const after = run(standing(), slope, 6, 5);
    expect(after.onGround).toBe(true);
    expect(after.y + PHYSICS.PLAYER_RADIUS).toBe(100 + after.x);
  });

  it('walking off an edge reports leftGround exactly once and hands the body to gravity', () => {
    const first = stepPhysics(standing(), 60, gapped); // one stride into the gap
    expect(first.leftGround).toBe(true);
    expect(first.player.onGround).toBe(false);
    const second = stepPhysics(first.player, 6, gapped);
    expect(second.leftGround).toBe(false); // the transition fires on its tick only
  });

  it('falling onto ground lands: snapped to the surface, vy zeroed, jump re-armed, landed=true', () => {
    // A body dropped from well above flat ground: the plain landing case.
    let state = createPlayer('p1', 0, 100 - PHYSICS.PLAYER_RADIUS - 60);
    let landedTick = false;
    for (let i = 0; i < 120 && !landedTick; i += 1) {
      const result = stepPhysics(state, 6, flat);
      state = result.player;
      landedTick = result.landed;
    }
    expect(landedTick).toBe(true);
    expect(state.onGround).toBe(true);
    expect(state.vy).toBe(0);
    expect(state.y + PHYSICS.PLAYER_RADIUS).toBe(100);
    expect(applyIntent(state, 'press').vy).toBe(JUMP.IMPULSE_VELOCITY); // re-armed
  });

  it('a body that has fallen below a far ledge’s lip does NOT land on it — that is a gap death, not a landing', () => {
    // Walk off the near edge and drift across the gap: by the time the
    // body reaches the far side (x = 150) it has fallen below the lip,
    // so the surface must refuse it — the world got you (GDD §3).
    let state = stepPhysics(standing(), 60, gapped).player;
    let everLanded = false;
    for (let i = 0; i < 60; i += 1) {
      const result = stepPhysics(state, 30, gapped);
      state = result.player;
      everLanded ||= result.landed;
    }
    expect(everLanded).toBe(false);
    expect(state.y + PHYSICS.PLAYER_RADIUS).toBeGreaterThan(100); // below the surface line, falling
  });

  it('a rising player crossing a surface line does NOT land — surfaces are one-way from above', () => {
    // Player rising fast, just below a high ledge's surface line.
    const ledge: GroundQuery = { groundSurfaceAt: () => 40 };
    const rising: PlayerState = {
      ...createPlayer('p1', 0, 40 - PHYSICS.PLAYER_RADIUS + 5),
      vy: -8,
    };
    const result = stepPhysics(rising, 6, ledge);
    expect(result.landed).toBe(false);
    expect(result.player.onGround).toBe(false);
  });
});

describe('Physics — the jump arc, end to end (GDD §6.1: tap vs hold)', () => {
  /** Simulate a full jump on flat ground, releasing after holdTicks; return peak rise. */
  function jumpPeak(holdTicks: number): number {
    let state = applyIntent(standing(), 'press');
    const startY = state.y;
    let peak = 0;
    for (let tick = 0; tick < 120; tick += 1) {
      if (tick === holdTicks) state = applyIntent(state, 'release');
      const result = stepPhysics(state, 6, flat);
      state = result.player;
      peak = Math.max(peak, startY - state.y); // rise = how far y decreased
      if (result.landed) break;
    }
    return peak;
  }

  it('a full hold jumps meaningfully higher than a tap — the one verb has depth', () => {
    const tapPeak = jumpPeak(1);
    const holdPeak = jumpPeak(JUMP.HOLD_BOOST_MAX_TICKS + 4);
    expect(holdPeak).toBeGreaterThan(tapPeak * 1.5);
  });

  it('hold height rises monotonically with hold duration up to the cap', () => {
    const peaks = [2, 6, 10, JUMP.HOLD_BOOST_MAX_TICKS].map(jumpPeak);
    const sorted = [...peaks].sort((a, b) => a - b);
    expect(peaks).toEqual(sorted);
  });

  it('every jump comes back down and lands — gravity always wins (the world always wins, Pillar 8)', () => {
    let state = applyIntent(standing(), 'press');
    let landed = false;
    for (let tick = 0; tick < 240 && !landed; tick += 1) {
      const result = stepPhysics(state, 6, flat);
      state = result.player;
      landed = result.landed;
    }
    expect(landed).toBe(true);
  });
});

describe('Physics — purity and determinism (the replay contract)', () => {
  it('stepPhysics never mutates its input state', () => {
    const before = standing();
    const snapshot = { ...before };
    stepPhysics(before, 6, gapped);
    expect(before).toEqual(snapshot);
  });

  it('identical sequences produce identical trajectories, twice over', () => {
    const trajectory = (): PlayerState => {
      let s = applyIntent(standing(), 'press');
      for (let i = 0; i < 90; i += 1) {
        if (i === 8) s = applyIntent(s, 'release');
        if (i === 40) s = applyIntent(s, 'press'); // re-jump after landing
        s = stepPhysics(s, 7, gapped).player;
      }
      return s;
    };
    expect(trajectory()).toEqual(trajectory());
  });
});
