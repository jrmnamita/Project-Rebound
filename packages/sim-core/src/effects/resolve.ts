/**
 * ============================================================
 *  resolve.ts — effect resolution: who is hit, what changes, when
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Owns the shared effect-world state (craters and trap spikes —
 *    global per ADR-0001), the per-player effect statuses (shield,
 *    slow, boost), the targeting rule, shield absorption, and the
 *    single resolveEffect() doorway through which every effect
 *    event — local pickup or (Phase 2) room-stamped — takes effect.
 *
 *  WHY IT EXISTS (design anchor)
 *    - ARCHITECTURE §2.3: effects are "tick-stamped, server-ordered
 *      events applied deterministically by every client's sim" and
 *      "self-contained sim modules with duration, magnitude" — the
 *      five modules beside this file are those; this file is the
 *      order in which they bite.
 *    - GDD §11.1, the Skill Supremacy Rule, testable clause by
 *      clause: telegraphed (offense lands a TELEGRAPH distance
 *      AHEAD — visible incoming), survivable (sizes derive from
 *      real jump metrics), brief (every duration is seconds —
 *      ADR-0002), counterable (the shield is resolved HERE, before
 *      any offensive module runs).
 *    - ADR-0001: the effect world is ONE world. Craters and traps
 *      live on the Simulation, not on players — everyone who
 *      reaches them, including the attacker, deals with them.
 *
 *  TARGETING (review C2's fallback chain — working default):
 *    offense → nearest rival strictly ahead → nearest strictly
 *    behind → any other living rival (stable player order) →
 *    fizzle. Solo practice therefore fizzles offense: no rival, no
 *    victim, no effect — flagged, reversible.
 *
 *  WHAT IT MUST NEVER DO
 *    Kill directly, touch score, or bypass the jump (GDD §11.1's
 *    permanent bans). Every offensive outcome here is TERRAIN or
 *    FEEL — the player's own jump remains the only thing that can
 *    save or doom them (Pillar 6).
 * ============================================================
 */

import type { MatchPlayer } from '../match.js';
import type { PickupKind, SpikeDef } from '../terrain/vocabulary.js';
import type { JumpMetrics } from '../terrain/generator.js';
import { placeCrater, type Crater } from './bomb.js';
import { placeTrap, type TrapSpike } from './spike-trap.js';
import { applyShield } from './shield.js';
import { applySlow } from './slow.js';
import { applySpeedBoost } from './speed-boost.js';

/** Per-player effect statuses, carried on MatchPlayer.effects.
 *  Zeroed values mean "no effect" — no nulls to juggle. */
export interface PlayerEffects {
  readonly shieldActive: boolean;
  readonly slowUntilTick: number;
  readonly boostUntilTick: number;
}
export const NO_EFFECTS: PlayerEffects = {
  shieldActive: false,
  slowUntilTick: 0,
  boostUntilTick: 0,
};

/** The shared effect world (ADR-0001): what offense has done to the
 *  one terrain everyone runs. Entries expire by tick (ADR-0002). */
export interface EffectWorld {
  readonly craters: readonly Crater[];
  readonly trapSpikes: readonly TrapSpike[];
}
export const EMPTY_EFFECT_WORLD: EffectWorld = { craters: [], trapSpikes: [] };

/** One effect activation, tick-stamped (ARCHITECTURE §2.3). In solo
 *  the Simulation stamps pickups itself; in Phase 2 the room stamps
 *  and broadcasts — same shape either way (protocol's effect:apply). */
export interface EffectEvent {
  readonly tick: number;
  readonly kind: PickupKind;
  readonly sourceId: string;
  readonly targetId: string;
}

/** Which kinds are offense (need a victim and respect shields) —
 *  the closed set from GDD §11.3's launch table. */
const OFFENSIVE: ReadonlySet<PickupKind> = new Set(['bomb', 'spikeTrap', 'slow']);

/** What resolveEffect needs to know about the moment of impact. */
export interface EffectContext {
  readonly tick: number;
  readonly speed: number;
  readonly metrics: JumpMetrics;
  /** Ground lookup for trap placement (traps stand on ground). */
  groundSurfaceAt(x: number): number | null;
  /** Checkpoint pads near a span — the immune zones (ADR-0002). */
  checkpointsIn(x0: number, x1: number): number[];
}

export interface ResolveOutcome {
  readonly players: ReadonlyMap<string, MatchPlayer>;
  readonly world: EffectWorld;
  readonly result: 'applied' | 'absorbed' | 'fizzled';
}

/**
 * Purpose: Choose an offensive effect's victim — the C2 fallback
 * chain (see file header).
 *
 * Inputs: sourceId — the attacker; players — all match players in
 * stable order. Outputs: the victim's id, or null (fizzle).
 * Side effects: none — pure. Deterministic: ties in distance break
 * by stable player order, so four machines agree on the victim.
 */
