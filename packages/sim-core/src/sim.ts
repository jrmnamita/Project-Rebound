/**
 * ============================================================
 *  sim.ts — the Simulation: one tick, every rule, in order
 * ============================================================
 *  WHAT THIS FILE DOES
 *    The façade that owns a running match: the terrain stream, the
 *    match clock, and every player's MatchPlayer state. Its step()
 *    advances the whole world by exactly one tick — applying the
 *    modules built before it, in one fixed, documented order — and
 *    returns the events that tick produced.
 *
 *  WHY IT EXISTS (design anchor)
 *    ARCHITECTURE §3: a deterministic sim-core with a fixed 60-tick
 *    step, driven from outside (the GameHost calls step; the server
 *    and validator will call the same step in Phase 2 — one
 *    simulation, many drivers). GDD §8's match grammar needs a
 *    sequencer; this is it, and ONLY it — the rules themselves live
 *    in match.ts/player.ts/physics.ts/curve.ts.
 *
 *  THE TICK ORDER (part of the determinism contract — reordering
 *  changes every replay, ARCHITECTURE §3):
 *    1. clock advances; phase change detected (curve.ts)
 *    2. due respawns happen (match.ts)
 *    3. this tick's input intents apply (player.ts)
 *    4. physics moves every living body (physics.ts)
 *    5. checkpoints claimed (terrain queries)
 *    6. deaths judged: spike, hazard, fall (match.ts rules)
 *    7. pickups collected (events only — the Effects module will
 *       attach consequences; flagged below)
 *    8. score accrues (match.ts)
 *    9. the terrain window slides (generator/queries)
 *
 *  WHAT IT MUST NEVER DO
 *    Contain a rule. If a branch here encodes gameplay policy
 *    rather than sequence, it belongs in a rules module. And, being
 *    sim-core: no clocks, no randomness, no rendering, ever.
 * ============================================================
 */

import { CURVE_DRAFT_1, phaseIndexAt, phaseNameAt, speedAt, type SpeedCurve } from './curve.js';
import type { SimEvent } from './events.js';
import type { TickInputs } from './input.js';
import { applyIntent } from './player.js';
import { PHYSICS, stepPhysics } from './physics.js';
import {
  MATCH,
  accrueScore,
  applyDeath,
  applyRespawn,
  createMatchPlayer,
  isProtected,
  touchesSpike,
  type MatchPlayer,
} from './match.js';
import { Terrain } from './terrain/queries.js';
import {
  GENERATION,
  computeJumpMetrics,
  extendTerrain,
  type GenerationParams,
  type JumpMetrics,
} from './terrain/generator.js';
import { chunkStartX } from './terrain/chunk.js';
import {
  EMPTY_EFFECT_WORLD,
  activeTrapSpikes,
  craterAt,
  expireEffects,
  resolveEffect,
  selectTarget,
  type EffectEvent,
  type EffectWorld,
} from './effects/resolve.js';
import { gravityScaleFor } from './effects/slow.js';
import { hashMatchState } from './statehash.js';
import type { GroundQuery } from './physics.js';

/** How far ahead of the leader the world stays generated: ~3 s of
 *  travel at generous speed, plus camera lookahead slack. */
const GENERATE_AHEAD_UNITS = 4200;
/** How far behind the earliest live checkpoint chunks are kept —
 *  respawn ground plus camera trailing edge (queries.ts contract). */
const KEEP_BEHIND_UNITS = 400;
/** Pickup collection reach (world units) around the crate. */
const PICKUP_REACH = 56;

export interface SimulationOptions {
  readonly seed: string;
  readonly playerIds: readonly string[];
  readonly curve?: SpeedCurve;
  readonly generation?: Omit<GenerationParams, 'seed'>;
}

/**
 * Purpose: A running match. One instance = one match = one seed.
 *
 * Why a class: the stateful-lifecycle case (CODING_STANDARDS §6) —
 * it owns the terrain window, the clock, and player states for the
 * match's whole life. All mutation is internal and tick-driven;
 * readers get snapshots via the getters.
 *
 * Side effects: none observable outside its own state — step() is
 * deterministic: same construction + same input sequence = same
 * states and same events, on any machine (gameloop.test.ts proves
 * it end to end).
 */
