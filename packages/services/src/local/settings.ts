/**
 * ============================================================
 *  settings.ts — local settings: the player's few switches
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Implements SettingsStore over a KeyValueStore. One setting
 *    today (mute — the persistence audio.ts flagged as pending);
 *    the game's philosophy keeps this list short forever (Vision:
 *    "a player who never reads a menu... gets the entire game").
 * ============================================================
 */

import type { KeyValueStore, SettingsStore } from '../interfaces.js';

const MUTED_KEY = 'rebound.settings.muted.v1';

export class LocalSettingsStore implements SettingsStore {
  constructor(private readonly kv: KeyValueStore) {}

  isMuted(): boolean {
    return this.kv.get(MUTED_KEY) === 'true'; // absent or corrupt ⇒ sound on (the cheerful default, GDD §5.5)
  }
  setMuted(muted: boolean): void {
    this.kv.set(MUTED_KEY, muted ? 'true' : 'false');
  }
}
