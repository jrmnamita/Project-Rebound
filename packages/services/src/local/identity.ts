/**
 * ============================================================
 *  identity.ts — the anonymous identity: a name without a form
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Implements IdentityStore: on first need, mints an anonymous
 *    identity (random id, curated emoji avatar, generated handle),
 *    persists it, and returns the same one forever after.
 *
 *  WHY IT EXISTS (design anchor)
 *    ARCHITECTURE §2.5: "Default on first launch: random emoji +
 *    generated handle — playing multiplayer requires zero setup."
 *    Anonymous play is a PERMANENT RIGHT (Pillar 10); this store is
 *    that right's plumbing. Phase 2's account linking preserves the
 *    same id (§2.5) — which is why the id is minted here, once, and
 *    never derived from anything session-bound.
 *
 *  WHY Math.random IS LEGAL HERE
 *    Identity creation is an app decision OUTSIDE the determinism
 *    boundary (same reasoning as seed choice in host.ts): nothing
 *    in any simulation ever depends on how an id was chosen. The
 *    generator is injectable so tests stay exact.
 * ============================================================
 */

import type { AnonymousIdentity, IdentityStore, KeyValueStore } from '../interfaces.js';

const IDENTITY_KEY = 'rebound.identity.v1';

/** The curated avatar set (ARCHITECTURE §2.5's examples) — readable
 *  at board-row size, charming, and free. */
export const AVATARS: readonly string[] = ['🐱', '🐶', '🤖', '👻', '🐼', '🦊', '🐸', '🐙'];

/** Handle fragments — cheerful, never solemn (GDD §5.5). */
const HANDLE_A = ['Bouncy', 'Turbo', 'Lucky', 'Rowdy', 'Zippy', 'Plucky', 'Snappy', 'Peppy'];
const HANDLE_B = ['Comet', 'Pebble', 'Rocket', 'Acorn', 'Willow', 'Biscuit', 'Nimbus', 'Sprout'];

export class LocalIdentityStore implements IdentityStore {
  constructor(
    private readonly kv: KeyValueStore,
    /** Injectable randomness — tests pass a fixed sequence. */
    private readonly random: () => number = Math.random,
  ) {}

  getIdentity(): AnonymousIdentity {
    const raw = this.kv.get(IDENTITY_KEY);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as Partial<AnonymousIdentity>;
        if (
          typeof parsed.id === 'string' &&
          typeof parsed.avatar === 'string' &&
          typeof parsed.name === 'string'
        ) {
          return { id: parsed.id, avatar: parsed.avatar, name: parsed.name };
        }
      } catch {
        // Corrupt entry: mint fresh below — honest loss over
        // silent corruption (the storage boundary rule).
      }
    }
    const minted = this.mint();
    this.kv.set(IDENTITY_KEY, JSON.stringify(minted));
    return minted;
  }

  private mint(): AnonymousIdentity {
    const pick = <T>(list: readonly T[]): T =>
      list[Math.floor(this.random() * list.length)] as T;
    return {
      id: `anon-${Math.floor(this.random() * 2 ** 31).toString(36)}-${Math.floor(this.random() * 2 ** 31).toString(36)}`,
      avatar: pick(AVATARS),
      name: `${pick(HANDLE_A)}${pick(HANDLE_B)}`,
    };
  }
}