export class Simulation {
  private readonly curve: SpeedCurve;
  private readonly terrain = new Terrain();
  private readonly generation: GenerationParams;
  private playersById = new Map<string, MatchPlayer>();
  private readonly collectedPickups = new Set<string>();
  private tickCount = 0;
  private lastPhaseIndex = 0;
  private matchOver = false;
  /** The shared effect world — craters and traps everyone faces
   *  (ADR-0001), expiring on their own clocks (ADR-0002). */
  private effectWorld: EffectWorld = EMPTY_EFFECT_WORLD;
  /** Tick-stamped effect events awaiting their tick (ARCHITECTURE
   *  §2.3: solo stamps its own; Phase 2's room stamps and queues
   *  through the same door — queueEffect below). */
  private pendingEffects: EffectEvent[] = [];
  /** Jump metrics at base speed — effect sizing shares the same
   *  measured truth the generator uses. */
  private readonly metrics: JumpMetrics;
  /** The one world, seen through active craters: a crater IS a gap
   *  while it lasts. This wrapper is the seam the Level module
   *  promised ("overlays wrap queries, chunks never change"). */
  private readonly effectGround: GroundQuery = {
    groundSurfaceAt: (x) =>
      craterAt(this.effectWorld, x) ? null : this.terrain.groundSurfaceAt(x),
  };

  constructor(options: SimulationOptions) {
    this.curve = options.curve ?? CURVE_DRAFT_1;
    this.generation = { seed: options.seed, ...options.generation };
    this.metrics = computeJumpMetrics(
      this.generation.baseSpeedUnitsPerTick ?? GENERATION.BASE_SPEED_UNITS_PER_TICK,
    );
    extendTerrain(this.terrain, this.generation, GENERATE_AHEAD_UNITS);

    // Everyone spawns on chunk 0's safe pad (flat by construction,
    // GDD §8.4) — identical start, identical world (Pillar 7).
    const spawnX = chunkStartX(0) + GENERATION.SAFE_PAD_LENGTH / 2;
    const groundY = this.terrain.groundSurfaceAt(spawnX);
    if (groundY === null) {
      throw new Error('Simulation: no ground at spawn — generator invariant broken');
    }
    for (const id of options.playerIds) {
      this.playersById.set(id, createMatchPlayer(id, spawnX, groundY));
    }
  }

  /** The match clock (ticks since start). */
  get tick(): number {
    return this.tickCount;
  }
  get over(): boolean {
    return this.matchOver;
  }
  get phaseIndex(): number {
    return phaseIndexAt(this.curve, this.tickCount);
  }
  get phaseName(): ReturnType<typeof phaseNameAt> {
    return phaseNameAt(this.curve, this.tickCount);
  }
  get currentSpeed(): number {
    return speedAt(this.curve, this.tickCount);
  }
  /** Snapshot of every player's match state (stable order). */
  get players(): readonly MatchPlayer[] {
    return [...this.playersById.values()];
  }
  playerById(id: string): MatchPlayer | undefined {
    return this.playersById.get(id);
  }
  /** The terrain, for the renderer (read-only by convention: the
   *  renderer draws chunks; it cannot alter them — chunk data is
   *  readonly all the way down). */
  get world(): Terrain {
    return this.terrain;
  }
  /** The shared effect world, for the renderer (craters and traps
   *  must be DRAWN — telegraphed means visible, GDD §11.1). */
  get effects(): EffectWorld {
    return this.effectWorld;
  }
  /** The active curve's identity — stamped into traces (replay.ts). */
  get curveId(): string {
    return this.curve.id;
  }

  /**
   * Purpose: This match's gameplay fingerprint right now — the
   * number beacons carry and validators confirm (statehash.ts).
   * Outputs: unsigned 32-bit hash. Side effects: none.
   */
  statehash(): number {
    return hashMatchState(this.tickCount, this.players, this.effectWorld);
  }

  /**
   * Purpose: Queue a tick-stamped effect event for application at
   * exactly its tick — the Phase 2 room's door into this sim, and
   * the test suite's door today.
   * Inputs: event — must be stamped at or after the current tick
   * (a past stamp is an invariant violation: applying history late
   * would fork the timeline — fail fast, CODING_STANDARDS §10).
   * Side effects: enqueues; application happens inside step().
   */
  queueEffect(event: EffectEvent): void {
    if (event.tick <= this.tickCount) {
      throw new Error(`Simulation: effect stamped for past tick ${event.tick} (now ${this.tickCount})`);
    }
    this.pendingEffects.push(event);
  }

