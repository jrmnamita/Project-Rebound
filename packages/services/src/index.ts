/**
 * ============================================================
 *  index.ts — the public surface of @rebound/services
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Re-exports the service interfaces, the storage primitives, and
 *    the Local implementations. Phase 2's services-remote package
 *    will export Remote implementations of the SAME interfaces —
 *    consumers choose an implementation once, at composition time
 *    (main.tsx/host.ts), and nowhere else.
 * ============================================================
 */

export type {
  AnonymousIdentity,
  BestScoreStore,
  BestTraceStore,
  IdentityStore,
  KeyValueStore,
  SettingsStore,
} from './interfaces.js';
export { MemoryStore, browserStorage } from './storage.js';
export { LocalBestStore } from './local/best-runs.js';
export { LocalSettingsStore } from './local/settings.js';
export { AVATARS, LocalIdentityStore } from './local/identity.js';
