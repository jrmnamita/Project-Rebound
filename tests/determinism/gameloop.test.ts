/**
 * ============================================================
 *  gameloop.test.ts — guarantees of the Game Loop (sim side)
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the speed curve's documented shape, every GDD §8 match
 *    rule (lives, respawn-at-checkpoint, spawn protection, monotonic
 *    score, elimination, solo termination), and the whole-match
 *    determinism contract: two simulations, same seed, same inputs
 *    → identical states and identical event logs, tick for tick.
 *
 *  WHY IT EXISTS (design anchor)
 *    This is the suite the architecture calls "determinism CI" for
 *    the assembled game: everything below runs full matches through
 *    the real Simulation on generated worlds — no mocks, no stubs.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  CURVE_DRAFT_1,
  GENERATION,
  MATCH,
  Simulation,
  accrueScore,
  phaseNameAt,
  speedAt,
  type SimEvent,
} from '@rebound/sim-core';

const P = 'local';

/** Run a sim with no input at all until it ends (a no-input player
 *  eventually falls into the first tier-1 gap, three times). */
function runToEnd(sim: Simulation, maxTicks = 60_000): SimEvent[] {
  const log: SimEvent[] = [];
  for (let i = 0; i < maxTicks && !sim.over; i += 1) log.push(...sim.step([]));
  return log;
}

describe('Speed curve — the signature mechanic (GDD §8.5, §14 Q2 draft)', () => {
  it('starts at the base speed the generator sizes worlds for — one number, two consumers', () => {
    expect(speedAt(CURVE_DRAFT_1, 0)).toBe(GENERATION.BASE_SPEED_UNITS_PER_TICK);
  });

  it('never decreases: the world never relents (Pillar 8)', () => {
    let previous = 0;
    for (let tick = 0; tick <= 30_000; tick += 60) {
      const speed = speedAt(CURVE_DRAFT_1, tick);
      expect(speed).toBeGreaterThanOrEqual(previous);
      previous = speed;
    }
  });

  it('visits the four documented phases, in order, by name (GDD §8.5)', () => {
    const names = [0, 46 * 60, 106 * 60, 176 * 60].map((t) => phaseNameAt(CURVE_DRAFT_1, t));
    expect(names).toEqual(['Normal', 'Faster', 'Very Fast', 'Extreme Survival']);
  });

  it('Extreme Survival rises without bound — no run survives forever', () => {
    const atTenMinutes = speedAt(CURVE_DRAFT_1, 600 * 60);
    const atTwentyMinutes = speedAt(CURVE_DRAFT_1, 1200 * 60);
    expect(atTwentyMinutes).toBeGreaterThan(atTenMinutes);
  });
});

