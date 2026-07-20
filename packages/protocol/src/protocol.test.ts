/**
 * ============================================================
 *  protocol.test.ts — guarantees of the wire contract
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Round-trips every documented message through encode/decode,
 *    then attacks the door: malformed JSON, wrong versions, unknown
 *    types, invalid payloads, smuggled extra fields, negative
 *    scores, oversized traces — every refusal must be a typed
 *    reason, never a throw.
 *
 *  WHY IT EXISTS (design anchor)
 *    The protocol is the fairness story's front line (D3: every
 *    remote client is a potential liar). These tests are the proof
 *    that nothing unvalidated can reach game code — and that the
 *    codec's refusals are as deterministic as its acceptances.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  decode,
  encode,
  type AnyMsg,
  type WireStanding,
} from './index.js';

const standing = (playerId: string): WireStanding => ({
  playerId,
  avatar: '🐱',
  name: 'Cat',
  score: 1200,
  lives: 2,
  eliminated: false,
});

/** One representative of every message the protocol documents. */
const EXAMPLES: AnyMsg[] = [
  {
    type: 'beacon',
    playerId: 'p1',
    tick: 600,
    pos: { x: 2520, y: -14.5 },
    score: 315.2,
    lives: 3,
    statehash: 123456789,
  },
  { type: 'powerup:use', playerId: 'p1', itemId: 'p4-2' },
  {
    type: 'trace:upload',
    playerId: 'p1',
    seed: 'daily-2026-07-20',
    simVersion: 1,
    inputs: [
      { tick: 30, intents: [{ playerId: 'p1', type: 'press' }] },
      { tick: 44, intents: [{ playerId: 'p1', type: 'release' }] },
    ],
  },
  {
    type: 'match:start',
    seed: 'room-XKCD',
    simVersion: 1,
    startTick: 0,
    speedCurveId: 'draft-1',
    players: [standing('p1'), standing('p2')],
  },
  {
    type: 'beacon:rival',
    beacon: { playerId: 'p2', tick: 600, pos: { x: 2400, y: 0 }, score: 300, lives: 1, statehash: 42 },
  },
  { type: 'match:standings', tick: 600, standings: [standing('p1')] },
  { type: 'effect:apply', tick: 615, effect: 'bomb', sourceId: 'p2', targetId: 'p1' },
  { type: 'death:rival', playerId: 'p2', tick: 700, cause: 'spike' },
  { type: 'match:results', standings: [standing('p1'), standing('p2')], phaseReached: 'Very Fast' },
];

describe('Protocol — every documented message round-trips losslessly', () => {
  for (const message of EXAMPLES) {
    it(`round-trips '${message.type}'`, () => {
      const result = decode(encode(message));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.message).toEqual(message);
    });
  }
});

describe('Protocol — the door refuses politely (typed reasons, never throws)', () => {
  it('rejects non-JSON as not-json', () => {
    expect(decode('🐱 definitely not json')).toEqual({ ok: false, reason: 'not-json' });
  });

  it('rejects JSON that is not an envelope', () => {
    expect(decode('{"hello":"world"}')).toEqual({ ok: false, reason: 'not-an-envelope' });
    expect(decode('42')).toEqual({ ok: false, reason: 'not-an-envelope' });
  });

  it('rejects a version mismatch loudly — never "close enough" (review B6)', () => {
    const wire = JSON.stringify({ v: PROTOCOL_VERSION + 1, t: 'beacon', p: {} });
    expect(decode(wire)).toEqual({ ok: false, reason: 'version-mismatch' });
  });

  it('rejects unknown message types', () => {
    const wire = JSON.stringify({ v: PROTOCOL_VERSION, t: 'admin:grantScore', p: {} });
    expect(decode(wire)).toEqual({ ok: false, reason: 'unknown-type' });
  });

  it('rejects invalid payloads — a beacon missing its statehash does not pass', () => {
    const wire = JSON.stringify({
      v: PROTOCOL_VERSION,
      t: 'beacon',
      p: { playerId: 'p1', tick: 1, pos: { x: 0, y: 0 }, score: 0, lives: 3 },
    });
    expect(decode(wire)).toEqual({ ok: false, reason: 'invalid-payload' });
  });

  it('rejects smuggled extra fields — .strict() means no covert channels', () => {
    const wire = JSON.stringify({
      v: PROTOCOL_VERSION,
      t: 'powerup:use',
      p: { playerId: 'p1', itemId: 'x', adminOverride: true },
    });
    expect(decode(wire)).toEqual({ ok: false, reason: 'invalid-payload' });
  });

  it('rejects the lies the design forbids: negative scores, a fourth life, NaN positions', () => {
    const base = { playerId: 'p1', tick: 1, pos: { x: 0, y: 0 }, score: 0, lives: 3, statehash: 0 };
    for (const corruption of [
      { score: -10 }, // Pillar 9: score never decreases — negative score cannot even be SAID
      { lives: 4 }, // GDD §8.3: three lives is the ceiling
      { pos: { x: Number.NaN, y: 0 } }, // NaN is not a place
    ]) {
      const wire = JSON.stringify({ v: PROTOCOL_VERSION, t: 'beacon', p: { ...base, ...corruption } });
      expect(decode(wire)).toEqual({ ok: false, reason: 'invalid-payload' });
    }
  });

  it('rejects an oversized trace upload — the validator cannot be fed a fabricated epic', () => {
    const inputs = Array.from({ length: 20_001 }, (_, i) => ({
      tick: i,
      intents: [],
    }));
    const wire = JSON.stringify({
      v: PROTOCOL_VERSION,
      t: 'trace:upload',
      p: { playerId: 'p1', seed: 's', simVersion: 1, inputs },
    });
    expect(decode(wire)).toEqual({ ok: false, reason: 'invalid-payload' });
  });

  it('refusals are deterministic: the same bad wire yields the same reason, twice', () => {
    const bad = JSON.stringify({ v: PROTOCOL_VERSION, t: 'beacon', p: { score: -1 } });
    expect(decode(bad)).toEqual(decode(bad));
  });
});
