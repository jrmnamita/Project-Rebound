/**
 * ============================================================
 *  index.ts — the public surface of @rebound/sim-core
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Re-exports the parts of the simulation core that the outside
 *    world (apps, tests, later the server) is allowed to use.
 *    Nothing else in this package is reachable from outside.
 *
 *  WHY IT EXISTS (design anchor)
 *    CODING_STANDARDS §7: "A module's public surface is its
 *    index.ts; internals are private by structure, not by
 *    discipline." Consumers import '@rebound/sim-core' — never a
 *    deep path — so this file is the package's contract.
 *
 *  HOW IT FITS
 *    Grows one section per module as the production refactor
 *    proceeds (maintainer-ordered sequence; see AI_CONTEXT.md,
 *    Next Immediate Task).
 *
 *  WHAT IT MUST NEVER DO
 *    Export anything experimental, half-decided, or renderer-shaped.
 *    If it is exported here, it is API.
 * ============================================================
 */

// ── Input System (GDD §6.1, §12 Pillar 1; ARCHITECTURE §3 input-intent model)
export {
  IntentBuffer,
  MAX_INTENTS_PER_PLAYER_PER_TICK,
  type InputIntent,
  type InputIntentType,
  type TickInputs,
} from './input.js';

// ── Player (GDD §6.1 jump rules, §12 Pillars 1/3; composed by Match later)
export {
  JUMP,
  createPlayer,
  applyIntent,
  applyJumpHold,
  land,
  leaveGround,
  type PlayerState,
} from './player.js';

// ── Physics (GDD §5.1 weight, §6.2 world interaction, Pillar 3 auto-forward;
//    ARCHITECTURE §3 fixed 60-tick step)
export {
  PHYSICS,
  stepPhysics,
  type GroundQuery,
  type PhysicsStepResult,
} from './physics.js';

// ── Level / Terrain (GDD §6.2 vocabulary, §8.4 checkpoints, Pillar 8 endless
//    world; ARCHITECTURE §2.2 chunked agreement)
export {
  SPIKE,
  type GroundSegment,
  type HazardZoneDef,
  type PickupDef,
  type PickupKind,
  type PlatformDef,
  type SpikeDef,
} from './terrain/vocabulary.js';
export {
  CHUNK_LENGTH,
  chunkEndX,
  chunkStartX,
  validateChunk,
  type Chunk,
} from './terrain/chunk.js';
export { Terrain } from './terrain/queries.js';

// ── Procedural (ARCHITECTURE §2.2 seeded chunk identity; GDD §6.2 generation
//    rules, §8.4 checkpoint safety, §11.2 pickup weave)
export {
  chance,
  chunkRng,
  hashString,
  mulberry32,
  pickWeighted,
  range,
  rangeInt,
  type Rng,
} from './rng.js';
export {
  GENERATION,
  computeJumpMetrics,
  extendTerrain,
  generateChunk,
  type GenerationParams,
  type JumpMetrics,
} from './terrain/generator.js';

// ── Utilities (constants leaf, statehash, replay)
export { SAFE_PAD_HALF, SIM_VERSION, TICK_RATE } from './constants.js';
export { hashMatchState } from './statehash.js';
export {
  TraceRecorder,
  replayTrace,
  type InputTrace,
  type ReplayResult,
  type TraceFrame,
} from './replay.js';

// ── Game Loop, sim side (GDD §8 match grammar, §8.5 speed curve;
//    ARCHITECTURE §3 fixed-step simulation façade)
export {
  CURVE_DRAFT_1,
  phaseIndexAt,
  phaseNameAt,
  speedAt,
  type PhaseName,
  type SpeedCurve,
} from './curve.js';
export {
  MATCH,
  accrueScore,
  applyDeath,
  applyRespawn,
  createMatchPlayer,
  isProtected,
  touchesSpike,
  type MatchPlayer,
} from './match.js';
export { type DeathCause, type SimEvent } from './events.js';
export { Simulation, type SimulationOptions } from './sim.js';

// ── Effects (GDD §11; ADR-0001 shared world, ADR-0002 healing/immunity)
export {
  EMPTY_EFFECT_WORLD,
  NO_EFFECTS,
  activeTrapSpikes,
  craterAt,
  expireEffects,
  resolveEffect,
  selectTarget,
  type EffectContext,
  type EffectEvent,
  type EffectWorld,
  type PlayerEffects,
} from './effects/resolve.js';
export { BOMB, placeCrater, type Crater } from './effects/bomb.js';
export { TRAP, placeTrap, type TrapSpike } from './effects/spike-trap.js';
export { applyShield } from './effects/shield.js';
export { SLOW, applySlow, gravityScaleFor } from './effects/slow.js';
export { BOOST, applySpeedBoost, scoreRateFor } from './effects/speed-boost.js';
