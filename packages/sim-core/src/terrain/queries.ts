/**
 * ============================================================
 *  queries.ts — the Terrain: streaming the endless world,
 *                answering its questions
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Holds the currently-loaded window of world chunks and answers
 *    every question the simulation asks about it: "how high is the
 *    ground at x?", "which checkpoints were just passed?", "what
 *    spikes/platforms/pickups are near?". It is the living container
 *    for the data types defined in vocabulary.ts and chunk.ts.
 *
 *    (Naming note for readers of the build plan: the maintainer's
 *    module sequence calls this the "Level" module. The class is
 *    named Terrain because that is the GDD's own vocabulary — §6.2
 *    "The World" speaks of terrain throughout — and CODING_STANDARDS
 *    §1 says code vocabulary comes from the GDD glossary.)
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD Pillar 8: the world is endless. No machine can hold it
 *      all, so the Terrain is a sliding WINDOW: the Procedural
 *      module (later) appends chunks ahead of the players, and
 *      prune() releases chunks safely behind them.
 *    - GDD §8.4: respawns happen at checkpoints — which is why
 *      pruning is checkpoint-aware by CONTRACT (see prune()): the
 *      prototype pruned behind the ball and would have deleted the
 *      very ground a respawning player needs (2026-07-20 audit).
 *    - ARCHITECTURE §2.2: all clients agree on chunks without
 *      messages; this container never edits a chunk after adding it,
 *      so agreement, once established, cannot rot.
 *
 *  HOW IT FITS
 *    Physics consumes this through its narrow GroundQuery interface
 *    (physics.ts) — Terrain satisfies it structurally by having a
 *    groundSurfaceAt method. Match (later) consumes the checkpoint
 *    and hazard queries to judge deaths and respawns. The renderer
 *    reads chunks to draw the world. Phase 2 bomb craters will be
 *    PER-PLAYER OVERLAYS layered over these queries (pending design
 *    ruling A4, docs/reviews/2026-07-20-documentation-review.md) —
 *    the base chunks stay identical for everyone (GDD §12.7).
 *
 *  WHAT IT MUST NEVER DO
 *    Generate content (no randomness), mutate chunks, or answer
 *    questions about world it does not hold — an out-of-window query
 *    is a programmer error and fails fast (CODING_STANDARDS §10),
 *    never a silent "no ground here" that would read as a gap and
 *    kill someone unfairly.
 * ============================================================
 */

import { CHUNK_LENGTH, chunkEndX, chunkStartX, validateChunk, type Chunk } from './chunk.js';
import type {
  GroundSegment,
  PickupDef,
  PlatformDef,
  SpikeDef,
} from './vocabulary.js';

/**
 * Purpose: Linear interpolation of a ground segment's height at x.
 *
 * Why it exists: slopes are stored as endpoints (vocabulary.ts), so
 * "how high is this slope at x?" is one ratio — plain +, −, ×, ÷,
 * all bit-exact across JS engines. This single arithmetic line is
 * the entire reason the terrain model never needs the banned
 * trigonometric functions (CODING_STANDARDS §8).
 *
 * Inputs: seg — the segment (x0 < x1 guaranteed by validateChunk);
 * x — a position with seg.x0 <= x <= seg.x1.
 * Outputs: the surface y at x (y grows downward).
 * Side effects: none — pure function.
 */
function interpolateSurfaceY(seg: GroundSegment, x: number): number {
  const t = (x - seg.x0) / (seg.x1 - seg.x0);
  return seg.y0 + t * (seg.y1 - seg.y0);
}

/**
 * Purpose: The streaming window of the endless world — chunks in,
 * questions answered, chunks out.
 *
 * Why it is a class: it carries state across the whole match (the
 * loaded chunk window), the exact "stateful lifecycle" case
 * CODING_STANDARDS §6 reserves classes for — same justification as
 * IntentBuffer, and unlike the pure player/physics functions.
 *
 * Side effects policy: addChunk and prune mutate the WINDOW (which
 * chunks are held); nothing ever mutates a chunk's CONTENT. Queries
 * are pure reads. That split is what keeps the world shareable:
 * every machine that added the same chunks answers every query
 * identically, forever.
 *
 * Related systems: Physics (GroundQuery), Match (checkpoints,
 * hazards, deaths), the Procedural module (its only customer-facing
 * output is addChunk calls), the renderer (draws held chunks).
 */
