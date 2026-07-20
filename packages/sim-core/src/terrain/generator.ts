/**
 * ============================================================
 *  generator.ts — the Procedural generator: a seed becomes a world
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Deterministically composes chunks of world from a seed string:
 *    flats, slopes, hills, gaps, floating platforms, spikes, hazard
 *    zones, checkpoints, and pickups — the full GDD §6.2 vocabulary.
 *    Every challenge it emits is provably clearable, because its
 *    sizing constraints are DERIVED from the real Player and Physics
 *    modules (computeJumpMetrics below), not guessed: retune the
 *    jump, and the world resizes itself to stay fair.
 *
 *  WHY IT EXISTS (design anchor)
 *    - ARCHITECTURE §2.2: chunks derive from (seed, chunkIdx,
 *      simVersion); checkpoints and pickups are generator artifacts
 *      all clients agree on with zero messages.
 *    - GDD §6.2 generation rules: "every challenge must be
 *      survivable on sight at the speed it appears; difficulty comes
 *      from density and speed, never from off-screen surprises or
 *      leaps of faith; the world should read as natural and smooth —
 *      rolling, organic, continuous — not as an obstacle grid."
 *    - GDD §8.4: checkpoints woven in at regular intervals, "safe by
 *      construction: flat, hazard-free ground with fair sightlines."
 *    - GDD §11.2: pickups "woven into risk/reward routes (the juicy
 *      pickup is on the high platform; the safe line has none)."
 *    - ARCHITECTURE §2.2: terrain CONTENT difficulty keys to
 *      distance (chunk index); speed pressure keys to the match
 *      clock. This file owns the distance half only.
 *
 *  HOW IT FITS
 *    The Game Loop (later) calls extendTerrain() to keep generation
 *    ahead of the players; chunks flow into the Terrain container
 *    (queries.ts), which validates them at its doorway. Jump metrics
 *    come from simulating player.ts + physics.ts directly — the
 *    generator is a CONSUMER of the real physics, never a copy.
 *
 *  WHY GAPS SIZED AT BASE SPEED STAY FAIR AT ANY SPEED
 *    A respawning player can replay a chunk while the match clock —
 *    and therefore the speed — is higher than on first meeting
 *    (GDD §8.4: checkpoints never slow the world). Airtime is
 *    speed-independent (gravity does not care how fast you scroll),
 *    so jump DISTANCE = airtime × speed GROWS with speed. A gap
 *    clearable at the curve's base speed is therefore clearable at
 *    every later speed; what shrinks is the time to SEE it coming —
 *    exactly the difficulty the design wants (GDD §3) and nothing
 *    else.
 *
 *  WHAT IT MUST NEVER DO
 *    Touch Math.random or any clock (all randomness flows from
 *    rng.ts); emit an unclearable challenge; place hazards on a
 *    checkpoint pad; or edit a chunk after emitting it.
 * ============================================================
 */

import { SIM_VERSION } from '../constants.js';
import { chance, chunkRng, pickWeighted, range, rangeInt, type Rng } from '../rng.js';
import { applyIntent, createPlayer, land, JUMP, type PlayerState } from '../player.js';
import { PHYSICS, stepPhysics } from '../physics.js';
import { CHUNK_LENGTH, chunkEndX, chunkStartX, type Chunk } from './chunk.js';
import type {
  GroundSegment,
  HazardZoneDef,
  PickupDef,
  PickupKind,
  PlatformDef,
  SpikeDef,
} from './vocabulary.js';

// SIM_VERSION moved to its final home in constants.ts (Utilities
// module) — the generator consumes the whole-ruleset stamp like
// every other module (imported above).

/**
 * Purpose: Draft generation tunables — pacing, bounds, and the
 * safety margins that keep "survivable on sight" true with room to
 * spare.
 *
 * Why margins exist (the recurring shape below): a gap sized at
 * exactly 100% of the hold-jump distance is clearable only by a
 * frame-perfect player — legal, but it FEELS stolen (GDD §5.1).
 * Factors like 0.7 mean "clearable with human slack." All values
 * DRAFT, playtest-owned (GDD §14); changes bump SIM_VERSION.
 */
