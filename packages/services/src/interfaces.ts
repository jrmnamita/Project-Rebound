/**
 * ============================================================
 *  interfaces.ts — the service contracts: what persistence IS
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Declares every service interface the game consumes. The local/
 *    folder implements them over device storage today; Phase 2's
 *    services-remote package will implement the SAME interfaces
 *    over Supabase — and no caller will change.
 *
 *  WHY IT EXISTS (design anchor)
 *    ARCHITECTURE §3: "service interfaces with Local/Remote
 *    implementations and zero-backend demo mode" is a foundational
 *    unchanged decision. The interface/implementation split is the
 *    STRUCTURAL form of the offline promise (README: pnpm dev runs
 *    a fully playable demo with no backend): apps depend on these
 *    interfaces; whether bytes land in localStorage or Postgres is
 *    an implementation's private business.
 *    CODING_STANDARDS §7: "services own ALL persistence. No
 *    localStorage/network call exists outside a service
 *    implementation." The host's and audio's flagged in-memory
 *    stopgaps end where this file begins.
 *
 *  WHAT IT MUST NEVER DO
 *    Leak an implementation detail (a key name, a table name, an
 *    HTTP anything) into a signature.
 * ============================================================
 */

/**
 * Purpose: The storage primitive every local service builds on —
 * deliberately the intersection of localStorage and a Map.
 * Why so small: a two-method surface is trivially fake-able in
 * tests and trivially satisfiable by any real backend.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Purpose: The player's best score — the number the HUD, menu, and
 * results screen orbit (GDD §4's score-chaser persona).
 * Why submit() returns the verdict: "is this a new best?" is the
 * store's one judgment; letting callers re-derive it invites the
 * classic read-then-write race between two finishing matches.
 */
export interface BestScoreStore {
  getBest(): number;
  submit(score: number): { readonly isNewBest: boolean; readonly best: number };
}

/**
 * Purpose: Best-run traces per world seed — the future ghost's food
 * (GDD §10: race your own best; sim-core/replay.ts is the mechanism).
 * Why strings, not trace objects: services must not depend on
 * sim-core (the dependency arrow: services is a leaf peers import).
 * Callers serialize InputTrace to JSON; the store moves bytes.
 * Keys include the caller's simVersion so a rules change orphans
 * old ghosts instead of corrupting them (E2's invalidation rule).
 */
export interface BestTraceStore {
  saveTrace(seed: string, simVersion: number, traceJson: string): void;
  loadTrace(seed: string, simVersion: number): string | null;
}

/** Purpose: player preferences — today just the mute switch the
 *  Audio module has been waiting to persist (audio.ts's flag). */
export interface SettingsStore {
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

/**
 * Purpose: The anonymous identity — id, emoji avatar, handle —
 * created silently on first need (ARCHITECTURE §2.5: "playing
 * multiplayer requires zero setup"). Phase 2's remote identity
 * preserves the same id on account linking (§2.5); this interface
 * is the seam that makes that a swap, not a rewrite.
 */
export interface AnonymousIdentity {
  readonly id: string;
  readonly avatar: string;
  readonly name: string;
}
export interface IdentityStore {
  getIdentity(): AnonymousIdentity;
}
