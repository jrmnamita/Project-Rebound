# ADR-0002 — Placed effects heal in seconds; checkpoint pads are immune

**Date:** 2026-07-20 · **Status:** Accepted (maintainer ruling, resolves documentation-review findings C4 and A5's placement clause) · **Immutable once accepted**

## Context

GDD §11.1 requires every offensive effect to be "brief — seconds, not phases," but said nothing about whether a Bomb's *crater* (terrain damage, not a status effect) persists. Separately, GDD §8.4 guarantees respawn placement "safe by construction," which placed hazards could silently break (review A5/C4).

## Decision

1. **Craters heal.** A crater is an effect like any other: it exists for a bounded window (~4 seconds — DRAFT, playtest-owned, `effects/bomb.ts`) and then the ground returns. Spike Traps receive the same bounded lifetime by the same §11.1 logic (flagged extension of this ruling).
2. **Checkpoint safe pads are immune to all placed effects.** A Bomb or Trap whose telegraphed landing spot would overlap a checkpoint's safe pad shifts to land just past the pad's end. Respawn safety (§8.4) is absolute; no effect may ambush a respawn.

## Consequences

- "Brief — seconds, not phases" now provably covers terrain damage; a match's world carries no permanent scars, and Extreme Survival is the world's own doing, never accumulated debris.
- The immunity zone equals the generator's safe pad (`GENERATION.SAFE_PAD_LENGTH`, centered on each checkpoint) — one constant, shared by generation and effects.
- Tunables (heal window, trap lifetime, telegraph distance) are DRAFT and bump SIM_VERSION on change.

## Alternatives rejected

Permanent craters (match-long scars): rejected — stretches §11.1 past honesty. Pads-not-immune: rejected — sacrifices §8.4's guarantee for aggression the design doesn't want.
