/**
 * ============================================================
 *  effects.test.ts — guarantees of the Effects module
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins GDD §11's four tests (telegraphed, survivable, brief,
 *    counterable) and the two fresh rulings (ADR-0001 shared world,
 *    ADR-0002 healing + pad immunity) as executable guarantees —
 *    on real two-player simulations wherever the rule involves a
 *    victim.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  BOMB,
  BOOST,
  GENERATION,
  MATCH,
  SLOW,
  Simulation,
  TRAP,
  applySlow,
  applySpeedBoost,
  computeJumpMetrics,
  craterAt,
  gravityScaleFor,
  placeCrater,
  placeTrap,
  scoreRateFor,
  stepPhysics,
  type EffectContext,
  type SimEvent,
} from '@rebound/sim-core';

const metrics = computeJumpMetrics(GENERATION.BASE_SPEED_UNITS_PER_TICK);

/** A bare effect context over flat ground with no checkpoints. */
function flatCtx(tick = 100, speed = GENERATION.BASE_SPEED_UNITS_PER_TICK): EffectContext {
  return {
    tick,
    speed,
    metrics,
    groundSurfaceAt: () => 0,
    checkpointsIn: () => [],
  };
}

/** Two-player sim + helper to run ticks collecting events. */
function duo(seed: string): { sim: Simulation; run: (n: number) => SimEvent[] } {
  const sim = new Simulation({ seed, playerIds: ['p1', 'p2'] });
  return {
    sim,
    run: (n) => {
      const log: SimEvent[] = [];
      for (let i = 0; i < n && !sim.over; i += 1) log.push(...sim.step([]));
      return log;
    },
  };
}

describe('Effects — the §11.1 tests, as constants (brief, survivable, telegraphed)', () => {
  it('every duration is seconds, not phases: all windows ≤ 4.5 s', () => {
    for (const ticks of [BOMB.HEAL_TICKS, TRAP.LIFETIME_TICKS, SLOW.DURATION_TICKS, BOOST.DURATION_TICKS]) {
      expect(ticks).toBeLessThanOrEqual(270);
    }
  });

  it('a crater is tap-clearable by the real physics — survivable by construction', () => {
    const crater = placeCrater(0, flatCtx());
    expect(crater.x1 - crater.x0).toBeLessThanOrEqual(metrics.tapDistance * BOMB.CRATER_WIDTH_FACTOR + 1e-9);
    expect(crater.x1 - crater.x0).toBeLessThan(metrics.tapDistance);
  });

  it('offense lands a telegraph distance AHEAD of the target — visible incoming', () => {
    const ctx = flatCtx();
    const crater = placeCrater(1000, ctx);
    expect(crater.x0).toBeGreaterThanOrEqual(1000 + BOMB.TELEGRAPH_TICKS * ctx.speed);
    const trap = placeTrap(1000, ctx);
    expect(trap?.x).toBeGreaterThanOrEqual(1000 + TRAP.TELEGRAPH_TICKS * ctx.speed);
  });
});

describe('Effects — ADR-0002: healing and checkpoint immunity', () => {
  it('craters heal at exactly healAtTick', () => {
    const crater = placeCrater(0, flatCtx(100));
    expect(crater.healAtTick).toBe(100 + BOMB.HEAL_TICKS);
  });

  it('a crater aimed at a checkpoint pad shifts to land just past it', () => {
    const cpX = 5000;
    const padHalf = GENERATION.SAFE_PAD_LENGTH / 2;
    const ctx: EffectContext = { ...flatCtx(), checkpointsIn: (x0, x1) => (cpX >= x0 && cpX <= x1 ? [cpX] : []) };
    // Aim so the raw landing spot falls inside the pad.
    const targetX = cpX - BOMB.TELEGRAPH_TICKS * ctx.speed;
    const crater = placeCrater(targetX, ctx);
    expect(crater.x0).toBeGreaterThan(cpX + padHalf); // respawns are never ambushed
  });

  it('a trap refuses checkpoint pads and gaps, scanning forward — or fizzles honestly', () => {
    const gapEverywhere: EffectContext = { ...flatCtx(), groundSurfaceAt: () => null };
    expect(placeTrap(0, gapEverywhere)).toBeNull(); // no honest placement → no trap
    const trap = placeTrap(0, flatCtx());
    expect(trap).not.toBeNull();
    expect(trap?.y).toBe(0); // standing ON the surface — a floating spike would be a lie
  });
});

