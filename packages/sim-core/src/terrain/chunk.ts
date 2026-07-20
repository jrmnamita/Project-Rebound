/**
 * ============================================================
 *  chunk.ts — chunks: the world, one fixed-length page at a time
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines the Chunk — a fixed-length slice of world containing
 *    ground segments, platforms, spikes, hazard zones, pickups, and
 *    checkpoint anchors — plus the validation that keeps a chunk
 *    internally honest. Chunks are the unit in which the endless
 *    world is created, streamed, agreed upon, and discarded.
 *
 *  WHY IT EXISTS (design anchor)
 *    - ARCHITECTURE §2.2: world content is generated per chunk from
 *      (seed, chunkIdx, simVersion), and "every chunk
 *      deterministically declares its checkpoint anchor(s)". The
 *      chunk is therefore the atom of world agreement: if two
 *      machines agree on seed and index, they agree on the world.
 *    - GDD §8.4: checkpoints are woven into terrain at regular
 *      intervals — chunk anchors are exactly that weave.
 *    - GDD Pillar 8: the world is endless — nothing can hold "the
 *      whole world", so the world must exist as discardable pages.
 *
 *  HOW IT FITS
 *    The Procedural module (later) MAKES chunks; queries.ts STREAMS
 *    and QUERIES them; this file defines what a well-formed chunk IS.
 *    Validation runs when a chunk enters the stream — validate at
 *    the boundary, trust inside (CODING_STANDARDS §10).
 *
 *  WHAT IT MUST NEVER DO
 *    Generate content (no randomness here), or resolve collisions.
 *    A chunk is a page of the world, not the author of it.
 * ============================================================
 */

import type {
  GroundSegment,
  HazardZoneDef,
  PickupDef,
  PlatformDef,
  SpikeDef,
} from './vocabulary.js';

/**
 * Purpose: The fixed length of every chunk, in world units.
 *
 * Why it exists: fixed-length chunks make "which chunk owns x?" a
 * single division — Math.floor(x / CHUNK_LENGTH) — with no search
 * and no per-chunk bookkeeping. Determinism likes boring math
 * (floor and divide are bit-exact everywhere), and beginners can
 * hold the whole addressing scheme in one line. DRAFT value:
 * structural, not feel — but it still gates content pacing, so the
 * Procedural module's tuning may revisit it (SIM_VERSION bump).
 */
export const CHUNK_LENGTH = 1920;

/**
 * Purpose: Where a chunk begins and ends on the world's x axis.
 *
 * Why they exist: the address scheme in two tiny functions, so no
 * caller ever re-derives it (and gets an off-by-one) locally.
 * Inputs: idx — the chunk's index, 0 at the match start line.
 * Outputs: the inclusive start x / exclusive end x of that chunk.
 * Side effects: none — pure functions.
 */
export function chunkStartX(idx: number): number {
  return idx * CHUNK_LENGTH;
}
export function chunkEndX(idx: number): number {
  return (idx + 1) * CHUNK_LENGTH;
}

/**
 * Purpose: One fixed-length page of the endless world.
 *
 * Why it exists: see the file header — this is the unit of world
 * agreement (ARCHITECTURE §2.2). Every field is readonly: once a
 * chunk exists it is FACT, identical for all four players and the
 * validator (GDD §12.7). Nothing may edit a chunk after creation —
 * Phase 2's bomb craters will be per-player OVERLAYS layered on top
 * in queries (pending design ruling A4), never edits to this data.
 *
 * Field-by-field, with the rule each carries:
 *   idx            — position in the (seed, chunkIdx, simVersion)
 *                    identity (ARCHITECTURE §2.2).
 *   groundSegments — the walkable silhouette, sorted by x0, non-
 *                    overlapping, each fully inside the chunk's
 *                    span. Spans with no segment are gaps (see
 *                    vocabulary.ts on absence-as-truth).
 *   platforms      — optional high routes (GDD §6.2).
 *   spikes         — lethal punctuation (GDD §6.2).
 *   hazardZones    — plan-demanding stretches (GDD §6.2).
 *   pickups        — power-up crates, identical for everyone
 *                    (GDD §11.2).
 *   checkpointXs   — checkpoint anchor positions, ascending
 *                    (GDD §8.4; ARCHITECTURE §2.2 "anchor(s)").
 *   entryY, exitY  — the ground height at which this chunk begins
 *                    and ends, so consecutive chunks join without
 *                    cliffs. The world must read as "rolling,
 *                    organic, continuous" (GDD §6.2) — continuity is
 *                    validated where chunks meet (queries.ts).
 */
