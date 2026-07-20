/**
 * ============================================================
 *  version.ts — the protocol version: one number, one handshake
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Declares the wire-protocol version every message envelope
 *    carries. A client and server that disagree on this number do
 *    not talk — they say so, honestly, before any match starts.
 *
 *  WHY IT EXISTS (design anchor)
 *    - Documentation review B6: simVersion gates determinism, but
 *      app-store builds lag web deploys by days — without a version
 *      handshake, the first protocol change after mobile launch
 *      breaks multiplayer silently. PROTOCOL_VERSION makes the
 *      break loud and immediate instead.
 *    - Distinct from SIM_VERSION on purpose: SIM_VERSION says "these
 *      rules produce these worlds" (generator identity); this says
 *      "these bytes mean these messages". They change for different
 *      reasons and must be bumpable independently — a retuned jump
 *      (SIM_VERSION bump) does not invalidate the wire format, and
 *      a renamed field (PROTOCOL_VERSION bump) does not change any
 *      world.
 *
 *  WHAT IT MUST NEVER DO
 *    Be compared with anything but exact equality. "Close enough"
 *    version logic is how desyncs sneak in; rooms are homogeneous
 *    (B6's proposed policy) until documentation says otherwise.
 * ============================================================
 */

/** Bump on ANY change to message shapes, names, or envelope format
 *  (CODING_STANDARDS §9: visible changes). */
export const PROTOCOL_VERSION = 1;