describe('Match rules — GDD §8, executed on a real generated world', () => {
  it('a no-input player spends exactly 3 lives, then is eliminated, then the match is over', () => {
    const sim = new Simulation({ seed: 'rules-1', playerIds: [P] });
    const log = runToEnd(sim);
    expect(log.filter((e) => e.type === 'death')).toHaveLength(MATCH.LIVES);
    expect(log.filter((e) => e.type === 'eliminated')).toHaveLength(1);
    expect(log.filter((e) => e.type === 'matchOver')).toHaveLength(1);
    expect(sim.over).toBe(true);
    expect(sim.playerById(P)?.lives).toBe(0);
  });

  it('score only ever rises — across deaths, respawns, everything (Pillar 9)', () => {
    const sim = new Simulation({ seed: 'rules-2', playerIds: [P] });
    let previousScore = 0;
    while (!sim.over) {
      sim.step([]);
      const score = sim.playerById(P)?.score ?? 0;
      expect(score).toBeGreaterThanOrEqual(previousScore);
      previousScore = score;
    }
    expect(previousScore).toBeGreaterThan(0);
  });

  it('respawn happens at the latest checkpoint, after the brief pause, with protection (§8.3/8.4)', () => {
    const sim = new Simulation({ seed: 'rules-3', playerIds: [P] });
    // Run to the first death.
    while (!sim.over && (sim.playerById(P)?.alive ?? false)) sim.step([]);
    const dead = sim.playerById(P);
    expect(dead?.respawnAtTick).toBe(sim.tick + MATCH.RESPAWN_DELAY_TICKS);
    // Run to the respawn tick.
    while (!(sim.playerById(P)?.alive ?? true)) sim.step([]);
    const respawned = sim.playerById(P);
    expect(respawned).toBeDefined();
    if (respawned === undefined) throw new Error('unreachable');
    // Placed at the checkpoint — then moved by ONE tick of physics,
    // because respawn and motion share the respawn tick: auto-forward
    // never pauses (Pillar 3), and the clock never waits (§8.4).
    const strideFromCheckpoint = respawned.player.x - respawned.checkpointX;
    expect(strideFromCheckpoint).toBeGreaterThanOrEqual(0);
    expect(strideFromCheckpoint).toBeLessThanOrEqual(sim.currentSpeed + 1e-9);
    expect(respawned.player.onGround).toBe(true); // grounded, safe by construction
    expect(respawned.protectedUntilTick).toBeGreaterThan(sim.tick); // protected
  });

  it('spawn protection freezes score (§8.3: "cannot gain score") and then expires', () => {
    // The freeze, observed in a real match:
    const sim = new Simulation({ seed: 'rules-3', playerIds: [P] });
    while (!sim.over && (sim.playerById(P)?.alive ?? false)) sim.step([]);
    while (!(sim.playerById(P)?.alive ?? true)) sim.step([]);
    const scoreAtRespawn = sim.playerById(P)?.score ?? -1;
    for (let i = 0; i < 30; i += 1) sim.step([]);
    expect(sim.playerById(P)?.score).toBe(scoreAtRespawn); // protected: frozen

    // The expiry, proven on the pure rule (a no-input player on this
    // seed falls again BEFORE protection ends, so natural expiry
    // never shows in that match — the rule itself is a one-liner):
    const mp = sim.playerById(P);
    expect(mp).toBeDefined();
    if (mp === undefined) throw new Error('unreachable');
    const lastProtectedTick = mp.protectedUntilTick;
    expect(accrueScore(mp, lastProtectedTick, 5).score).toBe(mp.score); // still frozen
    const revived = { ...mp, alive: true };
    expect(accrueScore(revived, lastProtectedTick + 1, 5).score).toBeGreaterThan(mp.score); // resumes
  });

  it('checkpoints are claimed automatically as the player passes them (§8.4)', () => {
    const sim = new Simulation({ seed: 'rules-4', playerIds: [P] });
    const startCheckpoint = sim.playerById(P)?.checkpointX ?? -1;
    const log: SimEvent[] = [];
    for (let i = 0; i < 3000 && !sim.over; i += 1) log.push(...sim.step([]));
    const claims = log.filter((e) => e.type === 'checkpoint');
    expect(claims.length).toBeGreaterThan(0);
    expect(sim.playerById(P)?.checkpointX ?? -1).toBeGreaterThan(startCheckpoint);
  });

  it('deaths carry a legible cause from the closed set (§5.2, Pillar 6)', () => {
    const sim = new Simulation({ seed: 'rules-5', playerIds: [P] });
    const log = runToEnd(sim);
    for (const event of log) {
      if (event.type === 'death') {
        expect(['fall', 'spike', 'hazard']).toContain(event.cause);
      }
    }
  });
});

describe('Input reaches the match — the whole vertical slice', () => {
  it('a press while grounded emits jumped and actually lifts the player', () => {
    const sim = new Simulation({ seed: 'input-1', playerIds: [P] });
    sim.step([]); // settle one tick
    const events = sim.step([{ playerId: P, type: 'press' }]);
    expect(events.some((e) => e.type === 'jumped')).toBe(true);
    expect(sim.playerById(P)?.player.onGround).toBe(false);
  });

  it('jumping over the early world changes the trajectory but never the speed (Pillar 3)', () => {
    const still = new Simulation({ seed: 'input-2', playerIds: [P] });
    const jumper = new Simulation({ seed: 'input-2', playerIds: [P] });
    // Compare MID-JUMP (a dozen ticks after the press): waiting for a
    // landing would find both back on the same flat ground.
    for (let i = 0; i < 18; i += 1) {
      still.step([]);
      jumper.step(i === 5 ? [{ playerId: P, type: 'press' }] : []);
    }
    const a = still.playerById(P)?.player;
    const b = jumper.playerById(P)?.player;
    expect(a?.x).toBe(b?.x); // identical forward progress — auto-forward is absolute
    expect(b?.y).toBeLessThan(a?.y ?? -Infinity); // the jumper is airborne, higher (y grows down)
  });
});

describe('Whole-match determinism — the contract everything rests on', () => {
  it('same seed + same input script → identical event logs and final state, twice over', () => {
    const script = (tick: number): { playerId: string; type: 'press' | 'release' }[] => {
      if (tick % 90 === 30) return [{ playerId: P, type: 'press' }];
      if (tick % 90 === 50) return [{ playerId: P, type: 'release' }];
      return [];
    };
    const run = (): { log: SimEvent[]; final: unknown; ticks: number } => {
      const sim = new Simulation({ seed: 'determinism-1', playerIds: [P] });
      const log: SimEvent[] = [];
      let ticks = 0;
      while (!sim.over && ticks < 60_000) {
        ticks += 1;
        log.push(...sim.step(script(ticks)));
      }
      return { log, final: JSON.parse(JSON.stringify(sim.playerById(P))), ticks };
    };
    const first = run();
    const second = run();
    expect(second.ticks).toBe(first.ticks);
    expect(second.log).toEqual(first.log);
    expect(second.final).toEqual(first.final);
  });
});