export const GENERATION = {
  /** Canonical ground height at every chunk seam. Fixing seams to
   *  one baseline makes each chunk independently generatable from
   *  its identity triple alone — no chaining, which is what lets
   *  any machine produce chunk N without chunks 0..N−1
   *  (ARCHITECTURE §2.2). Hills rise and fall WITHIN a chunk. */
  BASELINE_Y: 0,
  /** Vertical wandering bounds (y grows downward: negative = high
   *  ground). Generous vertical framing is a portrait asset
   *  (GDD §6.3), but unbounded wander would outrun the camera. */
  MIN_Y: -220,
  MAX_Y: 180,
  /** Max slope grade (|dy|/dx). 0.45 keeps downhill drop-per-tick
   *  well under PHYSICS.STEP_DOWN_TOLERANCE at all plausible curve
   *  speeds, so slopes are FLOW (GDD §6.2), not surprise launches —
   *  until deep Extreme Survival, where physics turning downslopes
   *  into micro-launches is the world winning, as designed. */
  MAX_GRADE: 0.45,
  /** The flat, hazard-free pad opening every chunk; its middle is
   *  the checkpoint. 360 units ≈ 1.4 s of sightline at base speed —
   *  "fair sightlines to what's coming" (GDD §8.4). */
  SAFE_PAD_LENGTH: 360,
  /** Fraction of tap-jump distance a small gap may span — a timing
   *  check, "a confident tap" (GDD §6.2). */
  SMALL_GAP_FACTOR_MIN: 0.45,
  SMALL_GAP_FACTOR_MAX: 0.68,
  /** Fraction of hold-jump distance a large gap may span — a
   *  commitment check, "a full hold" (GDD §6.2). */
  LARGE_GAP_FACTOR_MIN: 0.55,
  LARGE_GAP_FACTOR_MAX: 0.72,
  /** Fraction of hold-jump rise a platform may sit above ground —
   *  the optional high route must be reachable (GDD §6.2). */
  PLATFORM_HEIGHT_FACTOR_MIN: 0.45,
  PLATFORM_HEIGHT_FACTOR_MAX: 0.68,
  /** Fraction of hold-jump distance a hazard zone may span — one
   *  committed, planned hold clears it (GDD §6.2: "demand a plan"). */
  HAZARD_LENGTH_FACTOR_MAX: 0.75,
  /** Chance a platform run carries a pickup — §11.4: "seasoning,
   *  not the meal." */
  PICKUP_ON_PLATFORM_CHANCE: 0.5,
  /** Content difficulty tier ramp: tier = min(idx / 2, 5). Tier 0
   *  (the first two chunks) is pure flow — no gaps, no hazards —
   *  because "nobody should die in Normal except by throwing"
   *  (GDD §8.5) and the opening doubles as the unaided tutorial. */
  TIER_DIVISOR: 2,
  TIER_MAX: 5,
  /** Default base speed used to size challenges until the speed-
   *  curve module (Utilities) owns the real value — see the fairness
   *  note in the file header. DRAFT. */
  BASE_SPEED_UNITS_PER_TICK: 4.2,
} as const;

/**
 * Purpose: What the real physics says a jump can do at a given
 * speed — measured, not assumed.
 *
 * Related systems: produced by computeJumpMetrics; consumed by every
 * sizing rule in this file.
 */
export interface JumpMetrics {
  /** Forward distance covered by a tap jump (world units). */
  readonly tapDistance: number;
  /** Forward distance covered by a full-hold jump (world units). */
  readonly holdDistance: number;
  /** Peak height gained by a full-hold jump (world units). */
  readonly holdRise: number;
}

/**
 * Purpose: Measure tap and full-hold jumps by SIMULATING them with
 * the real player.ts + physics.ts on flat ground.
 *
 * Why it exists: the generator's entire fairness contract ("every
 * challenge survivable on sight", GDD §6.2) rests on knowing what a
 * jump can clear. Copying numbers out of JUMP/PHYSICS would rot the
 * moment anyone retunes them; RUNNING the modules cannot rot. This
 * is also why the generator sits downstream of Player and Physics in
 * the build order.
 *
 * Inputs: speedUnitsPerTick — the forward speed to measure at (jump
 * distance depends on it; airtime does not).
 * Outputs: JumpMetrics for that speed.
 * Side effects: none — pure (simulates on local throwaway state).
 */
