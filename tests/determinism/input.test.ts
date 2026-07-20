/**
 * ============================================================
 *  input.test.ts — guarantees of the Input System
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins down, as executable guarantees, every promise input.ts
 *    makes: press/release alternation, hold state across ticks,
 *    flood capping, per-player independence, and determinism
 *    (same calls in → same intents out, twice over).
 *
 *  WHY IT EXISTS (design anchor)
 *    The determinism suite is the mechanical enforcement of the
 *    fairness pillar (GDD §12.7) — CODING_STANDARDS §10 declares a
 *    red run here stop-ship. Each test name states the rule it
 *    guards and, where applicable, the document that demands it.
 *
 *  HOW IT FITS
 *    Runs headlessly in Node with zero rendering — which is itself
 *    the proof that the Input System has no framework dependency.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  IntentBuffer,
  MAX_INTENTS_PER_PLAYER_PER_TICK,
  type TickInputs,
} from '@rebound/sim-core';

/** Convenience: drain and return only the intent types, for terse assertions. */
function types(batch: TickInputs): string[] {
  return batch.map((intent) => intent.type);
}

describe('IntentBuffer — press/release alternation (GDD §6.1: tap/hold is one press, one release)', () => {
  it('accepts a press, then a release, in order', () => {
    const buffer = new IntentBuffer();
    expect(buffer.record('p1', 'press')).toBe(true);
    expect(buffer.record('p1', 'release')).toBe(true);
    expect(types(buffer.drainTick())).toEqual(['press', 'release']);
  });

  it('rejects a second press while the thumb is down (keyboard auto-repeat case)', () => {
    const buffer = new IntentBuffer();
    buffer.record('p1', 'press');
    expect(buffer.record('p1', 'press')).toBe(false);
    expect(types(buffer.drainTick())).toEqual(['press']);
  });

  it('rejects a release when the thumb is not down (double-fired touchend case)', () => {
    const buffer = new IntentBuffer();
    expect(buffer.record('p1', 'release')).toBe(false);
    expect(buffer.drainTick()).toEqual([]);
  });

  it('preserves a full tap inside a single tick — press first, release second', () => {
    // At 60 ticks/second a fast tap can land entirely within one tick;
    // the player module must still see press before release.
    const buffer = new IntentBuffer();
    buffer.record('p1', 'press');
    buffer.record('p1', 'release');
    buffer.record('p1', 'press');
    expect(types(buffer.drainTick())).toEqual(['press', 'release', 'press']);
  });
});

describe('IntentBuffer — hold state spans ticks (GDD §6.1: hold → higher jump)', () => {
  it('remembers a held thumb across drainTick calls', () => {
    const buffer = new IntentBuffer();
    buffer.record('p1', 'press');
    buffer.drainTick(); // tick boundary — the hold continues
    expect(buffer.record('p1', 'press')).toBe(false); // still down: no re-press
    expect(buffer.record('p1', 'release')).toBe(true); // the hold ends normally
    expect(types(buffer.drainTick())).toEqual(['release']);
  });

  it('reset() forgets held thumbs, so a rematch starts clean (GDD §7 rematch rule)', () => {
    const buffer = new IntentBuffer();
    buffer.record('p1', 'press');
    buffer.reset();
    // Without reset, this first press of the new match would be swallowed.
    expect(buffer.record('p1', 'press')).toBe(true);
  });
});

describe('IntentBuffer — flood cap (boundary validation, CODING_STANDARDS §10)', () => {
  it(`accepts at most ${MAX_INTENTS_PER_PLAYER_PER_TICK} intents per player per tick`, () => {
    const buffer = new IntentBuffer();
    let accepted = 0;
    // Alternate press/release so alternation never rejects — only the cap can.
    for (let i = 0; i < 20; i += 1) {
      if (buffer.record('p1', i % 2 === 0 ? 'press' : 'release')) accepted += 1;
    }
    expect(accepted).toBe(MAX_INTENTS_PER_PLAYER_PER_TICK);
  });

  it('clears the cap at the tick boundary but keeps thumb state consistent', () => {
    const buffer = new IntentBuffer();
    for (let i = 0; i < 20; i += 1) {
      buffer.record('p1', i % 2 === 0 ? 'press' : 'release');
    }
    buffer.drainTick();
    // Cap window reset: the player can act again next tick, continuing
    // from a consistent thumb state (last accepted intent was 'release').
    expect(buffer.record('p1', 'press')).toBe(true);
  });

  it('caps players independently — one flooding player cannot mute a rival (GDD §12.7 fairness)', () => {
    const buffer = new IntentBuffer();
    for (let i = 0; i < 20; i += 1) {
      buffer.record('flooder', i % 2 === 0 ? 'press' : 'release');
    }
    expect(buffer.record('honest', 'press')).toBe(true);
  });
});

describe('IntentBuffer — multiplayer attribution (GDD §9: multiplayer is the primary mode)', () => {
  it('keeps per-player thumb states independent and preserves interleaved order', () => {
    const buffer = new IntentBuffer();
    buffer.record('p1', 'press');
    buffer.record('p2', 'press');
    buffer.record('p1', 'release');
    const batch = buffer.drainTick();
    expect(batch).toEqual([
      { playerId: 'p1', type: 'press' },
      { playerId: 'p2', type: 'press' },
      { playerId: 'p1', type: 'release' },
    ]);
  });
});

describe('IntentBuffer — determinism (the non-negotiable: same calls in, same intents out)', () => {
  it('produces identical tick batches for identical call sequences', () => {
    // The scripted "chaotic session": valid and invalid signals mixed,
    // across several ticks, for two players.
    const script: Array<['p1' | 'p2', 'press' | 'release'] | 'tick'> = [
      ['p1', 'press'], ['p1', 'press'], ['p2', 'release'], ['p2', 'press'], 'tick',
      ['p1', 'release'], ['p2', 'release'], ['p2', 'press'], 'tick',
      ['p1', 'press'], ['p1', 'release'], ['p1', 'press'], ['p1', 'release'], ['p1', 'press'], 'tick',
    ];

    const run = (): TickInputs[] => {
      const buffer = new IntentBuffer();
      const frames: TickInputs[] = [];
      for (const step of script) {
        if (step === 'tick') frames.push(buffer.drainTick());
        else buffer.record(step[0], step[1]);
      }
      return frames;
    };

    expect(run()).toEqual(run());
  });

  it('drainTick returns a snapshot — mutating it cannot corrupt later ticks', () => {
    const buffer = new IntentBuffer();
    buffer.record('p1', 'press');
    const frame = buffer.drainTick() as Array<unknown>;
    frame.length = 0; // a hostile or buggy consumer empties the array
    buffer.record('p1', 'release');
    expect(types(buffer.drainTick())).toEqual(['release']);
  });
});
