/**
 * ============================================================
 *  vocabulary.ts — the terrain vocabulary: what a world is made of
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines, as plain data types, every element the world can be
 *    built from: ground (flats and slopes), floating platforms,
 *    spikes, hazard zones, pickups, and checkpoints. No behavior
 *    lives here — this file is the game's vocabulary, other modules
 *    write the sentences (the Procedural module composes these into
 *    chunks; Physics resolves collisions against them; the renderer
 *    draws them).
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §6.2 defines the terrain vocabulary table verbatim: flat
 *      ground (breathing room), slopes & hills (flow), small gaps
 *      (timing checks), large gaps (commitment checks), floating
 *      platforms (optional high route), spikes (lethal punctuation),
 *      hazard zones (marked stretches that demand a plan).
 *    - GDD §13 says the vocabulary EVOLVES (new elements, biomes) —
 *      which is why it gets its own file: adding an element means
 *      adding a type here and teaching the generator/renderer about
 *      it, without touching chunk plumbing or queries.
 *    - GDD §8.4: checkpoints are woven into terrain — so they are
 *      terrain data, not match logic.
 *    - GDD §11.2: pickups are "placed in the terrain — same
 *      locations for every player" — so pickup POSITIONS are terrain
 *      data too (what a power-up DOES is the Effects module's
 *      business, not this file's).
 *
 *  HOW IT FITS
 *    chunk.ts groups these into fixed-length chunks; queries.ts
 *    answers questions about them; the Procedural module (later)
 *    decides where they go, deterministically from the seed.
 *
 *  WHAT IT MUST NEVER DO
 *    Contain behavior, randomness, or rendering hints beyond pure
 *    geometry. Notably: slopes are stored as two ENDPOINTS, never as
 *    an angle — endpoint interpolation needs only +, −, ×, ÷ (all
 *    bit-exact across JS engines), while angles would drag in
 *    Math.sin/cos, which are banned inside the determinism boundary
 *    (CODING_STANDARDS §8: engine-variant math).
 * ============================================================
 */

/**
 * Purpose: One straight piece of walkable ground surface, from
 * (x0, y0) to (x1, y1) in world units (y grows downward).
 *
 * Why it exists: every ground shape in GDD §6.2 is built from this
 * one primitive — a flat is a segment with y0 === y1, a slope has
 * y0 !== y1, a hill is an up-slope followed by a down-slope, and a
 * GAP is simply the absence of any segment over a span of x. Storing
 * "what exists" and treating holes as nothing keeps gap logic
 * unfakeable: there is no ground object to collide with, so there is
 * nothing to stand on — falling is the default truth of the world
 * (GDD §3: "the world got you").
 *
 * Related systems: queries.ts interpolates player ground height
 * along these; Physics lands players on them; the renderer draws
 * them as the world's silhouette.
 */
export interface GroundSegment {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * Purpose: A floating platform — a flat, one-way landing surface
 * hovering above the ground line.
 *
 * Why it exists: GDD §6.2 — "Floating platforms: optional high
 * route; risk/reward positioning." They are stored flat (constant y)
 * because the document gives platforms exactly one job: a landable
 * high route. Sloped platforms are not in the vocabulary; if the
 * design ever wants them, GDD §13 says the vocabulary may evolve —
 * that would be a new type, a doc change, and a generator change,
 * together.
 *
 * "One-way" (land from above, pass from below) is a collision RULE,
 * so it lives in the Physics module — this type only records where
 * the surface is.
 */
export interface PlatformDef {
  readonly x0: number;
  readonly x1: number;
  /** The landing surface's height (y grows downward). */
  readonly y: number;
}

/**
 * Purpose: One spike — a small, precisely placed, lethal-to-touch
 * hazard sitting on a surface.
 *
 * Why it exists: GDD §6.2 — "Spikes: precise, small, lethal-to-touch
 * punctuation." The position marks the spike's BASE CENTER on its
 * surface; its fixed footprint lives in SPIKE geometry below.
 * Spikes do not move: the prototype's "moving spikes" are not in the
 * documented vocabulary and were flagged in the 2026-07-20 audit —
 * there is deliberately no velocity field to reintroduce them by
 * accident.
 */
export interface SpikeDef {
  /** Base center x, world units. */
  readonly x: number;
  /** Surface y the spike stands on (tip points up: tip y = y − SPIKE.HEIGHT). */
  readonly y: number;
}

/**
 * Purpose: Fixed spike geometry shared by collision (Physics) and
 * rendering — one truth for how big "small and lethal" is.
 *
 * Why it exists: if collision and art disagreed about a spike's
 * size, deaths would look unfair — and "never a death that feels
 * stolen" is the emotional core (GDD §5.1). DRAFT values, playtest-
 * owned; changes are feel changes (SIM_VERSION bump once it exists).
 * Not in constants.ts yet for the same reason as player.ts's JUMP:
 * constants.ts belongs to the Utilities module (maintainer order).
 */
export const SPIKE = {
  HALF_WIDTH: 18,
  HEIGHT: 34,
} as const;

/**
 * Purpose: A hazard zone — a marked stretch of ground that is deadly
 * to touch for its whole length.
 *
 * Why it exists: GDD §6.2 — "Hazard zones: marked stretches that
 * demand a plan (clear or avoid), not a reflex." A spike asks for a
 * well-timed tap; a hazard zone asks the player to READ ahead and
 * commit — a full-hold clear, or a platform route above. The type is
 * just the marked span; the guarantee that a survivable plan always
 * exists (a clearable length or a platform route) is the Procedural
 * module's construction duty, per §6.2's "every challenge must be
 * survivable on sight."
 */
export interface HazardZoneDef {
  readonly x0: number;
  readonly x1: number;
}

/**
 * Purpose: The five launch power-up identities — as names only.
 *
 * Why it exists: pickups placed in terrain must say what they
 * contain (GDD §11.3 launch set), but what each power-up DOES is the
 * Effects module's responsibility. Terrain knows names, not effects
 * — the same one-way split as platforms (data here, rules
 * elsewhere). Canonical spellings per CODING_STANDARDS §1; 'slow'
 * and 'speedBoost' carry naming caveats pending the documentation
 * review's A7/F2 terminology rulings.
 */
export type PickupKind = 'bomb' | 'spikeTrap' | 'slow' | 'shield' | 'speedBoost';

/**
 * Purpose: One power-up crate placed in the terrain.
 *
 * Why it exists: GDD §11.2 — pickups are terrain content, "same
 * locations for every player, woven into risk/reward routes." Being
 * chunk data means every client and the Phase 2 validator agree on
 * pickup positions with zero messages (ARCHITECTURE §2.3: "spawning
 * is deterministic"). The id is unique within a match so the Match/
 * Effects modules can record "already collected" compactly.
 */
export interface PickupDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly kind: PickupKind;
}