  /**
   * Purpose: Apply one due effect event through resolve.ts and
   * translate the outcome into simulation events.
   * Why here: resolveEffect is pure; the Simulation is the only
   * thing allowed to COMMIT its outcome — same split as every rule
   * module (rules decide, the sequencer applies).
   */
  private applyEffectEvent(event: EffectEvent): SimEvent[] {
    const outcome = resolveEffect(event, this.playersById, this.effectWorld, {
      tick: this.tickCount,
      speed: speedAt(this.curve, this.tickCount),
      metrics: this.metrics,
      groundSurfaceAt: (x) => this.effectGround.groundSurfaceAt(x),
      checkpointsIn: (x0, x1) => this.terrain.checkpointsIn(x0, x1),
    });
    this.playersById = new Map(outcome.players);
    this.effectWorld = outcome.world;
    switch (outcome.result) {
      case 'applied':
        return [{ type: 'effectApplied', kind: event.kind, sourceId: event.sourceId, targetId: event.targetId }];
      case 'absorbed':
        return [{ type: 'shieldAbsorbed', targetId: event.targetId, kind: event.kind }];
      case 'fizzled':
        return [{ type: 'effectFizzled', kind: event.kind, sourceId: event.sourceId }];
    }
  }

  /**
   * Purpose: Advance the whole match by exactly one tick.
   *
   * Inputs: inputs — this tick's validated intents (IntentBuffer's
   * drainTick output; possibly empty).
   * Outputs: the events this tick produced, in occurrence order.
   * Side effects: advances all internal state one tick.
   * Related systems: driven by the GameHost now, by the room/
   * validator in Phase 2 — same method, same determinism.
   */
  step(inputs: TickInputs): SimEvent[] {
    if (this.matchOver) return [];
    const events: SimEvent[] = [];
    this.tickCount += 1;
    const tick = this.tickCount;
    const speed = speedAt(this.curve, tick);

    // 1. Phase act-breaks (GDD §8.5: announced and felt).
    const phase = phaseIndexAt(this.curve, tick);
    if (phase !== this.lastPhaseIndex) {
      this.lastPhaseIndex = phase;
      events.push({ type: 'phaseChanged', phaseIndex: phase, phaseName: phaseNameAt(this.curve, tick) });
    }

    // 1b. Effects due THIS tick apply now, in queue order (server
    //     stamp order is resolution order — review C3's rule), and
    //     healed craters / rusted traps leave the world (ADR-0002).
    this.effectWorld = expireEffects(this.effectWorld, tick);
    const due = this.pendingEffects.filter((e) => e.tick === tick);
    if (due.length > 0) {
      this.pendingEffects = this.pendingEffects.filter((e) => e.tick !== tick);
      for (const effectEvent of due) events.push(...this.applyEffectEvent(effectEvent));
    }

    for (const [id, before] of this.playersById) {
      let mp = before;

      // 2. Due respawn (GDD §8.3) — at the checkpoint, protected,
      //    at the match's CURRENT speed phase (§8.4).
      if (!mp.alive && mp.respawnAtTick !== null && tick >= mp.respawnAtTick) {
        const groundY = this.terrain.groundSurfaceAt(mp.checkpointX);
        if (groundY === null) throw new Error('Simulation: checkpoint ground missing');
        mp = applyRespawn(mp, tick, groundY);
        events.push({ type: 'respawn', playerId: id });
      }

      if (mp.alive) {
        // 3. Intents (in batch order — a fast tap's press precedes
        //    its release within the same tick; input.ts).
        for (const intent of inputs) {
          if (intent.playerId !== id) continue;
          const wasGrounded = mp.player.onGround;
          const nextBody = applyIntent(mp.player, intent.type);
          if (wasGrounded && !nextBody.onGround) {
            events.push({ type: 'jumped', playerId: id });
          }
          mp = { ...mp, player: nextBody };
        }

        // 4. Physics — everyone moves at the same dictated speed
        //    (Pillar 7 is this argument being identical for all),
        //    through the effect-aware ground (a crater is a gap
        //    while it lasts), under this player's gravity scale
        //    (the Slow effect's only lever — vertical, never speed).
        const prevX = mp.player.x;
        const result = stepPhysics(mp.player, speed, this.effectGround, gravityScaleFor(mp, tick));
        mp = { ...mp, player: result.player };
        if (result.landed) events.push({ type: 'landed', playerId: id });

        // 5. Checkpoints claimed automatically (§8.4) — half-open
        //    interval so a boundary checkpoint counts exactly once.
        const crossed = this.terrain.checkpointsIn(prevX, mp.player.x);
        const latest = crossed[crossed.length - 1];
        if (latest !== undefined) {
          mp = { ...mp, checkpointX: latest };
          events.push({ type: 'checkpoint', playerId: id, checkpointX: latest });
        }

        // 6. Death judgment — the only three causes (Pillar 6).
        //    Spikes/hazards respect protection (§8.3); falls do not
        //    (flagged working default, match.ts header).
        const protectedNow = isProtected(mp, tick);
        let cause: 'fall' | 'spike' | 'hazard' | null = null;
        if (mp.player.y > MATCH.KILL_PLANE_Y) {
          cause = 'fall';
        } else if (!protectedNow) {
          // Trap spikes kill exactly like generated spikes — same
          // contact rule, same legible cause ("jump it like any
          // spike", GDD §11.3).
          const nearSpikes = [
            ...this.terrain.spikesIn(mp.player.x - 80, mp.player.x + 80),
            ...activeTrapSpikes(this.effectWorld),
          ];
          if (touchesSpike(mp.player, nearSpikes)) cause = 'spike';
          else if (mp.player.onGround && this.terrain.hazardZoneAt(mp.player.x)) cause = 'hazard';
        }
        if (cause !== null) {
          mp = applyDeath(mp, tick);
          events.push({ type: 'death', playerId: id, cause });
          if (mp.eliminated) events.push({ type: 'eliminated', playerId: id });
        }

        // 7. Pickups (GDD §11.2): collected once, for everyone the
        //    same crate — and AUTO-ACTIVATED on collection (GDD §14
        //    Q1's working default: jumping stays the only input).
        //    Self effects bite next tick; offense is telegraphed by
        //    landing a TELEGRAPH distance ahead (effects modules).
        if (mp.alive) {
          for (const pickup of this.terrain.pickupsIn(prevX, mp.player.x + PICKUP_REACH)) {
            if (this.collectedPickups.has(pickup.id)) continue;
            const dx = pickup.x - mp.player.x;
            const dy = pickup.y - mp.player.y;
            if (dx * dx + dy * dy <= PICKUP_REACH * PICKUP_REACH) {
              this.collectedPickups.add(pickup.id);
              events.push({ type: 'pickup', playerId: id, kind: pickup.kind });
              const isOffense = pickup.kind === 'bomb' || pickup.kind === 'spikeTrap' || pickup.kind === 'slow';
              const targetId = isOffense ? selectTarget(id, this.playersById) : id;
              if (targetId === null) {
                // Solo practice: offense with no rival fizzles
                // (review C2's fallback chain, flagged default).
                events.push({ type: 'effectFizzled', kind: pickup.kind, sourceId: id });
              } else {
                this.pendingEffects.push({ tick: tick + 1, kind: pickup.kind, sourceId: id, targetId });
              }
            }
          }
        }

        // 8. Score (§8.2, Pillar 9: only ever up).
        mp = accrueScore(mp, tick, speed);
      }

      this.playersById.set(id, mp);
    }

    // Solo termination (§8.1's solo subset): all players eliminated
    // ⇒ the world won. Multiplayer winner resolution awaits the
    // A8/C1 termination ruling (docs/reviews/) — deliberately not
    // guessed here.
    if (!this.matchOver && this.players.every((p) => p.eliminated)) {
      this.matchOver = true;
      events.push({ type: 'matchOver' });
    }

    // 9. Slide the terrain window: generate ahead of the leader,
    //    prune behind the earliest still-needed checkpoint
    //    (queries.ts contract — never strand a respawn).
    const xs = this.players.filter((p) => !p.eliminated).map((p) => p.player.x);
    if (xs.length > 0) {
      extendTerrain(this.terrain, this.generation, Math.max(...xs) + GENERATE_AHEAD_UNITS);
      const earliestCheckpoint = Math.min(
        ...this.players.filter((p) => !p.eliminated).map((p) => p.checkpointX),
      );
      this.terrain.prune(earliestCheckpoint - KEEP_BEHIND_UNITS);
    }

    return events;
  }
}