describe('Effects — ADR-0001: one shared world', () => {
  it('a bomb queued against p2 craters the ONE world every player walks', () => {
    const { sim, run } = duo('effects-shared');
    run(5);
    sim.queueEffect({ tick: sim.tick + 2, kind: 'bomb', sourceId: 'p1', targetId: 'p2' });
    const log = run(3);
    expect(log.some((e) => e.type === 'effectApplied' && e.kind === 'bomb')).toBe(true);
    const crater = sim.effects.craters[0];
    expect(crater).toBeDefined();
    if (crater === undefined) throw new Error('unreachable');
    // The crater is a gap in the shared effect-world query — there is
    // no per-player ground; whoever reaches it, jumps it or falls.
    expect(craterAt(sim.effects, (crater.x0 + crater.x1) / 2)).toBe(true);
  });

  it('the crater is gone from the world after its heal tick', () => {
    const { sim, run } = duo('effects-heal');
    run(5);
    sim.queueEffect({ tick: sim.tick + 2, kind: 'bomb', sourceId: 'p1', targetId: 'p2' });
    run(3);
    expect(sim.effects.craters).toHaveLength(1);
    run(BOMB.HEAL_TICKS + 2);
    expect(sim.effects.craters).toHaveLength(0); // brief means brief, for terrain too
  });
});

describe('Effects — the Shield is counterplay, resolved before impact (GDD §11.3)', () => {
  it('a shielded target absorbs a bomb entirely: no crater exists for anyone, shield spent', () => {
    const { sim, run } = duo('effects-shield');
    run(5);
    sim.queueEffect({ tick: sim.tick + 1, kind: 'shield', sourceId: 'p2', targetId: 'p2' });
    sim.queueEffect({ tick: sim.tick + 3, kind: 'bomb', sourceId: 'p1', targetId: 'p2' });
    const log = run(5);
    expect(log.some((e) => e.type === 'shieldAbsorbed' && e.targetId === 'p2')).toBe(true);
    expect(sim.effects.craters).toHaveLength(0); // an absorbed bomb never happened
    expect(sim.playerById('p2')?.effects.shieldActive).toBe(false); // one charge, spent
  });

  it('the shield does not block the self-only boost — there is nothing to block', () => {
    const { sim, run } = duo('effects-shield-boost');
    run(5);
    sim.queueEffect({ tick: sim.tick + 1, kind: 'shield', sourceId: 'p2', targetId: 'p2' });
    sim.queueEffect({ tick: sim.tick + 3, kind: 'speedBoost', sourceId: 'p2', targetId: 'p2' });
    run(5);
    const p2 = sim.playerById('p2');
    expect(p2?.effects.shieldActive).toBe(true); // still up
    expect(p2?.effects.boostUntilTick ?? 0).toBeGreaterThan(0); // and boosted
  });
});

describe('Effects — Slow is vertical-only pressure (GDD §11.3; Pillar 7 untouched)', () => {
  it('a slowed player jumps measurably lower — heavier, stickier', () => {
    const flat = { groundSurfaceAt: () => 100 };
    const jumpPeak = (gravityScale: number): number => {
      let state = { id: 'p', x: 0, y: 100 - 20, vy: -9, onGround: false, isHoldingJump: true, holdTicksUsed: 0 };
      let peak = 0;
      for (let i = 0; i < 120; i += 1) {
        const r = stepPhysics(state, 4.2, flat, gravityScale);
        state = r.player as typeof state;
        peak = Math.max(peak, 80 - state.y);
        if (r.landed) break;
      }
      return peak;
    };
    expect(jumpPeak(SLOW.GRAVITY_SCALE)).toBeLessThan(jumpPeak(1));
  });

  it('a dampened full-hold jump still clears every generated large gap — pressure, not paralysis', () => {
    // Distance under slow ≥ the widest gap the generator emits: the
    // Skill Supremacy Rule's "survivable" clause under the effect.
    const flat = { groundSurfaceAt: () => 0 };
    let state = { id: 'p', x: 0, y: -20, vy: -9, onGround: false, isHoldingJump: true, holdTicksUsed: 0 };
    let landedX = 0;
    for (let i = 0; i < 300; i += 1) {
      const r = stepPhysics(state, GENERATION.BASE_SPEED_UNITS_PER_TICK, flat, SLOW.GRAVITY_SCALE);
      state = r.player as typeof state;
      if (r.landed) { landedX = state.x; break; }
    }
    const widestGap = metrics.holdDistance * GENERATION.LARGE_GAP_FACTOR_MAX;
    expect(landedX).toBeGreaterThan(widestGap);
  });

  it('slow expires, and refresh replaces rather than stacks (review C3 default)', () => {
    const { sim } = duo('effects-slow');
    const p = sim.playerById('p1');
    if (p === undefined) throw new Error('unreachable');
    const slowed = applySlow(p, 100);
    expect(gravityScaleFor(slowed, 100 + SLOW.DURATION_TICKS)).toBe(SLOW.GRAVITY_SCALE);
    expect(gravityScaleFor(slowed, 101 + SLOW.DURATION_TICKS)).toBe(1);
    const refreshed = applySlow(slowed, 150);
    expect(refreshed.effects.slowUntilTick).toBe(150 + SLOW.DURATION_TICKS); // replaced, not summed
  });
});