export class Terrain {
  /** The loaded window, contiguous by idx, ascending. */
  private chunks: Chunk[] = [];

  /**
   * Purpose: Append the next chunk of world, after checking it is
   * well-formed and joins the window seamlessly.
   *
   * Why it exists: this is the one doorway world data enters the
   * simulation through — so it is where "validate at the boundary,
   * trust inside" happens for the world itself (CODING_STANDARDS
   * §10). Three invariants are enforced, each protecting a rule:
   *   1. validateChunk — the chunk is internally honest (chunk.ts);
   *   2. contiguity — chunk idx follows the previous one; the
   *      endless world has no missing pages (Pillar 8);
   *   3. seam continuity — entryY equals the previous exitY, so the
   *      world reads "rolling, organic, continuous" (GDD §6.2) with
   *      no accidental cliffs at page boundaries.
   *
   * Inputs: chunk — the next page, produced by the Procedural
   * module (later) or by tests.
   * Outputs: none.
   * Side effects: grows the window. Throws (deterministically) on
   * any violation — a broken world is an invariant violation, not a
   * gameplay outcome.
   */
  addChunk(chunk: Chunk): void {
    validateChunk(chunk);
    const last = this.chunks[this.chunks.length - 1];
    if (last !== undefined) {
      if (chunk.idx !== last.idx + 1) {
        throw new Error(
          `Terrain: chunk ${chunk.idx} does not follow ${last.idx} — the window must stay contiguous`,
        );
      }
      if (chunk.entryY !== last.exitY) {
        throw new Error(
          `Terrain: chunk ${chunk.idx} entryY ${chunk.entryY} != previous exitY ${last.exitY} — seams must join`,
        );
      }
    }
    this.chunks.push(chunk);
  }

  /**
   * Purpose: Release chunks that lie entirely before keepFromX.
   *
   * Why it exists: endless world, finite memory (Pillar 8 meets
   * reality). THE CONTRACT CALLERS MUST HONOR: keepFromX must be no
   * greater than the earliest position still needed by anyone —
   * in practice min(earliest live checkpoint among alive players,
   * camera trailing edge). The prototype pruned behind the ball and
   * would have deleted respawn ground (2026-07-20 audit); this
   * signature makes the caller name the safe line explicitly.
   *
   * Inputs: keepFromX — the leftmost world position that must stay
   * loaded. The chunk containing it is always kept.
   * Outputs: none.
   * Side effects: shrinks the window from the left.
   */
  prune(keepFromX: number): void {
    this.chunks = this.chunks.filter((c) => chunkEndX(c.idx) > keepFromX);
  }

  /**
   * Purpose: The walkable surface height at x — or null over a gap.
   *
   * Why it exists: this is the Physics module's one question
   * (GroundQuery, physics.ts) — Terrain satisfies that interface
   * structurally with this method. Null means "no ground": gaps are
   * the ABSENCE of segments (vocabulary.ts), so falling into one
   * needs no special code anywhere.
   *
   * Inputs: x — a world position INSIDE the loaded window.
   * Outputs: surface y at x, or null over a gap.
   * Side effects: none. Throws if x is outside the window — asking
   * about unloaded world is a bug in the caller (generation must
   * stay ahead of the players; that duty belongs to the Game Loop),
   * and a silent null here would masquerade as a gap and cause an
   * unfair death (GDD §5.1: never a death that feels stolen).
   */
  groundSurfaceAt(x: number): number | null {
    const chunk = this.chunkAt(x);
    for (const seg of chunk.groundSegments) {
      if (x >= seg.x0 && x <= seg.x1) {
        return interpolateSurfaceY(seg, x);
      }
    }
    return null; // No segment covers x: this is a gap, by definition.
  }

  /**
   * Purpose: The checkpoints passed while moving from x0 to x1
   * (exclusive of x0, inclusive of x1), ascending.
   *
   * Why it exists: GDD §8.4 — checkpoints are "passed through
   * automatically (no action required)". The Match module detects
   * passage by asking this once per tick with the player's old and
   * new x; the half-open interval guarantees a checkpoint standing
   * exactly on a tick boundary is counted exactly once.
   *
   * Inputs: x0, x1 — last tick's and this tick's player x, both
   * inside the loaded window.
   * Outputs: checkpoint x positions crossed, ascending (usually
   * empty; occasionally one).
   * Side effects: none.
   */
  checkpointsIn(x0: number, x1: number): number[] {
    const found: number[] = [];
    for (const chunk of this.chunksTouching(x0, x1)) {
      for (const cx of chunk.checkpointXs) {
        if (cx > x0 && cx <= x1) found.push(cx);
      }
    }
    return found;
  }

