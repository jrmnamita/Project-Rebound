/**
 * ============================================================
 *  utilities.test.ts — guarantees of the Utilities module (sim side)
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the statehash's honesty (identical matches agree,
 *    divergent matches differ), the replay contract (a recorded
 *    match replays to the same hash, tick count, and final state),
 *    the SIM_VERSION refusal, and the cross-module constant truths
 *    constants.ts now owns.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  GENERATION,
  SAFE_PAD_HALF,
  SIM_VERSION,
  Simulation,
  TICK_RATE,
  TraceRecorder,
  hashMatchState,
  replayTrace,
  type InputTrace,
} from '@rebound/sim-core';

const P = 'local';

/** Run a live match with a scripted thumb, recording as we go. */
function playAndRecord(seed: string): { trace: InputTrace; hash: number; ticks: number } {
  const sim = new Simulation({ seed, playerIds: [P] });
  const recorder = new TraceRecorder(seed, sim.curveId, [P]);
  let ticks = 0;
  while (!sim.over && ticks < 60_000) {
    ticks += 1;
    const intents =
      ticks % 75 === 25
        ? [{ playerId: P, type: 'press' as const }]
        : ticks % 75 === 40
          ? [{ playerId: P, type: 'release' as const }]
          : [];
    recorder.record(ticks, intents);
    sim.step(intents);
  }
  return { trace: recorder.toTrace(), hash: sim.statehash(), ticks };
}

describe('Statehash — one number that is the match', () => {
  it('identical matches produce identical hashes at every sampled tick', () => {
    const a = new Simulation({ seed: 'hash-1', playerIds: [P] });
    const b = new Simulation({ seed: 'hash-1', playerIds: [P] });
    for (let i = 0; i < 600; i += 1) {
      a.step([]);
      b.step([]);
      if (i % 100 === 0) expect(a.statehash()).toBe(b.statehash());
    }
  });

  it('a single divergent input changes the hash — desyncs cannot hide', () => {
    const a = new Simulation({ seed: 'hash-2', playerIds: [P] });
    const b = new Simulation({ seed: 'hash-2', playerIds: [P] });
    for (let i = 0; i < 60; i += 1) {
      a.step([]);
      b.step(i === 30 ? [{ playerId: P, type: 'press' }] : []);
    }
    expect(a.statehash()).not.toBe(b.statehash());
  });

  it('the hash covers score and lives, not just position', () => {
    const sim = new Simulation({ seed: 'hash-3', playerIds: [P] });
    sim.step([]);
    const players = sim.players;
    const original = hashMatchState(sim.tick, players, sim.effects);
    const first = players[0];
    expect(first).toBeDefined();
    if (first === undefined) throw new Error('unreachable');
    const richer = [{ ...first, score: first.score + 1000 }];
    expect(hashMatchState(sim.tick, richer, sim.effects)).not.toBe(original);
  });
});

describe('Replay — a match in kilobytes, reproduced exactly', () => {
  it('a recorded match replays to the same hash, tick count, and final score', () => {
    const live = playAndRecord('replay-1');
    const replayed = replayTrace(live.trace);
    expect(replayed.ticks).toBe(live.ticks);
    expect(replayed.statehash).toBe(live.hash); // the validator’s whole argument
  });

  it('traces survive JSON — store it, upload it, replay it', () => {
    const live = playAndRecord('replay-2');
    const rehydrated = JSON.parse(JSON.stringify(live.trace)) as InputTrace;
    expect(replayTrace(rehydrated).statehash).toBe(live.hash);
  });

  it('a trace from another rules version refuses loudly — a changed universe cannot replay', () => {
    const live = playAndRecord('replay-3');
    const alien: InputTrace = { ...live.trace, simVersion: SIM_VERSION + 1 };
    expect(() => replayTrace(alien)).toThrow(/changed universe/);
  });

  it('empty ticks are omitted: the trace is far smaller than the match', () => {
    const live = playAndRecord('replay-4');
    expect(live.trace.frames.length).toBeLessThan(live.ticks / 10);
  });
});

describe('Constants — the shared truths, now owned in one leaf', () => {
  it('SAFE_PAD_HALF matches the generator’s pad — the derivation constants.ts documents', () => {
    expect(SAFE_PAD_HALF).toBe(GENERATION.SAFE_PAD_LENGTH / 2);
  });

  it('the tick rate is the fixed 60 the architecture mandates', () => {
    expect(TICK_RATE).toBe(60);
  });
});
