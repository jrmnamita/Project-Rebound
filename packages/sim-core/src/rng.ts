/**
 * ============================================================
 *  rng.ts — seeded randomness: the only dice the simulation owns
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Provides deterministic pseudo-randomness: a string hash to turn
 *    seeds into numbers, a tiny PRNG (mulberry32) that produces the
 *    same sequence from the same seed on every machine forever, and
 *    small helpers (range, chance, weighted pick) so consumers never
 *    hand-roll distribution math.
 *
 *  WHY IT EXISTS (design anchor)
 *    - AI_CONTEXT Working Rule 7 / CODING_STANDARDS §8: "no unseeded
 *      randomness in the simulation" — Math.random is BANNED inside
 *      sim-core. This file is the replacement: randomness that four
 *      players and a validator can all reproduce bit-for-bit.
 *    - ARCHITECTURE §2.2: world content derives from
 *      (seed, chunkIdx, simVersion). chunkRng() below is exactly
 *      that identity, turned into a stream of numbers.
 *    - GDD §12.7 (absolute fairness): a "random" world is fair only
 *      if it is the SAME random world for everyone. Seeded
 *      randomness is how surprise and fairness coexist.
 *
 *  HOW IT FITS
 *    The Procedural generator consumes chunkRng() to lay out
 *    terrain. Phase 2's daily challenge is just a shared seed. The
 *    prototype's fatal flaw — unseeded Math.random() in generation,
 *    making every run unshareable and unverifiable (2026-07-20
 *    audit) — is what this file exists to make impossible.
 *
 *  WHAT IT MUST NEVER DO
 *    Read clocks, entropy sources, or Math.random. Everything here
 *    is integer arithmetic and bit operations — chosen precisely
 *    because they are bit-exact in every JavaScript engine
 *    (the banned Math.sin/cos/pow are not; CODING_STANDARDS §8).
 * ============================================================
 */

/**
 * Purpose: Turn any string (a seed, a chunk identity) into a 32-bit
 * unsigned integer, deterministically.
 *
 * Why it exists: PRNGs eat numbers, but seeds are human-friendly
 * strings ("daily-2026-07-20", a room code). This is the FNV-1a
 * hash — small, fast, well-distributed, and built from XOR and
 * integer multiplication only, so every engine computes the same
 * value.
 *
 * Inputs: text — any string.
 * Outputs: an unsigned 32-bit integer; same text, same number,
 * everywhere, always.
 * Side effects: none — pure function.
 */
export function hashString(text: string): number {
  let hash = 2166136261 >>> 0; // FNV offset basis
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime, in exact int32 math
  }
  return hash >>> 0;
}

/**
 * Purpose: A stream of pseudo-random numbers in [0, 1) — the
 * simulation's dice.
 *
 * Why this type is a function: calling it advances the stream; the
 * closure holds the state. Consumers thread ONE Rng through a whole
 * generation task so the sequence — and therefore the world — is
 * fully determined by the seed.
 */
export type Rng = () => number;

/**
 * Purpose: Create a deterministic PRNG from a numeric seed
 * (mulberry32).
 *
 * Why mulberry32: it is 32-bit integer arithmetic end to end
 * (Math.imul, shifts, XOR — all bit-exact across engines), passes
 * standard statistical tests, and is small enough to read and
 * understand in one sitting — which matters in a codebase that
 * teaches (CODING_STANDARDS Meta-Rule 2). Cryptographic strength is
 * explicitly NOT a goal: seeds are shared openly (that is the whole
 * point); we need reproducibility, not secrecy.
 *
 * Inputs: seed — any 32-bit integer (from hashString).
 * Outputs: an Rng producing the same sequence for the same seed.
 * Side effects: none at creation; the returned function mutates only
 * its own closed-over state.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Purpose: The dice for one specific chunk of one specific world —
 * the (seed, chunkIdx, simVersion) identity from ARCHITECTURE §2.2,
 * as a random stream.
 *
 * Why simVersion is part of the identity: when the simulation's
 * rules change (a tunable retune, a new terrain element), old seeds
 * must not silently mean new worlds — bumping SIM_VERSION gives
 * changed rules a changed universe, so replays and ghosts never lie
 * (CODING_STANDARDS §9: feel changes are visible changes).
 *
 * Inputs: seed — the world's seed string; chunkIdx — which chunk;
 * simVersion — the simulation rules version.
 * Outputs: an Rng unique to that triple. Chunks are therefore
 * independently generatable — machine A can generate chunk 40
 * without generating 0..39 and get bit-identical content to
 * machine B.
 * Side effects: none — pure factory.
 */
export function chunkRng(seed: string, chunkIdx: number, simVersion: number): Rng {
  return mulberry32(hashString(`${seed}:${chunkIdx}:${simVersion}`));
}

/**
 * Purpose: Distribution helpers — the vocabulary generators actually
 * speak (a length in a range, a 30% chance, a weighted choice).
 *
 * Why they exist: hand-rolled `min + rng() * span` math scattered
 * through the generator would invite off-by-one and inclusive/
 * exclusive bugs that DESYNC WORLDS. One audited implementation,
 * used everywhere.
 *
 * Inputs/Outputs: each consumes draws from the given Rng (advancing
 * it — that is the point) and returns the described value.
 * Side effects: advances the Rng stream; nothing else.
 */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}
export function rangeInt(rng: Rng, min: number, max: number): number {
  // Inclusive on both ends — the natural reading of "an int from 1 to 3".
  return min + Math.floor(rng() * (max - min + 1));
}
export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}
export function pickWeighted<T>(rng: Rng, entries: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = rng() * total;
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll < 0) return item;
  }
  // Floating-point edge (roll ≈ total): the last entry is the answer.
  const last = entries[entries.length - 1];
  if (last === undefined) throw new Error('pickWeighted: empty entries');
  return last[0];
}