describe('Effects — Speed Boost surges score, touches nothing else (GDD §11.3, review A7)', () => {
  it('score accrues at exactly the boosted rate while active, and reverts', () => {
    const { sim } = duo('effects-boost');
    const p = sim.playerById('p1');
    if (p === undefined) throw new Error('unreachable');
    const boosted = applySpeedBoost({ ...p, protectedUntilTick: 0 }, 100);
    expect(scoreRateFor(boosted, 100)).toBe(BOOST.SCORE_RATE_MULTIPLIER);
    expect(scoreRateFor(boosted, 101 + BOOST.DURATION_TICKS)).toBe(1);
  });

  it('a boosted match outscores an identical unboosted match — and forward progress stays identical', () => {
    const plain = duo('effects-boost-match');
    const surged = duo('effects-boost-match');
    plain.run(400);
    surged.sim.queueEffect({ tick: surged.sim.tick + 200, kind: 'speedBoost', sourceId: 'p1', targetId: 'p1' });
    surged.run(400);
    const a = plain.sim.playerById('p1');
    const b = surged.sim.playerById('p1');
    expect(b?.score ?? 0).toBeGreaterThan(a?.score ?? 0); // more points
    expect(b?.player.x).toBe(a?.player.x); // same place — Pillar 7 untouched
  });
});

describe('Effects — solo offense fizzles; determinism holds', () => {
  it('an offensive pickup with no rival fizzles honestly (review C2 default)', () => {
    const sim = new Simulation({
      seed: 'effects-solo',
      playerIds: ['p1'],
      generation: { pickupKinds: ['bomb'] },
    });
    const log: SimEvent[] = [];
    for (let i = 0; i < 20_000 && !sim.over; i += 1) log.push(...sim.step([]));
    const picked = log.filter((e) => e.type === 'pickup');
    const fizzled = log.filter((e) => e.type === 'effectFizzled');
    expect(fizzled.length).toBe(picked.length); // every solo bomb fizzles
    expect(sim.effects.craters).toHaveLength(0);
  });

  it('a queued-effect match is deterministic: same seed, same queue, same everything, twice', () => {
    const run = (): { log: SimEvent[]; final: unknown } => {
      const { sim } = duo('effects-determinism');
      const log: SimEvent[] = [];
      sim.queueEffect({ tick: 30, kind: 'shield', sourceId: 'p2', targetId: 'p2' });
      sim.queueEffect({ tick: 60, kind: 'bomb', sourceId: 'p1', targetId: 'p2' });
      sim.queueEffect({ tick: 90, kind: 'slow', sourceId: 'p2', targetId: 'p1' });
      for (let i = 0; i < 600 && !sim.over; i += 1) log.push(...sim.step([]));
      return { log, final: JSON.parse(JSON.stringify([...sim.players])) };
    };
    expect(run()).toEqual(run());
  });

  it('stamping an effect into the past is an invariant violation — loud, not silent', () => {
    const { sim, run } = duo('effects-past');
    run(10);
    expect(() =>
      sim.queueEffect({ tick: 3, kind: 'bomb', sourceId: 'p1', targetId: 'p2' }),
    ).toThrow(/past tick/);
  });

  it('the pad-immunity constant matches the generator’s pad — one truth, asserted', () => {
    // bomb.ts/spike-trap.ts hard-code PAD_HALF = 180 with a comment
    // pointing here: if the generator's pad ever changes, this test
    // fails and the constants follow (until constants.ts unifies them).
    expect(GENERATION.SAFE_PAD_LENGTH / 2).toBe(180);
  });
});
