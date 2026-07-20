/**
 * ============================================================
 *  camera.test.ts — guarantees of the Camera module
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the portrait window's rules: the anchor holds at exactly
 *    28%, zoom derives from the named lookahead parameter and is
 *    identical for everyone, the dead-zone swallows small bounces,
 *    the velocity bias looks where the player is going, and the
 *    ease is frame-rate independent — smoothness must never become
 *    an information advantage (ARCHITECTURE §2.1 fairness rule).
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  CAMERA,
  computeFixedZoom,
  createCamera,
  frameCamera,
  stepCamera,
  type ViewTarget,
} from './camera.js';

const still = (x: number, y: number): ViewTarget => ({ x, y, vy: 0 });

describe('Camera — fixed zoom from the named lookahead parameter (ARCHITECTURE §2.1)', () => {
  it('the screen ahead of the player holds exactly LOOKAHEAD_SECONDS of terrain at base speed', () => {
    const baseSpeed = 4.2; // any value works — the property must hold
    const zoom = computeFixedZoom(baseSpeed);
    const worldAheadOnScreen = (CAMERA.DESIGN_WIDTH * (1 - CAMERA.PLAYER_ANCHOR_RATIO)) / zoom;
    const secondsAhead = worldAheadOnScreen / (baseSpeed * 60);
    expect(secondsAhead).toBeCloseTo(CAMERA.LOOKAHEAD_SECONDS, 10);
  });

  it('lookahead sits in the documented 2–3 second range (GDD §6.3)', () => {
    expect(CAMERA.LOOKAHEAD_SECONDS).toBeGreaterThanOrEqual(2);
    expect(CAMERA.LOOKAHEAD_SECONDS).toBeLessThanOrEqual(3);
  });

  it('zoom is a pure function of shared constants — every client computes the identical value', () => {
    expect(computeFixedZoom(4.2)).toBe(computeFixedZoom(4.2)); // fairness: no hidden state
  });
});

describe('Camera — the horizontal anchor is rigid (GDD §6.3: left third; Pillar 3)', () => {
  it('the player renders at exactly PLAYER_ANCHOR_RATIO of the frame width', () => {
    const zoom = computeFixedZoom(4.2);
    const target = still(12345, 80);
    const frame = frameCamera(createCamera(target), target, zoom);
    const playerScreenX = (target.x - frame.worldLeft) * zoom;
    expect(playerScreenX).toBeCloseTo(CAMERA.PLAYER_ANCHOR_RATIO * CAMERA.DESIGN_WIDTH, 10);
  });

  it('the anchor holds at any x — no drift, no easing, no rubber-banding', () => {
    const zoom = computeFixedZoom(4.2);
    const camera = createCamera(still(0, 0));
    for (const x of [0, 500, 99999]) {
      const frame = frameCamera(camera, still(x, 0), zoom);
      expect((x - frame.worldLeft) * zoom).toBeCloseTo(CAMERA.PLAYER_ANCHOR_RATIO * CAMERA.DESIGN_WIDTH, 10);
    }
  });
});

describe('Camera — vertical follow (ARCHITECTURE §2.1: dead-zone, bias, smoothing)', () => {
  it('small bounces inside the dead-zone do not move the camera at all', () => {
    const camera = createCamera(still(0, 100));
    const wiggled = stepCamera(camera, still(10, 100 + CAMERA.VERTICAL_DEADZONE - 1), 16.7);
    expect(wiggled).toBe(camera); // identical object: provably untouched
  });

  it('a big drop moves the camera toward the player — but smoothly, never all at once', () => {
    const camera = createCamera(still(0, 100));
    const after = stepCamera(camera, still(10, 400), 16.7);
    expect(after.centerY).toBeGreaterThan(camera.centerY); // moving down (y grows down)
    expect(after.centerY).toBeLessThan(400); // but not teleporting
  });

  it('the velocity bias looks where the player is GOING: rising players see more above', () => {
    const camera = createCamera(still(0, 300));
    const dropTarget: ViewTarget = { x: 0, y: 100, vy: 0 };
    const risingTarget: ViewTarget = { x: 0, y: 100, vy: -8 }; // rising fast
    const afterStill = stepCamera(camera, dropTarget, 16.7);
    const afterRising = stepCamera(camera, risingTarget, 16.7);
    expect(afterRising.centerY).toBeLessThan(afterStill.centerY); // biased upward
  });

  it('the follow converges: after enough time the camera rests at the dead-zone edge of the target', () => {
    let camera = createCamera(still(0, 0));
    const target = still(0, 500);
    for (let i = 0; i < 300; i += 1) camera = stepCamera(camera, target, 16.7);
    expect(Math.abs(500 - camera.centerY)).toBeLessThanOrEqual(CAMERA.VERTICAL_DEADZONE + 1e-6);
  });
});

describe('Camera — frame-rate independence (smoothness is not an information advantage)', () => {
  it('two 8.35 ms steps land where one 16.7 ms step lands — 120 Hz eases along the 60 Hz curve', () => {
    const target = still(0, 500);
    const start = createCamera(still(0, 0));
    const oneStep = stepCamera(start, target, 16.7);
    const twoSteps = stepCamera(stepCamera(start, target, 8.35), target, 8.35);
    expect(twoSteps.centerY).toBeCloseTo(oneStep.centerY, 6);
  });
});

describe('Camera — purity (presentation observes; it never touches)', () => {
  it('no function mutates its inputs', () => {
    const camera = createCamera(still(0, 100));
    const snapshot = { ...camera };
    const target = still(50, 400);
    const targetSnapshot = { ...target };
    stepCamera(camera, target, 16.7);
    frameCamera(camera, target, computeFixedZoom(4.2));
    expect(camera).toEqual(snapshot);
    expect(target).toEqual(targetSnapshot);
  });
});
