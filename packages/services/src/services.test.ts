/**
 * ============================================================
 *  services.test.ts — guarantees of the services layer
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the persistence contracts: bests only rise, corrupt
 *    storage degrades honestly, traces are simVersion-keyed,
 *    settings default cheerfully, and identity is minted once and
 *    returned forever.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  AVATARS,
  LocalBestStore,
  LocalIdentityStore,
  LocalSettingsStore,
  MemoryStore,
  browserStorage,
} from './index.js';

describe('Services — best score (Pillar 9 extends to the ledger)', () => {
  it('starts at zero, rises on a better score, refuses a worse one', () => {
    const store = new LocalBestStore(new MemoryStore());
    expect(store.getBest()).toBe(0);
    expect(store.submit(1200)).toEqual({ isNewBest: true, best: 1200 });
    expect(store.submit(900)).toEqual({ isNewBest: false, best: 1200 });
    expect(store.getBest()).toBe(1200);
  });

  it('corrupt stored bytes degrade to zero — never NaN in the HUD', () => {
    const kv = new MemoryStore();
    kv.set('rebound.best.v1', 'definitely-not-a-number');
    expect(new LocalBestStore(kv).getBest()).toBe(0);
  });
});

describe('Services — best traces (the future ghost’s food, simVersion-keyed)', () => {
  it('stores and returns a trace per (seed, simVersion); other versions see nothing', () => {
    const store = new LocalBestStore(new MemoryStore());
    store.saveTrace('daily-2026-07-20', 1, '{"frames":[]}');
    expect(store.loadTrace('daily-2026-07-20', 1)).toBe('{"frames":[]}');
    expect(store.loadTrace('daily-2026-07-20', 2)).toBeNull(); // a rules change orphans old ghosts
    expect(store.loadTrace('other-seed', 1)).toBeNull();
  });
});

describe('Services — settings (audio.ts’s pending mute persistence)', () => {
  it('defaults to sound ON (the cheerful default), persists the toggle', () => {
    const store = new LocalSettingsStore(new MemoryStore());
    expect(store.isMuted()).toBe(false);
    store.setMuted(true);
    expect(store.isMuted()).toBe(true);
  });
});

describe('Services — anonymous identity (ARCHITECTURE §2.5: zero setup, forever yours)', () => {
  it('mints once, then returns the identical identity on every call', () => {
    const store = new LocalIdentityStore(new MemoryStore(), () => 0.42);
    const first = store.getIdentity();
    expect(first.id).toMatch(/^anon-/);
    expect(AVATARS).toContain(first.avatar);
    expect(first.name.length).toBeGreaterThan(3);
    expect(store.getIdentity()).toEqual(first); // stable across loads
  });

  it('a corrupt stored identity is re-minted, not crashed on', () => {
    const kv = new MemoryStore();
    kv.set('rebound.identity.v1', '{broken json');
    const identity = new LocalIdentityStore(kv, () => 0.1).getIdentity();
    expect(identity.id).toMatch(/^anon-/);
  });
});

describe('Services — storage probe (persistence failing loses convenience, never the game)', () => {
  it('browserStorage returns null in Node — callers fall back to memory', () => {
    expect(browserStorage()).toBeNull();
  });
});