export function computeJumpMetrics(speedUnitsPerTick: number): JumpMetrics {
  const surfaceY = 0;
  const flat = { groundSurfaceAt: () => surfaceY };

  const measure = (holdTicks: number): { distance: number; rise: number } => {
    let player: PlayerState = land(createPlayer('probe', 0, 0), surfaceY - PHYSICS.PLAYER_RADIUS);
    player = applyIntent(player, 'press');
    const startX = player.x;
    const groundY = player.y;
    let peakRise = 0;
    for (let tick = 0; tick < 600; tick += 1) {
      if (tick === holdTicks) player = applyIntent(player, 'release');
      const result = stepPhysics(player, speedUnitsPerTick, flat);
      player = result.player;
      peakRise = Math.max(peakRise, groundY - player.y);
      if (result.landed) break;
    }
    return { distance: player.x - startX, rise: peakRise };
  };

  const tap = measure(1);
  const hold = measure(JUMP.HOLD_BOOST_MAX_TICKS + 2);
  return { tapDistance: tap.distance, holdDistance: hold.distance, holdRise: hold.rise };
}

/**
 * Purpose: Everything generateChunk needs to know about the world it
 * is building for.
 *
 * Why pickupKinds is a parameter: which power-ups spawn is a MODE
 * decision (solo practice vs. live rooms — GDD §10/§11.4, and the
 * §14 activation question is still open), so the generator accepts
 * the list instead of deciding it. Terrain places crates; modes
 * choose their contents.
 */
export interface GenerationParams {
  readonly seed: string;
  /** Speed to size challenges at — the curve's base. Defaults to the
   *  draft base until the curve module owns the number. */
  readonly baseSpeedUnitsPerTick?: number;
  /** Power-up kinds this world may spawn (default: all five). */
  readonly pickupKinds?: readonly PickupKind[];
}

const ALL_PICKUP_KINDS: readonly PickupKind[] = ['bomb', 'spikeTrap', 'slow', 'shield', 'speedBoost'];

/** The mutable easel a chunk is painted on — internal only. */
interface Builder {
  rng: Rng;
  cursorX: number;
  currentY: number;
  segments: GroundSegment[];
  platforms: PlatformDef[];
  spikes: SpikeDef[];
  hazards: HazardZoneDef[];
  pickups: PickupDef[];
  pickupCount: number;
}

/** Append a ground segment, advancing the cursor and current height. */
function emitGround(b: Builder, dx: number, dy: number): void {
  const x1 = b.cursorX + dx;
  const y1 = b.currentY + dy;
  b.segments.push({ x0: b.cursorX, y0: b.currentY, x1, y1 });
  b.cursorX = x1;
  b.currentY = y1;
}

/** A slope's dy, clamped so the ground never wanders out of bounds. */
function boundedDy(b: Builder, dx: number, preferUp: boolean): number {
  const magnitude = range(b.rng, 0.2, GENERATION.MAX_GRADE) * dx;
  const dy = preferUp ? -magnitude : magnitude; // y grows downward
  const target = b.currentY + dy;
  if (target < GENERATION.MIN_Y || target > GENERATION.MAX_Y) return -dy;
  return dy;
}

/**
 * Purpose: One feature of the terrain vocabulary, emitted onto the
 * builder. Each emitter is a few lines implementing one GDD §6.2
 * table row — the vocabulary table, executable.
 */
