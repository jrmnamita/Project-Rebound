/**
 * ============================================================
 *  events.ts — the simulation's outbound vocabulary
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Defines every event the Simulation can emit in a tick — the
 *    one-way message surface through which presentation (renderer,
 *    HUD, audio) learns that something happened.
 *
 *  WHY IT EXISTS (design anchor)
 *    CODING_STANDARDS §10: in sim-core, expected game outcomes are
 *    STATES AND EVENTS, never exceptions. And §7: presentation
 *    renders results, it never re-derives rules — these events are
 *    the results. Each variant corresponds to a documented moment:
 *    deaths and respawns (GDD §8.3), checkpoints (§8.4), phase act
 *    breaks (§8.5), elimination and match end (§8.1), pickups
 *    (§11.2), and the jump/landing beats the juice hangs on (§5.1).
 *
 *  WHAT IT MUST NEVER DO
 *    Carry instructions. An event says WHAT HAPPENED, never what a
 *    consumer should do about it — audio decides its own chirps.
 * ============================================================
 */

import type { PhaseName } from './curve.js';
import type { PickupKind } from './terrain/vocabulary.js';

/** Why a player died — deaths must be legible (GDD §5.2: defeat is
 *  self-attributable, so the cause is named, never mushed). */
export type DeathCause = 'fall' | 'spike' | 'hazard';

export type SimEvent =
  | { readonly type: 'jumped'; readonly playerId: string }
  | { readonly type: 'landed'; readonly playerId: string }
  | { readonly type: 'checkpoint'; readonly playerId: string; readonly checkpointX: number }
  | { readonly type: 'death'; readonly playerId: string; readonly cause: DeathCause }
  | { readonly type: 'respawn'; readonly playerId: string }
  | { readonly type: 'eliminated'; readonly playerId: string }
  | { readonly type: 'pickup'; readonly playerId: string; readonly kind: PickupKind }
  | { readonly type: 'phaseChanged'; readonly phaseIndex: number; readonly phaseName: PhaseName }
  // ── Effects module (GDD §11; ADR-0001/0002) ──
  | {
      readonly type: 'effectApplied';
      readonly kind: PickupKind;
      readonly sourceId: string;
      readonly targetId: string;
    }
  | { readonly type: 'shieldAbsorbed'; readonly targetId: string; readonly kind: PickupKind }
  | { readonly type: 'effectFizzled'; readonly kind: PickupKind; readonly sourceId: string }
  | { readonly type: 'matchOver' };
