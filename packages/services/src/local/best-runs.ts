/**
 * ============================================================
 *  best-runs.ts — local bests: the score-chaser's ledger
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Implements BestScoreStore and BestTraceStore over a
 *    KeyValueStore — the personal-best number, and per-seed best-run
 *    traces for the future ghost (GDD §10, §4's score-chaser).
 *
 *  WHY KEYS ARE VERSIONED
 *    Storage outlives code. The `.v1` suffix on every key is this
 *    module's own schema version — if the stored SHAPE ever changes,
 *    v2 keys start fresh and v1 data is simply orphaned, never
 *    misread (review E1/E2: honest loss beats silent corruption).
 *    Trace keys additionally carry the caller's simVersion: a rules
 *    change orphans old ghosts — replay.ts would refuse them anyway,
 *    and this stops them being offered at all.
 * ============================================================
 */

import type { BestScoreStore, BestTraceStore, KeyValueStore } from '../interfaces.js';

const BEST_KEY = 'rebound.best.v1';
const traceKey = (seed: string, simVersion: number): string =>
  `rebound.trace.v1.sim${simVersion}.${seed}`;

export class LocalBestStore implements BestScoreStore, BestTraceStore {
  constructor(private readonly kv: KeyValueStore) {}

  getBest(): number {
    const raw = this.kv.get(BEST_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    // Stored bytes are a boundary: validate, never trust (a corrupt
    // entry becomes 0, not NaN spreading through the HUD).
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  /** One judgment, made atomically here — see interfaces.ts on why
   *  callers must not re-derive "is this a new best". Scores only
   *  ever rise (Pillar 9 extends to the ledger). */
  submit(score: number): { readonly isNewBest: boolean; readonly best: number } {
    const current = this.getBest();
    if (score > current) {
      this.kv.set(BEST_KEY, String(score));
      return { isNewBest: true, best: score };
    }
    return { isNewBest: false, best: current };
  }

  saveTrace(seed: string, simVersion: number, traceJson: string): void {
    this.kv.set(traceKey(seed, simVersion), traceJson);
  }
  loadTrace(seed: string, simVersion: number): string | null {
    return this.kv.get(traceKey(seed, simVersion));
  }
}
