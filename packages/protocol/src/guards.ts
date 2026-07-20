/**
 * ============================================================
 *  guards.ts — runtime validation: trust nothing off the wire
 * ============================================================
 *  WHAT THIS FILE DOES
 *    A zod schema for every message in messages.ts — the runtime
 *    twin of each compile-time type. The codec runs incoming bytes
 *    through these before any game code sees them.
 *
 *  WHY IT EXISTS (design anchor)
 *    - ARCHITECTURE §3 names "zod boundary validation" a foundational
 *      unchanged decision. The network is THE boundary: every remote
 *      client is a potential liar (D3), and TypeScript types
 *      evaporate at runtime — zod is what remains.
 *    - CODING_STANDARDS §10: "validate at boundaries, trust inside."
 *      Past decode(), game code trusts message shapes completely;
 *      that trust is purchased HERE.
 *    - Every schema is .strict(): unknown extra fields are REJECTED,
 *      not ignored — a field the protocol does not document cannot
 *      ride along as a covert channel.
 *
 *  WHAT IT MUST NEVER DO
 *    Drift from messages.ts. Each schema declares its message type
 *    via z.ZodType<T>, so drift is a compile error, not a runtime
 *    surprise — the twin files are chained together by the compiler.
 * ============================================================
 */

import { z } from 'zod';
import type {
  AnyMsg,
  BeaconMsg,
  EffectApplyMsg,
  MatchResultsMsg,
  MatchStartMsg,
  PowerupUseMsg,
  RivalBeaconMsg,
  RivalDeathMsg,
  StandingsMsg,
  TraceUploadMsg,
} from './messages.js';

/** Finite number: NaN/Infinity off the wire are lies, not numbers. */
const finite = z.number().finite();
/** Bounded id strings: unbounded strings are a memory attack. */
const id = z.string().min(1).max(64);

const wirePosition = z.object({ x: finite, y: finite }).strict();

const wireStanding = z
  .object({
    playerId: id,
    avatar: z.string().min(1).max(8), // an emoji, not an essay (ARCH §2.5)
    name: z.string().min(1).max(24),
    score: finite.nonnegative(), // Pillar 9 on the wire: no negative scores exist
    lives: z.number().int().min(0).max(3), // GDD §8.3's 3-life ceiling
    eliminated: z.boolean(),
  })
  .strict();

const pickupKind = z.enum(['bomb', 'spikeTrap', 'slow', 'shield', 'speedBoost']);
const deathCause = z.enum(['fall', 'spike', 'hazard']);
const phaseName = z.enum(['Normal', 'Faster', 'Very Fast', 'Extreme Survival']);

const beaconFields = {
  playerId: id,
  tick: z.number().int().nonnegative(),
  pos: wirePosition,
  score: finite.nonnegative(),
  lives: z.number().int().min(0).max(3),
  statehash: z.number().int(),
};

export const beaconMsg: z.ZodType<BeaconMsg> = z
  .object({ type: z.literal('beacon'), ...beaconFields })
  .strict();

export const powerupUseMsg: z.ZodType<PowerupUseMsg> = z
  .object({ type: z.literal('powerup:use'), playerId: id, itemId: id })
  .strict();

export const traceUploadMsg: z.ZodType<TraceUploadMsg> = z
  .object({
    type: z.literal('trace:upload'),
    playerId: id,
    seed: z.string().min(1).max(128),
    simVersion: z.number().int().positive(),
    inputs: z
      .array(
        z
          .object({
            tick: z.number().int().nonnegative(),
            intents: z.array(
              z.object({ playerId: id, type: z.enum(['press', 'release']) }).strict(),
            ),
          })
          .strict(),
      )
      // Trace size bound: ~20 min of maximum humanly-possible input
      // (input.ts's flood cap) — a gigabyte "match" for the validator
      // is rejected at the door (ARCHITECTURE: anti-cheat layers).
      .max(20_000),
  })
  .strict();

export const matchStartMsg: z.ZodType<MatchStartMsg> = z
  .object({
    type: z.literal('match:start'),
    seed: z.string().min(1).max(128),
    simVersion: z.number().int().positive(),
    startTick: z.number().int().nonnegative(),
    speedCurveId: z.string().min(1).max(64),
    players: z.array(wireStanding).min(1).max(4), // GDD §9: rooms of up to 4
  })
  .strict();

export const rivalBeaconMsg: z.ZodType<RivalBeaconMsg> = z
  .object({ type: z.literal('beacon:rival'), beacon: z.object(beaconFields).strict() })
  .strict();

export const standingsMsg: z.ZodType<StandingsMsg> = z
  .object({
    type: z.literal('match:standings'),
    tick: z.number().int().nonnegative(),
    standings: z.array(wireStanding).min(1).max(4),
  })
  .strict();

export const effectApplyMsg: z.ZodType<EffectApplyMsg> = z
  .object({
    type: z.literal('effect:apply'),
    tick: z.number().int().nonnegative(),
    effect: pickupKind,
    sourceId: id,
    targetId: id,
  })
  .strict();

export const rivalDeathMsg: z.ZodType<RivalDeathMsg> = z
  .object({
    type: z.literal('death:rival'),
    playerId: id,
    tick: z.number().int().nonnegative(),
    cause: deathCause,
  })
  .strict();

export const matchResultsMsg: z.ZodType<MatchResultsMsg> = z
  .object({
    type: z.literal('match:results'),
    standings: z.array(wireStanding).min(1).max(4),
    phaseReached: phaseName,
  })
  .strict();

/** The dispatch table the codec uses: message type → its guard.
 *  Adding a message = one type, one schema, one row here — and a
 *  PROTOCOL_VERSION bump (version.ts). */
export const GUARDS: Record<AnyMsg['type'], z.ZodType<AnyMsg>> = {
  beacon: beaconMsg as z.ZodType<AnyMsg>,
  'powerup:use': powerupUseMsg as z.ZodType<AnyMsg>,
  'trace:upload': traceUploadMsg as z.ZodType<AnyMsg>,
  'match:start': matchStartMsg as z.ZodType<AnyMsg>,
  'beacon:rival': rivalBeaconMsg as z.ZodType<AnyMsg>,
  'match:standings': standingsMsg as z.ZodType<AnyMsg>,
  'effect:apply': effectApplyMsg as z.ZodType<AnyMsg>,
  'death:rival': rivalDeathMsg as z.ZodType<AnyMsg>,
  'match:results': matchResultsMsg as z.ZodType<AnyMsg>,
};
