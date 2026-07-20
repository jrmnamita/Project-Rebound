/**
 * ============================================================
 *  player.test.ts — guarantees of the Player module
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins every GDD §6.1 jump rule as an executable guarantee:
 *    ground-only jumping, instant liftoff, hold-scaled height with
 *    a hard cap, early-release cut, landing/edge transitions, and
 *    the purity that replays depend on.
 *
 *  WHY IT EXISTS (design anchor)
 *    The jump IS the product (GDD §5.1). These tests are also the
 *    feel-regression tripwire: JUMP tunables are DRAFT, and any
 *    retune that changes a guarantee here must be deliberate
 *    (CODING_STANDARDS §9: feel changes are visible changes).
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  JUMP,
  applyIntent,
  applyJumpHold,
  createPlayer,
  land,
  leaveGround,
  type PlayerState,
} from '@rebound/sim-core';

/** A grounded player at the origin — the standard test fixture. */
function grounded(): PlayerState {
  return land(createPlayer('p1', 0, 0), 0);
}

/** Run N ticks of hold boost, returning the resulting state. */
function boostTicks(player: PlayerState, n: number): PlayerState {
  let state = player;
  for (let i = 0; i < n; i += 1) state = applyJumpHold(state);
  return state;
}

describe('Player — ground-only jumping (GDD §6.1: no double jump, no air control)', () => {
  it('a press on the ground lifts off this very tick (GDD §5.1: instantly responsive)', () => {
    const jumped = applyIntent(grounded(), 'press');
    expect(jumped.onGround).toBe(false);
    expect(jumped.vy).toBe(JUMP.IMPULSE_VELOCITY);
    expect(jumped.isHoldingJump).toBe(true);
  });

  it('a press in mid-air does nothing — returns the identical state object', () => {
    const airborne = applyIntent(grounded(), 'press');
    expect(applyIntent(airborne, 'press')).toBe(airborne);
  });

  it('rolling off an edge grants no jump: press while falling is still ignored', () => {
    const falling = leaveGround(grounded());
    expect(falling.onGround).toBe(false);
    expect(falling.isHoldingJump).toBe(false);
    expect(applyIntent(falling, 'press')).toBe(falling);
  });
});

describe('Player — hold scales height up to a cap (GDD §6.1)', () => {
  it('each held tick adds boost, so longer holds rise faster', () => {
    const jumped = applyIntent(grounded(), 'press');
    const shortHold = boostTicks(jumped, 3);
    const longHold = boostTicks(jumped, 10);
    // vy is negative-up: a faster rise is a MORE negative vy.
    expect(longHold.vy).toBeLessThan(shortHold.vy);
  });

  it('the boost stops exactly at HOLD_BOOST_MAX_TICKS — the cap', () => {
    const jumped = applyIntent(grounded(), 'press');
    const atCap = boostTicks(jumped, JUMP.HOLD_BOOST_MAX_TICKS);
    const pastCap = applyJumpHold(atCap);
    expect(atCap.holdTicksUsed).toBe(JUMP.HOLD_BOOST_MAX_TICKS);
    expect(pastCap).toBe(atCap); // identical object: no further effect
  });

  it('the boost stops at the apex — no boosting while falling (that would be air control)', () => {
    const jumped = applyIntent(grounded(), 'press');
    // Force the falling condition directly: vy >= 0 means no longer rising.
    const falling: PlayerState = { ...jumped, vy: 1 };
    expect(applyJumpHold(falling)).toBe(falling);
  });

  it('no hold, no boost: a released jump gains nothing from applyJumpHold', () => {
    const released = applyIntent(applyIntent(grounded(), 'press'), 'release');
    expect(applyJumpHold(released)).toBe(released);
  });
});

describe('Player — early release cuts the jump short (GDD §6.1)', () => {
  it('releasing immediately after press clamps the rise to RELEASE_CUT_VELOCITY', () => {
    const tapped = applyIntent(applyIntent(grounded(), 'press'), 'release');
    expect(tapped.vy).toBe(JUMP.RELEASE_CUT_VELOCITY);
    expect(tapped.isHoldingJump).toBe(false);
  });

  it('releasing after the rise has slowed past the cut threshold changes nothing but the hold', () => {
    const jumped = applyIntent(grounded(), 'press');
    // Rising slower than the cut threshold (closer to zero): no clamp applies.
    const slowRise: PlayerState = { ...jumped, vy: JUMP.RELEASE_CUT_VELOCITY + 1 };
    const released = applyIntent(slowRise, 'release');
    expect(released.vy).toBe(slowRise.vy);
    expect(released.isHoldingJump).toBe(false);
  });

  it('tap and full hold produce measurably different jumps — the depth of the one verb', () => {
    const jumped = applyIntent(grounded(), 'press');
    const tap = applyIntent(jumped, 'release');
    const fullHold = boostTicks(jumped, JUMP.HOLD_BOOST_MAX_TICKS);
    expect(fullHold.vy).toBeLessThan(tap.vy); // hold rises much faster
  });
});

describe('Player — landing and edges reset the verb correctly', () => {
  it('landing grounds the player, zeroes vertical motion, and re-arms the jump', () => {
    const midJump = boostTicks(applyIntent(grounded(), 'press'), 5);
    const landed = land(midJump, 120);
    expect(landed).toMatchObject({ y: 120, vy: 0, onGround: true, isHoldingJump: false, holdTicksUsed: 0 });
    // The next press must work: one jump per ground contact, every time.
    expect(applyIntent(landed, 'press').vy).toBe(JUMP.IMPULSE_VELOCITY);
  });

  it('leaveGround on an airborne player is a no-op (identical object)', () => {
    const airborne = applyIntent(grounded(), 'press');
    expect(leaveGround(airborne)).toBe(airborne);
  });
});

describe('Player — purity and determinism (the replay contract)', () => {
  it('functions never mutate their inputs', () => {
    const before = grounded();
    const snapshot = { ...before };
    applyIntent(before, 'press');
    applyJumpHold(before);
    land(before, 50);
    leaveGround(before);
    expect(before).toEqual(snapshot);
  });

  it('the same intent/boost sequence from the same start yields identical states', () => {
    const run = (): PlayerState => {
      let s = grounded();
      s = applyIntent(s, 'press');
      s = boostTicks(s, 7);
      s = applyIntent(s, 'release');
      s = land(s, 30);
      s = applyIntent(s, 'press');
      return boostTicks(s, JUMP.HOLD_BOOST_MAX_TICKS + 5);
    };
    expect(run()).toEqual(run());
  });
});