  /**
   * Purpose: The nearest checkpoint at or before x — the respawn
   * target for a player who dies at x.
   *
   * Why it exists: GDD §8.3 — death respawns "at the latest
   * checkpoint". Match owns each player's remembered checkpoint;
   * this query exists for spawn placement and for sanity checks
   * (the remembered checkpoint must still be loaded — see prune()).
   *
   * Inputs: x — a position inside the loaded window.
   * Outputs: the latest checkpoint x <= x, or null if none is loaded
   * (only possible at the very start of a world, before the first
   * checkpoint — the match start line serves as the implicit spawn).
   * Side effects: none.
   */
  latestCheckpointAtOrBefore(x: number): number | null {
    for (let i = this.chunks.length - 1; i >= 0; i -= 1) {
      const chunk = this.chunks[i];
      if (chunk === undefined || chunkStartX(chunk.idx) > x) continue;
      for (let j = chunk.checkpointXs.length - 1; j >= 0; j -= 1) {
        const cx = chunk.checkpointXs[j];
        if (cx !== undefined && cx <= x) return cx;
      }
    }
    return null;
  }

  /**
   * Purpose: Terrain features overlapping [x0, x1] — platforms,
   * spikes, pickups — and hazard-zone membership at a point.
   *
   * Why they exist: the Match module judges spike/hazard contact
   * (GDD §6.2's lethal punctuation and plan-demanding stretches) and
   * pickup collection (GDD §11.2); the renderer draws what is near
   * the camera. Physics never calls these — it cannot even ask
   * (see physics.ts on the deliberately narrow GroundQuery).
   *
   * Inputs: ranges/points inside the loaded window.
   * Outputs: matching features in world order; hazardZoneAt returns
   * a plain boolean.
   * Side effects: none.
   */
  platformsIn(x0: number, x1: number): PlatformDef[] {
    return this.chunksTouching(x0, x1).flatMap((c) =>
      c.platforms.filter((p) => p.x1 >= x0 && p.x0 <= x1),
    );
  }
  spikesIn(x0: number, x1: number): SpikeDef[] {
    return this.chunksTouching(x0, x1).flatMap((c) =>
      c.spikes.filter((s) => s.x >= x0 && s.x <= x1),
    );
  }
  pickupsIn(x0: number, x1: number): PickupDef[] {
    return this.chunksTouching(x0, x1).flatMap((c) =>
      c.pickups.filter((p) => p.x >= x0 && p.x <= x1),
    );
  }
  hazardZoneAt(x: number): boolean {
    return this.chunkAt(x).hazardZones.some((h) => x >= h.x0 && x <= h.x1);
  }

  /** The loaded window, for the renderer and for diagnostics. */
  get loadedChunks(): readonly Chunk[] {
    return this.chunks;
  }

  /**
   * Purpose: Resolve the chunk that owns x, or fail fast.
   * Why it exists: fixed-length chunks make ownership one division
   * (chunk.ts, CHUNK_LENGTH) — this helper adds only the window
   * check that turns "unloaded" into a loud, deterministic error.
   */
  private chunkAt(x: number): Chunk {
    const first = this.chunks[0];
    if (first === undefined) {
      throw new Error('Terrain: no chunks loaded');
    }
    const idx = Math.floor(x / CHUNK_LENGTH);
    const chunk = this.chunks[idx - first.idx];
    if (chunk === undefined) {
      throw new Error(
        `Terrain: x=${x} (chunk ${idx}) is outside the loaded window [${first.idx}..${first.idx + this.chunks.length - 1}]`,
      );
    }
    return chunk;
  }

  /** All loaded chunks overlapping [x0, x1] — tolerant at the edges
   *  (range queries near the window border are legitimate). */
  private chunksTouching(x0: number, x1: number): Chunk[] {
    return this.chunks.filter((c) => chunkEndX(c.idx) >= x0 && chunkStartX(c.idx) <= x1);
  }
}
