/**
 * ============================================================
 *  codec.ts — the envelope: JSON behind one door
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Encodes messages into wire strings and decodes wire strings
 *    back into VALIDATED messages. Every byte that crosses the
 *    network passes through these two functions — the "JSON-behind-
 *    a-codec protocol" ARCHITECTURE §3 names as foundational.
 *
 *  WHY A CODEC INSTEAD OF BARE JSON.parse
 *    Three jobs bare JSON cannot do:
 *      1. The version handshake: every envelope carries
 *         PROTOCOL_VERSION; a mismatch is detected before any
 *         payload is even looked at (version.ts, review B6).
 *      2. Boundary validation: the payload runs through its zod
 *         guard (guards.ts) — game code never sees an invalid shape.
 *      3. A single seam: if the wire format ever changes (binary,
 *         compression), only this file changes — "JSON-BEHIND-a-
 *         codec" means callers cannot tell what is behind it.
 *
 *  ERROR PHILOSOPHY (CODING_STANDARDS §10)
 *    A malformed message from the network is an EXPECTED failure —
 *    the internet contains liars and bit-rot — so decode() returns a
 *    typed result, never throws. The reason names what was wrong
 *    (honest failure) without echoing attacker-controlled content.
 * ============================================================
 */

import { GUARDS } from './guards.js';
import type { AnyMsg } from './messages.js';
import { PROTOCOL_VERSION } from './version.js';

/** The wire envelope: version, type, payload. The type rides outside
 *  the payload so decode can pick the right guard without trusting
 *  the payload's own claims. */
interface Envelope {
  readonly v: number;
  readonly t: string;
  readonly p: unknown;
}

export type DecodeResult =
  | { readonly ok: true; readonly message: AnyMsg }
  | { readonly ok: false; readonly reason: DecodeFailure };

export type DecodeFailure =
  | 'not-json'
  | 'not-an-envelope'
  | 'version-mismatch'
  | 'unknown-type'
  | 'invalid-payload';

/**
 * Purpose: Turn a message into its wire string.
 *
 * Inputs: message — any protocol message (compile-time checked).
 * Outputs: the envelope JSON string.
 * Side effects: none — pure function.
 * Related systems: Socket.IO transport (Phase 2) sends these
 * strings verbatim; decode() below is the only legitimate reader.
 */
export function encode(message: AnyMsg): string {
  const { type, ...payload } = message;
  const envelope: Envelope = { v: PROTOCOL_VERSION, t: type, p: payload };
  return JSON.stringify(envelope);
}

/**
 * Purpose: Turn a wire string back into a message — or a named
 * refusal. The network's customs checkpoint (the same role the
 * IntentBuffer plays for the thumb).
 *
 * The checks, in order (cheapest first, so garbage costs least):
 *   1. parseable JSON            → else 'not-json'
 *   2. envelope-shaped           → else 'not-an-envelope'
 *   3. exact version match       → else 'version-mismatch' (B6:
 *      loud and immediate, never "close enough")
 *   4. a type this protocol knows → else 'unknown-type'
 *   5. payload passes its guard  → else 'invalid-payload'
 *
 * Inputs: wire — the received string.
 * Outputs: {ok, message} or {ok: false, reason} — a typed result,
 * never a throw (expected failures are values, CODING_STANDARDS §10).
 * Side effects: none — pure function.
 */
export function decode(wire: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(wire);
  } catch {
    return { ok: false, reason: 'not-json' };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Envelope).v !== 'number' ||
    typeof (parsed as Envelope).t !== 'string' ||
    !('p' in parsed)
  ) {
    return { ok: false, reason: 'not-an-envelope' };
  }
  const envelope = parsed as Envelope;

  if (envelope.v !== PROTOCOL_VERSION) {
    return { ok: false, reason: 'version-mismatch' };
  }

  const guard = (GUARDS as Record<string, (typeof GUARDS)[keyof typeof GUARDS]>)[envelope.t];
  if (guard === undefined) {
    return { ok: false, reason: 'unknown-type' };
  }

  const candidate = { type: envelope.t, ...(envelope.p as Record<string, unknown>) };
  const result = guard.safeParse(candidate);
  if (!result.success) {
    return { ok: false, reason: 'invalid-payload' };
  }
  return { ok: true, message: result.data };
}
