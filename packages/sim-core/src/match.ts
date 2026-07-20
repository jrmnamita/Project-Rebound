/**
 * ============================================================
 *  match.ts — the match grammar: lives, checkpoints, score
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines what a player IS within a match (MatchPlayer: the
 *    physical body plus lives, score, checkpoint, protection) and
 *    the pure rules that change that state: dying, respawning,
 *    scoring, and touching deadly things. The Simulation (sim.ts)
 *    sequences these rules; this file IS the rules.
 *
 *  WHY IT EXISTS (design anchor — GDD §8, clause by clause)
 *    - §8.3: 3 lives; death consumes one; respawn at the latest
 *      checkpoint after a brief pause with a spawn-protection window
 *      (immune to hazards, cannot gain score); score fully retained;
 *      third death = elimination to spectator.
 *    - §8.2 / Pillar 9: score increases continuously while alive,
 *      driven by survival distance, and is NEVER lost. Here that is
 *      structural: no function in this file subtracts from score —
 *      the operation does not exist.
 *    - §8.4: respawn placement is the checkpoint (safe by generator
 *      construction); checkpoints never slow the clock — respawning
 *      players re-enter at the match's CURRENT speed because speed
 *      comes from curve.ts, which does not know they died.
 *    - §12 Pillar 6: "Nothing kills a player except terrain they
 *      failed to clear" — the only death causes are fall, spike,
 *      and hazard (events.ts DeathCause is a closed set).
 *
 *  FLAGGED WORKING DEFAULTS (open ruling C5 — spawn protection
 *  scope; see docs/reviews/2026-07-20-documentation-review.md):
 *    - Falls kill even while protected: §8.3's immunity names
 *      "hazards and rival effects"; a gap is neither — and a
 *      checkpoint pad is flat by construction, so only deliberate
 *      play can reach a gap while protected.
 *    - Pickups ARE collectible while protected (nothing forbids it;
 *      flagged as exploit-adjacent in the review — a maintainer
 *      ruling may reverse this single line).
 *
 *  WHAT IT MUST NEVER DO
 *    Reduce a score, invent a fourth death cause, or reach into
 *    physics/terrain internals — it consumes their outputs.
 * ============================================================
 */

import { createPlayer, land, type PlayerState } from './player.js';
import { PHYSICS } from './physics.js';
import { SPIKE, type SpikeDef } from './terrain/vocabulary.js';
import { NO_EFFECTS, type PlayerEffects } from './effects/resolve.js';
import { scoreRateFor } from './effects/speed-boost.js';

/**
 * Purpose: Draft match tunables — the numbers behind GDD §8.3's
 * words ("brief pause", "short protection window").
 * DRAFT, playtest-owned; migrate to constants.ts with the Utilities
 * module; changes bump SIM_VERSION (CODING_STANDARDS §9).
 */
export const MATCH = {
  /** GDD §8.3: "Every player enters a match with 3 lives." Not a
   *  tunable in spirit — the number is documented — but named here
   *  so no bare 3 floats in logic. */
  LIVES: 3,
  /** The "brief pause" before a respawn: 45 ticks = 0.75 s — long
   *  enough to register the death, short enough for "one more
   *  game" energy (GDD §5.2). */
  RESPAWN_DELAY_TICKS: 45,
  /** The spawn-protection window: 150 ticks = 2.5 s (C5 default). */
  SPAWN_PROTECTION_TICKS: 150,
  /** Below this y (y grows down), a fall is a death. Comfortably
   *  beneath GENERATION.MAX_Y so no legal terrain approaches it. */
  KILL_PLANE_Y: 520,
  /** Score per world unit survived — §8.2: driven by survival
   *  distance. At base speed ≈ 12.6 points/second. */
  SCORE_PER_UNIT: 0.05,
} as const;

/**
 * Purpose: One player's complete match state — the body (PlayerState)
 * wrapped in the match's bookkeeping.
 *
 * Why composition, not extension: player.ts owns the body and knows
 * nothing about lives — exactly the seam promised when Player was
 * built. Everything here is readonly; rules below return new states
 * (the same replay contract as the player module).
 */
export interface MatchPlayer {
  readonly player: PlayerState;
  readonly lives: number;
  readonly alive: boolean;
  readonly eliminated: boolean;
  /** Tick at which a pending respawn happens; null when not dead-
   *  and-waiting. */
  readonly respawnAtTick: number | null;
  /** Protection lasts through this tick (0 = never protected). */
  readonly protectedUntilTick: number;
  /** The latest checkpoint passed — the respawn target (§8.3/8.4). */
  readonly checkpointX: number;
  readonly score: number;
  /** Active effect statuses (Effects module — effects/resolve.ts).
   *  Shared-world effects (craters, traps) live on the Simulation
   *  instead, per ADR-0001. */
  readonly effects: PlayerEffects;
}

