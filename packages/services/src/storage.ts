/**
 * ============================================================
 *  storage.ts — where bytes actually go
 * ============================================================
 *  WHAT THIS FILE DOES
 *    The two KeyValueStore implementations: an in-memory Map (tests,
 *    fallback, private-mode browsers) and a guarded probe for the
 *    browser's localStorage.
 *
 *  WHY THE PROBE IS PARANOID
 *    localStorage can be absent (Node), present-but-throwing
 *    (private mode, storage quotas), or disabled by policy. A game
 *    must not care: persistence failing means the player loses
 *    convenience, never the game (the same degrade-to-silence
 *    philosophy as audio.ts; CODING_STANDARDS §10). browserStorage()
 *    returns null rather than a broken store — the caller composes
 *    `browserStorage() ?? new MemoryStore()` and moves on.
 * ============================================================
 */

import type { KeyValueStore } from './interfaces.js';

/** In-memory store: the test double AND the honest fallback. */
export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/** The shape we probe for — declared structurally so this package
 *  needs no 'dom' lib (platform-neutral, see tsconfig). */
interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Purpose: The browser's localStorage as a KeyValueStore — or null
 * where it does not truly work.
 * Why a write-read probe: some environments expose localStorage
 * that throws on use (private mode). Probing with a real write is
 * the only honest test. Side effects: one throwaway probe key.
 */
export function browserStorage(): KeyValueStore | null {
  const candidate = (globalThis as { localStorage?: LocalStorageLike }).localStorage;
  if (candidate === undefined) return null;
  try {
    const probeKey = 'rebound.storage.probe';
    candidate.setItem(probeKey, '1');
    candidate.getItem(probeKey);
    return {
      get: (key) => candidate.getItem(key),
      set: (key, value) => candidate.setItem(key, value),
    };
  } catch {
    return null; // present but broken: fall back, never crash
  }
}
