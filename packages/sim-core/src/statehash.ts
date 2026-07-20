/**
 * ============================================================
 *  statehash.ts — the fingerprint: one number that is the match
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Folds a match's complete gameplay state — every player's body,
 *    lives, score, effects, plus the shared effect world — into one
 *    32-bit number. Two machines whose hashes match are, for
 *    gameplay purposes, running the same match; two whose hashes
 *    differ have desynced, and the sooner that is known the better.
 *
 *  WHY IT EXISTS (design anchor)
 *    ARCHITECTURE §2.3: beacons carry a statehash — the wire
 *    protocol already reserves the field (protocol's BeaconMsg).
 *    Live, the Phase 2 room cross-checks hashes between clients
 *    (review D3's sanity layer); post-match, the validator confirms
 *    a replay reproduced the reported hash. And today, the
 *    determinism suite uses it as the cheapest possible "identical
 *    matches?" check.
 *
 *  HOW THE FLOATS ARE HANDLED
 *    Positions and scores are floats. Our sim is bit-deterministic
 *    (same ops, same order, every machine — the whole discipline of
 *    CODING_STANDARDS §8), so floats CAN be hashed exactly — but
 *    hashing raw float bits would make the hash a liar the moment
 *    any legitimate representation nuance appears. Each float is
 *    quantized to 1/1024 world units first: far finer than any
 *    gameplay meaning, coarse enough to be honest. Integer folding
 *    from there is Math.imul — bit-exact everywhere, same reasoning
 *    as rng.ts.
 *
 *  WHAT IT MUST NEVER DO
 *    Include presentation state, wall-clock anything, or fields
 *    that differ legitimately between machines. The hash is the
 *    GAMEPLAY truth, whole and nothing else.
 * ============================================================
 */

import type { MatchPlayer } from './match.js';
import type { EffectWorld } from './effects/resolve.js';

/** FNV-1a folding step over a 32-bit lane. */
function fold(hash: number, value: number): number {
  let h = hash ^ (value | 0);
  h = Math.imul(h, 16777619);
  return h >>> 0;
}

/** Quantize a float to 1/1024 units — see the file header. */
function quantize(value: number): number {
  return Math.floor(value * 1024);
}

function foldPlayer(hash: number, mp: MatchPlayer): number {
  let h = hash;
  h = fold(h, quantize(mp.player.x));
  h = fold(h, quantize(mp.player.y));
  h = fold(h, quantize(mp.player.vy));
  h = fold(h, (mp.player.onGround ? 1 : 0) | (mp.player.isHoldingJump ? 2 : 0));
  h = fold(h, mp.player.holdTicksUsed);
  h = fold(h, mp.lives);
  h = fold(h, (mp.alive ? 1 : 0) | (mp.eliminated ? 2 : 0));
  h = fold(h, mp.respawnAtTick ?? -1);
  h = fold(h, mp.protectedUntilTick);
  h = fold(h, quantize(mp.checkpointX));
  h = fold(h, quantize(mp.score));
  h = fold(h, mp.effects.shieldActive ? 1 : 0);
  h = fold(h, mp.effects.slowUntilTick);
  h = fold(h, mp.effects.boostUntilTick);
  return h;
}

/**
 * Purpose: The match fingerprint at one tick.
 *
 * Inputs: tick — the match clock; players — all match players in
 * stable order (order matters and MUST be the construction order —
 * every machine builds players from the same match:start roster, so
 * stable order is shared order); world — the shared effect world.
 * Outputs: an unsigned 32-bit hash.
 * Side effects: none — pure function.
 * Related systems: Simulation.statehash() (the convenience),
 * protocol BeaconMsg.statehash (the wire field), the determinism
 * suite (the consumer today).
 */
export function hashMatchState(
  tick: number,
  players: readonly MatchPlayer[],
  world: EffectWorld,
): number {
  let h = 2166136261 >>> 0;
  h = fold(h, tick);
  for (const mp of players) h = foldPlayer(h, mp);
  for (const crater of world.craters) {
    h = fold(h, quantize(crater.x0));
    h = fold(h, quantize(crater.x1));
    h = fold(h, crater.healAtTick);
  }
  for (const trap of world.trapSpikes) {
    h = fold(h, quantize(trap.x));
    h = fold(h, quantize(trap.y));
    h = fold(h, trap.expiresAtTick);
  }
  return h;
}
