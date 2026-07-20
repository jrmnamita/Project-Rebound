/**
 * ============================================================
 *  index.ts — the public surface of @rebound/protocol
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Re-exports the wire contract: message types, the codec, the
 *    guards (for callers that validate piecemeal, e.g. the Phase 2
 *    server's per-socket handlers), and the protocol version.
 *
 *  WHY IT EXISTS (design anchor)
 *    CODING_STANDARDS §7/§8: a package's public surface is its
 *    index.ts; consumers (web client and game server) import
 *    '@rebound/protocol', never deep paths.
 * ============================================================
 */

export { PROTOCOL_VERSION } from './version.js';
export { decode, encode, type DecodeFailure, type DecodeResult } from './codec.js';
export { GUARDS } from './guards.js';
export type {
  AnyMsg,
  BeaconMsg,
  ClientMsg,
  EffectApplyMsg,
  MatchResultsMsg,
  MatchStartMsg,
  MsgType,
  PowerupUseMsg,
  RivalBeaconMsg,
  RivalDeathMsg,
  ServerMsg,
  StandingsMsg,
  TraceUploadMsg,
  WirePosition,
  WireStanding,
} from './messages.js';