function emitFlat(b: Builder, minLen = 180, maxLen = 380): void {
  emitGround(b, range(b.rng, minLen, maxLen), 0);
}
function emitSlope(b: Builder): void {
  const dx = range(b.rng, 220, 420);
  emitGround(b, dx, boundedDy(b, dx, chance(b.rng, 0.5)));
}
function emitHill(b: Builder): void {
  // Up then down by the same dy: momentum joy that ends where it
  // began — "rolling, organic" (GDD §6.2).
  const dx = range(b.rng, 180, 320);
  const dy = boundedDy(b, dx, true);
  emitGround(b, dx, dy);
  emitGround(b, dx, -dy);
}
function emitGap(b: Builder, width: number): void {
  // A gap is ABSENCE (vocabulary.ts): advance the cursor without a
  // segment. Take-off and landing sit at the SAME height, so the
  // documented ability (a tap, or a full hold) is always sufficient —
  // never a hidden climb stacked on top of a distance check.
  b.cursorX += width;
  emitFlat(b, 200, 320); // guaranteed landing ground
}
function emitPlatformRun(b: Builder, metrics: JumpMetrics, kinds: readonly PickupKind[], idx: number): void {
  const length = range(b.rng, 240, 380);
  const height = range(
    b.rng,
    GENERATION.PLATFORM_HEIGHT_FACTOR_MIN,
    GENERATION.PLATFORM_HEIGHT_FACTOR_MAX,
  ) * metrics.holdRise;
  const x0 = b.cursorX + 40;
  const platform: PlatformDef = { x0, x1: x0 + length - 80, y: b.currentY - height };
  b.platforms.push(platform);
  // The risk/reward weave (GDD §11.2): pickups live ONLY up here —
  // the high route pays, the safe line never does.
  if (kinds.length > 0 && chance(b.rng, GENERATION.PICKUP_ON_PLATFORM_CHANCE)) {
    const kind = kinds[rangeInt(b.rng, 0, kinds.length - 1)] as PickupKind;
    b.pickups.push({
      id: `p${idx}-${b.pickupCount}`,
      x: range(b.rng, platform.x0 + 30, platform.x1 - 30),
      y: platform.y - 30,
      kind,
    });
    b.pickupCount += 1;
  }
  emitGround(b, length, 0); // the safe low route continues beneath
}
function emitSpikeStretch(b: Builder, metrics: JumpMetrics): void {
  // Spikes are punctuation on FLAT ground with entry/exit margins —
  // readable at speed, clearable by a tap (GDD §6.2). Never beside a
  // gap edge: one challenge at a time is what "survivable on sight"
  // means in practice.
  const count = rangeInt(b.rng, 1, 2);
  const margin = metrics.tapDistance * 0.9;
  const spacing = metrics.tapDistance * 0.9;
  const length = margin * 2 + spacing * (count - 1);
  const startX = b.cursorX;
  for (let i = 0; i < count; i += 1) {
    b.spikes.push({ x: startX + margin + i * spacing, y: b.currentY });
  }
  emitGround(b, length, 0);
}
function emitHazardZone(b: Builder, metrics: JumpMetrics): void {
  // A marked deadly stretch, at most one committed hold long — the
  // "plan, not a reflex" challenge (GDD §6.2). Ground EXISTS beneath
  // it (it is marked, not missing): the read is "do not touch",
  // which renders unmistakably and telegraphs honestly.
  const length = range(b.rng, 0.45, GENERATION.HAZARD_LENGTH_FACTOR_MAX) * metrics.holdDistance;
  const entry = 60;
  b.hazards.push({ x0: b.cursorX + entry, x1: b.cursorX + entry + length });
  emitGround(b, entry + length + entry, 0);
}

/**
 * Purpose: Generate one complete chunk from its identity triple —
 * THE function of the Procedural module.
 *
 * Why the shape is: safe pad → features → glide home:
 *   - Safe pad first: every chunk opens with flat, hazard-free
 *     ground whose middle is the checkpoint — regular intervals and
 *     safety by construction in one stroke (GDD §8.4).
 *   - Weighted features by difficulty tier: content difficulty keys
 *     to DISTANCE (chunk index) per ARCHITECTURE §2.2 — density
 *     rises, the vocabulary widens (gaps at tier 1, spikes and large
 *     gaps at tier 2, hazard zones at tier 3), and tier 0 is pure
 *     flow (the unaided tutorial, GDD §8.5's gentle Normal).
 *   - Glide home: the tail steers the ground back to BASELINE_Y at a
 *     legal grade and runs flat to the seam, keeping every chunk
 *     independently generatable and every seam cliff-free
 *     (GDD §6.2: continuous).
 *
 * Inputs: params — world configuration; idx — which chunk.
 * Outputs: a Chunk ready for Terrain.addChunk (which validates it —
 * the generator's honesty is checked at the world's doorway, and
 * property-tested in procedural.test.ts).
 * Side effects: none — pure function of (seed, idx, SIM_VERSION,
 * params).
 */