export function selectTarget(
  sourceId: string,
  players: ReadonlyMap<string, MatchPlayer>,
): string | null {
  const source = players.get(sourceId);
  if (source === undefined) return null;
  const rivals = [...players.values()].filter(
    (p) => p.player.id !== sourceId && p.alive && !p.eliminated,
  );
  const byGap = (candidates: MatchPlayer[]): MatchPlayer | undefined =>
    candidates.sort(
      (a, b) => Math.abs(a.player.x - source.player.x) - Math.abs(b.player.x - source.player.x),
    )[0];
  const ahead = byGap(rivals.filter((p) => p.player.x > source.player.x));
  if (ahead !== undefined) return ahead.player.id;
  const behind = byGap(rivals.filter((p) => p.player.x < source.player.x));
  if (behind !== undefined) return behind.player.id;
  const anyRival = rivals[0]; // equal-x rivals (common: auto-forward keeps x aligned)
  return anyRival === undefined ? null : anyRival.player.id;
}

/**
 * Purpose: Apply one effect event — THE doorway. Shield first, then
 * the effect's own module.
 *
 * Why shield-first is the law: GDD §11.3 — "Shield absorbs the next
 * negative effect entirely." Resolution order IS the counterplay:
 * if the target holds a shield, the offensive module never even
 * runs (no crater exists for anyone — an absorbed bomb never
 * happened, which is what "absorbs entirely" means under ADR-0001's
 * shared world).
 *
 * Inputs: event — the tick-stamped activation; players — current
 * match players; world — current effect world; ctx — the moment.
 * Outputs: new players map + new world + what happened
 * ('applied' | 'absorbed' | 'fizzled').
 * Side effects: none — pure function; the Simulation commits the
 * outcome (same replay contract as every rule module).
 */
export function resolveEffect(
  event: EffectEvent,
  players: ReadonlyMap<string, MatchPlayer>,
  world: EffectWorld,
  ctx: EffectContext,
): ResolveOutcome {
  const target = players.get(event.targetId);
  if (target === undefined || (!target.alive && OFFENSIVE.has(event.kind))) {
    return { players, world, result: 'fizzled' };
  }

  // Counterplay resolves before impact (GDD §11.3): one shield eats
  // one offensive effect, entirely, and is consumed doing it.
  if (OFFENSIVE.has(event.kind) && target.effects.shieldActive) {
    const unshielded: MatchPlayer = {
      ...target,
      effects: { ...target.effects, shieldActive: false },
    };
    return {
      players: withPlayer(players, unshielded),
      world,
      result: 'absorbed',
    };
  }

  switch (event.kind) {
    case 'shield':
      return {
        players: withPlayer(players, applyShield(target)),
        world,
        result: 'applied',
      };
    case 'speedBoost':
      return {
        players: withPlayer(players, applySpeedBoost(target, ctx.tick)),
        world,
        result: 'applied',
      };
    case 'slow':
      return {
        players: withPlayer(players, applySlow(target, ctx.tick)),
        world,
        result: 'applied',
      };
    case 'bomb': {
      const crater = placeCrater(target.player.x, ctx);
      return {
        players,
        world: { ...world, craters: [...world.craters, crater] },
        result: 'applied',
      };
    }
    case 'spikeTrap': {
      const trap = placeTrap(target.player.x, ctx);
      if (trap === null) return { players, world, result: 'fizzled' };
      return {
        players,
        world: { ...world, trapSpikes: [...world.trapSpikes, trap] },
        result: 'applied',
      };
    }
  }
}

/**
 * Purpose: Expire what time has healed — craters close, traps rust
 * away (ADR-0002: brief means brief, for terrain too).
 * Inputs: world, tick. Outputs: the surviving world (same object if
 * nothing expired — cheap no-op ticks). Pure.
 */
export function expireEffects(world: EffectWorld, tick: number): EffectWorld {
  const craters = world.craters.filter((c) => tick < c.healAtTick);
  const trapSpikes = world.trapSpikes.filter((t) => tick < t.expiresAtTick);
  if (craters.length === world.craters.length && trapSpikes.length === world.trapSpikes.length) {
    return world;
  }
  return { craters, trapSpikes };
}

/** Is x inside an active crater? Consulted by the Simulation's
 *  ground wrapper — a crater IS a gap while it lasts (GDD §11.3:
 *  "turning their easy ground into a gap they must now jump"). */
export function craterAt(world: EffectWorld, x: number): boolean {
  return world.craters.some((c) => x >= c.x0 && x <= c.x1);
}

/** Active trap spikes as plain SpikeDefs for the death check —
 *  a trap kills exactly like a generated spike ("jump it like any
 *  spike", GDD §11.3): same contact rule, same legible cause. */
export function activeTrapSpikes(world: EffectWorld): SpikeDef[] {
  return world.trapSpikes.map((t) => ({ x: t.x, y: t.y }));
}

function withPlayer(
  players: ReadonlyMap<string, MatchPlayer>,
  updated: MatchPlayer,
): ReadonlyMap<string, MatchPlayer> {
  const next = new Map(players);
  next.set(updated.player.id, updated);
  return next;
}
