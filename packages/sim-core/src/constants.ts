/**
 * ============================================================
 *  constants.ts — the shared constants: a leaf everyone may import
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Owns the constants that belong to no single rule module: the
 *    simulation version stamp, the tick rate, and the checkpoint
 *    immunity radius. It imports NOTHING — a leaf of the dependency
 *    graph, so any module (generator, effects, replay) may import
 *    it without ever creating a cycle (CODING_STANDARDS §8: no
 *    circular imports, lint-law).
 *
 *  WHY THE TUNABLE GROUPS ARE NOT PHYSICALLY HERE
 *    FOLDER_STRUCTURE names this file "all gameplay tunables +
 *    SIM_VERSION". A DELIBERATE INTERPRETATION, recorded here: the
 *    tunable groups stay DEFINED beside the rules they tune —
 *    the educational mandate (CODING_STANDARDS Meta-Rule 2) wants a
 *    number's meaning taught next to its rule, and a re-export
 *    registry here would wire this file into cycles with its own
 *    importers. So this file owns the SHARED constants and serves
 *    as the INDEX to the rest:
 *      JUMP  → player.ts        (jump feel)
 *      PHYSICS → physics.ts     (gravity, body, terminal fall)
 *      MATCH → match.ts         (lives, respawn, protection, score)
 *      SPIKE → terrain/vocabulary.ts (spike geometry)
 *      CHUNK_LENGTH → terrain/chunk.ts (world paging)
 *      GENERATION → terrain/generator.ts (pacing, bounds, margins)
 *      CURVE_DRAFT_1 → curve.ts (the speed curve)
 *      BOMB / TRAP / SLOW / BOOST → effects/* (effect tunables)
 *      CAMERA → apps/web (presentation — deliberately not sim)
 *
 *  WHAT IT MUST NEVER DO
 *    Import anything, hold logic, or hold presentation values.
 * ============================================================
 */

/**
 * Purpose: The simulation rules version — the third leg of the
 * (seed, chunkIdx, simVersion) world identity (ARCHITECTURE §2.2)
 * and the compatibility stamp on every trace and beacon.
 *
 * Why it lives HERE (moved from terrain/generator.ts, closing that
 * file's migration note): the version stamps the WHOLE rule set —
 * jump feel, match grammar, effects, generation — not just the
 * generator. BUMP THIS on any change that alters simulation
 * behavior or generated worlds (CODING_STANDARDS §9): old seeds
 * must never silently mean new worlds, and old traces must refuse
 * to replay under new rules (replay.ts enforces exactly that).
 */
export const SIM_VERSION = 1;

/** Simulation ticks per second — ARCHITECTURE §3's fixed timestep.
 *  The sim itself never reads a clock; this constant exists for
 *  DRIVERS (the GameHost's accumulator) and for documentation. */
export const TICK_RATE = 60;

/**
 * Purpose: Half the checkpoint safe pad — the immunity radius that
 * placed effects must respect (ADR-0002), and half the flat opening
 * the generator builds into every chunk (GDD §8.4).
 *
 * Why a literal rather than a derivation: deriving it from
 * GENERATION would make this file import the generator — and the
 * generator imports this file for SIM_VERSION, which would be a
 * cycle. The equality with GENERATION.SAFE_PAD_LENGTH / 2 is
 * guarded by a test instead (utilities.test.ts): if the pad ever
 * changes, the test fails and both numbers move together.
 */
export const SAFE_PAD_HALF = 180;