/** Purpose: a fresh entrant at the spawn line (§8.3: 3 lives). */
export function createMatchPlayer(id: string, spawnX: number, groundY: number): MatchPlayer {
  return {
    player: land(createPlayer(id, spawnX, 0), groundY - PHYSICS.PLAYER_RADIUS),
    lives: MATCH.LIVES,
    alive: true,
    eliminated: false,
    respawnAtTick: null,
    protectedUntilTick: 0,
    checkpointX: spawnX,
    score: 0,
    effects: NO_EFFECTS,
  };
}

/** Purpose: is this player inside their protection window now? */
export function isProtected(mp: MatchPlayer, tick: number): boolean {
  return tick <= mp.protectedUntilTick;
}

/**
 * Purpose: The spike-contact rule — did the body touch lethal
 * punctuation?
 *
 * Why this shape: a spike kills by TOUCH (GDD §6.2), so contact is
 * the ball circle against the spike's occupied box (tip at
 * y − HEIGHT, base HALF_WIDTH each side), tested as center-distance
 * with the ball's radius — readable, cheap, and slightly forgiving
 * at the triangle's corners, which errs toward the player (a death
 * that looks marginal must BE marginal — GDD §5.1).
 *
 * Inputs: player — the body; spikes — nearby spikes (the caller
 * pre-filters by range). Outputs: true on contact. Pure.
 */
export function touchesSpike(player: PlayerState, spikes: readonly SpikeDef[]): boolean {
  for (const spike of spikes) {
    const centerX = spike.x;
    const centerY = spike.y - SPIKE.HEIGHT / 2;
    const dx = player.x - centerX;
    const dy = player.y - centerY;
    const reach = PHYSICS.PLAYER_RADIUS + SPIKE.HALF_WIDTH * 0.8;
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}

/**
 * Purpose: Apply a death — one life gone, body inert, respawn
 * scheduled or elimination declared.
 *
 * The rules in order (all §8.3): lives decrease by exactly one;
 * score is UNTOUCHED (Pillar 9 — note the field is simply copied);
 * with lives remaining, a respawn is scheduled after the brief
 * pause; on the third death the player is eliminated — in
 * multiplayer they become a spectator; in solo the match ends
 * (sim.ts decides that consequence, not this rule).
 *
 * Inputs: mp — the player; tick — when death occurred.
 * Outputs: the next MatchPlayer. Pure.
 */
export function applyDeath(mp: MatchPlayer, tick: number): MatchPlayer {
  const lives = mp.lives - 1;
  const eliminated = lives <= 0;
  return {
    ...mp,
    lives,
    alive: false,
    eliminated,
    respawnAtTick: eliminated ? null : tick + MATCH.RESPAWN_DELAY_TICKS,
    // score: deliberately not mentioned — it rides along unchanged.
  };
}

/**
 * Purpose: Apply a respawn — back to the latest checkpoint, grounded,
 * protected, at the match's CURRENT pressure.
 *
 * Why the body is rebuilt with land(): a respawn is a fresh grounded
 * stance (jump re-armed, no stale hold) at the checkpoint, on ground
 * whose height the caller reads from the terrain — safe by
 * construction (§8.4). Protection starts here and lasts
 * SPAWN_PROTECTION_TICKS: "respawning never chains into an instant
 * second death" (§8.3). Nothing here touches the clock or the score.
 *
 * Inputs: mp — the dead-and-waiting player; tick — now; groundY —
 * terrain surface at the checkpoint. Outputs: the living player. Pure.
 */
export function applyRespawn(mp: MatchPlayer, tick: number, groundY: number): MatchPlayer {
  return {
    ...mp,
    player: land(
      createPlayer(mp.player.id, mp.checkpointX, 0),
      groundY - PHYSICS.PLAYER_RADIUS,
    ),
    alive: true,
    respawnAtTick: null,
    protectedUntilTick: tick + MATCH.SPAWN_PROTECTION_TICKS,
    // Death wipes active effect statuses — a respawn is a clean
    // stance, and a Slow that outlived its victim would punish the
    // respawn §8.3's protection exists to protect. Flagged working
    // default (review C3-adjacent); shared-world craters/traps are
    // NOT cleared — the world's scars heal on their own clock
    // (ADR-0001/0002).
    effects: NO_EFFECTS,
  };
}

/**
 * Purpose: One tick of score — survival distance converted to
 * points, unless dead or protected.
 *
 * Why the guard: §8.2 accrues score "while alive"; §8.3's protection
 * "cannot gain score". The increment is speed × rate × modifier — a
 * pure function of survived distance and deterministic modifiers
 * (§8.2 as amended per review A7: the Speed Boost's score-rate
 * surge is the one modifier today, effects/speed-boost.ts), so the
 * post-match validator can recompute it from the replay exactly.
 * There is no code path that lowers the number (Pillar 9).
 *
 * Inputs: mp; tick; speed — this tick's curve speed.
 * Outputs: the next MatchPlayer (same object when nothing accrues). Pure.
 */
export function accrueScore(mp: MatchPlayer, tick: number, speed: number): MatchPlayer {
  if (!mp.alive || isProtected(mp, tick)) return mp;
  return { ...mp, score: mp.score + speed * MATCH.SCORE_PER_UNIT * scoreRateFor(mp, tick) };
}