export interface Chunk {
  readonly idx: number;
  readonly groundSegments: readonly GroundSegment[];
  readonly platforms: readonly PlatformDef[];
  readonly spikes: readonly SpikeDef[];
  readonly hazardZones: readonly HazardZoneDef[];
  readonly pickups: readonly PickupDef[];
  readonly checkpointXs: readonly number[];
  readonly entryY: number;
  readonly exitY: number;
}

/**
 * Purpose: Verify a chunk is internally well-formed; throw if not.
 *
 * Why it exists: chunks will come from the Procedural generator —
 * and later, effectively, from anyone who can influence a seed. A
 * malformed chunk (overlapping ground, features outside the chunk's
 * span) would corrupt every player's shared world at once, so it is
 * an INVARIANT VIOLATION: per CODING_STANDARDS §10 it fails fast,
 * loudly, and deterministically (same bad chunk → same error, every
 * machine). Expected gameplay outcomes are states, never throws —
 * but a broken world is not a gameplay outcome.
 *
 * Inputs: chunk — the candidate page of world.
 * Outputs: none on success (the chunk is exactly as given).
 * Side effects: none — pure check; throws Error on violation with a
 * message naming chunk idx and the broken rule (honest failure,
 * CODING_STANDARDS §10).
 * Related systems: called by the Terrain stream on every addChunk
 * (queries.ts); the Procedural module's tests will lean on it.
 */
export function validateChunk(chunk: Chunk): void {
  const startX = chunkStartX(chunk.idx);
  const endX = chunkEndX(chunk.idx);
  const fail = (rule: string): never => {
    throw new Error(`Invalid chunk ${chunk.idx}: ${rule}`);
  };

  if (!Number.isInteger(chunk.idx) || chunk.idx < 0) {
    fail('idx must be a non-negative integer');
  }

  // Ground: sorted, non-overlapping, inside the chunk, finite, and
  // each segment running left-to-right (x0 < x1) — the shape every
  // query in queries.ts is allowed to trust without rechecking.
  let previousEnd = startX;
  for (const seg of chunk.groundSegments) {
    if (![seg.x0, seg.x1, seg.y0, seg.y1].every(Number.isFinite)) {
      fail('ground segment has non-finite coordinates');
    }
    if (seg.x0 >= seg.x1) fail('ground segment must run left-to-right (x0 < x1)');
    if (seg.x0 < previousEnd) fail('ground segments must be sorted and non-overlapping');
    if (seg.x0 < startX || seg.x1 > endX) fail('ground segment exceeds chunk bounds');
    previousEnd = seg.x1;
  }

  for (const p of chunk.platforms) {
    if (p.x0 >= p.x1) fail('platform must run left-to-right (x0 < x1)');
    if (p.x0 < startX || p.x1 > endX) fail('platform exceeds chunk bounds');
  }
  for (const s of chunk.spikes) {
    if (s.x < startX || s.x >= endX) fail('spike outside chunk bounds');
  }
  for (const h of chunk.hazardZones) {
    if (h.x0 >= h.x1) fail('hazard zone must run left-to-right (x0 < x1)');
    if (h.x0 < startX || h.x1 > endX) fail('hazard zone exceeds chunk bounds');
  }
  for (const pk of chunk.pickups) {
    if (pk.x < startX || pk.x >= endX) fail('pickup outside chunk bounds');
  }

  // Checkpoints: ascending, inside the chunk. GDD §8.4 additionally
  // requires respawn-safe placement (flat, hazard-free) — that is a
  // GENERATION duty verified by the Procedural module's tests; this
  // structural check only guards what a chunk can know alone.
  let previousCheckpoint = -Infinity;
  for (const cx of chunk.checkpointXs) {
    if (cx < startX || cx >= endX) fail('checkpoint outside chunk bounds');
    if (cx <= previousCheckpoint) fail('checkpoints must be strictly ascending');
    previousCheckpoint = cx;
  }
}