export function generateChunk(params: GenerationParams, idx: number): Chunk {
  const rng = chunkRng(params.seed, idx, SIM_VERSION);
  const metrics = computeJumpMetrics(
    params.baseSpeedUnitsPerTick ?? GENERATION.BASE_SPEED_UNITS_PER_TICK,
  );
  const kinds = params.pickupKinds ?? ALL_PICKUP_KINDS;
  const tier = Math.min(Math.floor(idx / GENERATION.TIER_DIVISOR), GENERATION.TIER_MAX);
  const startX = chunkStartX(idx);
  const endX = chunkEndX(idx);

  const b: Builder = {
    rng,
    cursorX: startX,
    currentY: GENERATION.BASELINE_Y,
    segments: [],
    platforms: [],
    spikes: [],
    hazards: [],
    pickups: [],
    pickupCount: 0,
  };

  // 1. The safe pad + checkpoint (GDD §8.4).
  const checkpointX = startX + GENERATION.SAFE_PAD_LENGTH / 2;
  emitGround(b, GENERATION.SAFE_PAD_LENGTH, 0);

  // 2. Features, tier-weighted, while room remains. The reserve
  //    guarantees space for the glide home at a legal grade.
  type Feature = 'flat' | 'slope' | 'hill' | 'smallGap' | 'largeGap' | 'platform' | 'spikes' | 'hazard';
  const weights: ReadonlyArray<readonly [Feature, number]> = [
    ['flat', 3],
    ['slope', 3],
    ['hill', 2],
    ['smallGap', tier >= 1 ? 2 : 0],
    ['platform', tier >= 1 ? 1.5 : 0],
    ['largeGap', tier >= 2 ? 1.5 : 0],
    ['spikes', tier >= 2 ? 1 + tier * 0.3 : 0],
    ['hazard', tier >= 3 ? 1.5 : 0],
  ];
  const maxFeatureSpan = Math.max(metrics.holdDistance * 1.5, 900);
  for (;;) {
    const glideReserve = Math.abs(b.currentY - GENERATION.BASELINE_Y) / GENERATION.MAX_GRADE + 160;
    if (endX - b.cursorX < glideReserve + maxFeatureSpan) break;
    const active = weights.filter(([, w]) => w > 0);
    switch (pickWeighted(rng, active)) {
      case 'flat': emitFlat(b); break;
      case 'slope': emitSlope(b); break;
      case 'hill': emitHill(b); break;
      case 'smallGap':
        emitGap(b, range(rng, GENERATION.SMALL_GAP_FACTOR_MIN, GENERATION.SMALL_GAP_FACTOR_MAX) * metrics.tapDistance);
        break;
      case 'largeGap':
        emitGap(b, range(rng, GENERATION.LARGE_GAP_FACTOR_MIN, GENERATION.LARGE_GAP_FACTOR_MAX) * metrics.holdDistance);
        break;
      case 'platform': emitPlatformRun(b, metrics, kinds, idx); break;
      case 'spikes': emitSpikeStretch(b, metrics); break;
      case 'hazard': emitHazardZone(b, metrics); break;
    }
  }

  // 3. Glide home: back to the baseline seam, then flat to the edge.
  const offset = b.currentY - GENERATION.BASELINE_Y;
  if (offset !== 0) {
    emitGround(b, Math.abs(offset) / GENERATION.MAX_GRADE, -offset);
  }
  emitGround(b, endX - b.cursorX, 0);

  return {
    idx,
    groundSegments: b.segments,
    platforms: b.platforms,
    spikes: b.spikes,
    hazardZones: b.hazards,
    pickups: b.pickups,
    checkpointXs: [checkpointX],
    entryY: GENERATION.BASELINE_Y,
    exitY: GENERATION.BASELINE_Y,
  };
}

/**
 * Purpose: Keep the world generated ahead of play — the streaming
 * policy of the Procedural module.
 *
 * Why it exists: Terrain fails fast on queries beyond the loaded
 * window (queries.ts) — deliberately, so under-generation is a loud
 * bug. This helper is the loud bug's prevention: the Game Loop calls
 * it each tick with "the furthest x anyone (player or camera) will
 * ask about", and it appends chunks until the window covers it.
 *
 * Inputs: terrain — the live container (its addChunk validates
 * every chunk this function produces); params — world configuration
 * (must be the same every call for one world — the seed IS the
 * world); untilX — cover at least this far.
 * Outputs: none.
 * Side effects: appends chunks to terrain (see Terrain's
 * side-effects policy: the window changes, content never does).
 */
export function extendTerrain(
  terrain: { addChunk(chunk: Chunk): void; loadedChunks: readonly Chunk[] },
  params: GenerationParams,
  untilX: number,
): void {
  for (;;) {
    const last = terrain.loadedChunks[terrain.loadedChunks.length - 1];
    const nextIdx = last === undefined ? 0 : last.idx + 1;
    if (last !== undefined && chunkEndX(last.idx) > untilX) return;
    terrain.addChunk(generateChunk(params, nextIdx));
  }
}
