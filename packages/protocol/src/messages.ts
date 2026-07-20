/**
 * ============================================================
 *  messages.ts — every message the game will ever send
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines, as plain TypeScript types, the complete vocabulary of
 *    client↔server communication for live rooms. Types only — the
 *    runtime validation twin of each type lives in guards.ts, and
 *    the envelope that carries them lives in codec.ts.
 *
 *  WHY IT EXISTS (design anchor)
 *    ARCHITECTURE §2.3's live-match sequence diagram names these
 *    messages and their fields VERBATIM — match:start {seed,
 *    simVersion, startTick, speedCurveId}, beacon {tick, pos, score,
 *    lives, statehash}, powerup:use {itemId}, effect:apply {tick,
 *    effect, target}, match:standings, match:results, and the trace
 *    upload for replay validation. This file is that diagram, made
 *    compilable. Web client and game server both import THIS
 *    package, so they can never disagree about a message's shape
 *    (FOLDER_STRUCTURE §4: protocol exists so disagreement is
 *    impossible).
 *
 *  WHAT IS DELIBERATELY ABSENT (flagged, not forgotten)
 *    Room lifecycle messages (create/join/leave/countdown/rematch
 *    seat-filling) are NOT here: the documentation review found the
 *    lobby system undocumented (finding B1), and inventing a lobby
 *    wire format would be guessing policy the maintainer has not
 *    ruled. When B1 is ruled, those messages join this file with a
 *    PROTOCOL_VERSION bump. Likewise absent: desync-recovery
 *    messages (D4) and any mid-match trust extensions (D3).
 *
 *  WHAT IT MUST NEVER DO
 *    Carry behavior, platform types, or optional "flexible" blobs.
 *    A message is data with a documented meaning — an `any` field in
 *    a protocol is a hole in the fairness story.
 * ============================================================
 */

import type { DeathCause, PhaseName, PickupKind, TickInputs } from '@rebound/sim-core';

// ─────────────────────────── shared shapes ───────────────────────────

/** A player's position — the only spatial data rivals need (rival
 *  RENDERING is presentation; the sim never consumes rival beacons,
 *  because no-collision netcode means rivals cannot affect physics —
 *  ARCHITECTURE §3, "no-collision beacon netcode"). */
export interface WirePosition {
  readonly x: number;
  readonly y: number;
}

/** One row of the live standings — exactly the live board's needs
 *  (GDD §9: avatar, rank, score, lives, alive/eliminated; rank is
 *  the array index — the server orders rows, clients never re-rank,
 *  same contract the UI's LiveBoard already enforces). */
export interface WireStanding {
  readonly playerId: string;
  readonly avatar: string;
  readonly name: string;
  readonly score: number;
  readonly lives: number;
  readonly eliminated: boolean;
}

// ─────────────────────── client → server messages ───────────────────────

/**
 * The 10 Hz heartbeat every client sends (ARCHITECTURE §2.3:
 * "beacons already flow to the room at 10 Hz; they now carry score
 * and livesLeft"). statehash is the per-tick fingerprint that lets
 * the room cross-check clients live (D3's sanity layer) and the
 * validator confirm post-match.
 */
export interface BeaconMsg {
  readonly type: 'beacon';
  readonly playerId: string;
  readonly tick: number;
  readonly pos: WirePosition;
  readonly score: number;
  readonly lives: number;
  readonly statehash: number;
}

/** A power-up activation request — the room validates possession,
 *  stamps it onto a near-future tick, resolves the target, and
 *  broadcasts effect:apply (ARCHITECTURE §2.3). The client only
 *  ASKS; the room DECIDES — that order is the anti-cheat. */
export interface PowerupUseMsg {
  readonly type: 'powerup:use';
  readonly playerId: string;
  readonly itemId: string;
}

/** The post-match trace upload: everything the validator needs to
 *  replay the run — (seed, own inputs, room event log) per
 *  ARCHITECTURE §2.3's "replay validation covers them for free". */
export interface TraceUploadMsg {
  readonly type: 'trace:upload';
  readonly playerId: string;
  readonly seed: string;
  readonly simVersion: number;
  readonly inputs: ReadonlyArray<{ readonly tick: number; readonly intents: TickInputs }>;
}

// ─────────────────────── server → client messages ───────────────────────

/** The match's birth certificate — everything a deterministic sim
 *  needs to construct an identical world (ARCHITECTURE §2.3's
 *  match:start, field for field). */
export interface MatchStartMsg {
  readonly type: 'match:start';
  readonly seed: string;
  readonly simVersion: number;
  readonly startTick: number;
  readonly speedCurveId: string;
  readonly players: readonly WireStanding[];
}

/** A rival's beacon, relayed — same shape as sent; the relay adds
 *  nothing because there is nothing to add. */
export interface RivalBeaconMsg {
  readonly type: 'beacon:rival';
  readonly beacon: Omit<BeaconMsg, 'type'>;
}

/** The live board update — ~2 Hz plus instantly on rank swaps,
 *  deaths, and eliminations (ARCHITECTURE §2.3: rank-change moments
 *  are the excitement, so they are event-driven, not polled). */
export interface StandingsMsg {
  readonly type: 'match:standings';
  readonly tick: number;
  readonly standings: readonly WireStanding[];
}

/** A tick-stamped effect every sim applies at exactly effect.tick —
 *  the mechanism that makes power-ups deterministic across four
 *  machines (ARCHITECTURE §2.3). Effect SEMANTICS live in the
 *  Effects module (sim-core); this message only carries identity. */
export interface EffectApplyMsg {
  readonly type: 'effect:apply';
  readonly tick: number;
  readonly effect: PickupKind;
  readonly sourceId: string;
  readonly targetId: string;
}

/** A death notice for presentation on rival screens (the sim needs
 *  no telling — it computes deaths itself; this drives the board
 *  flash and spectator drama, GDD §9). */
export interface RivalDeathMsg {
  readonly type: 'death:rival';
  readonly playerId: string;
  readonly tick: number;
  readonly cause: DeathCause;
}

/** The final standings (GDD §8.1's verdict, server-resolved —
 *  winner-resolution POLICY awaits the A8/C1 ruling; the message
 *  shape does not depend on it). */
export interface MatchResultsMsg {
  readonly type: 'match:results';
  readonly standings: readonly WireStanding[];
  readonly phaseReached: PhaseName;
}

// ─────────────────────────────── unions ───────────────────────────────

export type ClientMsg = BeaconMsg | PowerupUseMsg | TraceUploadMsg;
export type ServerMsg =
  | MatchStartMsg
  | RivalBeaconMsg
  | StandingsMsg
  | EffectApplyMsg
  | RivalDeathMsg
  | MatchResultsMsg;
export type AnyMsg = ClientMsg | ServerMsg;
export type MsgType = AnyMsg['type'];
