# ADR-0001 — Terrain-modifying effects hit the shared world

**Date:** 2026-07-20 · **Status:** Accepted (maintainer ruling, resolves documentation-review finding A4) · **Immutable once accepted**

## Context

GDD §12 Pillar 7 promises "identical terrain, moment for moment" for all players; GDD §11.3's Bomb "blasts a crater into terrain ahead of the target rival." These conflict unless the documentation decides whether terrain modifications are per-player overlays (worlds diverge per player) or global (the shared world itself changes).

## Decision

**Terrain modifications are global.** A Bomb's crater and a Spike Trap's spike enter the one shared world that every player traverses — including the attacker. The effect's *target* determines only WHERE the modification lands (a telegraphed distance ahead of the target's position); its consequences belong to everyone who reaches that ground.

## Consequences

- Pillar 7 is preserved in its strongest literal sense: there is exactly one world, always, for everyone. No overlay machinery, no per-player ground queries, no divergence for the validator to model.
- Offense carries strategic weight: a crater laid for the leader will be reached by the whole room — including its author. Bombing recklessly is self-sabotage; this is a gameplay consequence the maintainer accepts by this ruling.
- GDD §11.3's per-target wording ("their easy ground") should be amended to "the shared terrain ahead of the target" — **GDD version bump owed** (pillar-adjacent; requires the standard sign-off trail).
- Implementation: effect world-state (craters, trap spikes) lives once on the Simulation, consulted by every player's physics and death checks (`effects/resolve.ts`).

## Alternative rejected

Per-player overlays (the review's recommended reading): stronger targeting fidelity, but introduces per-player world divergence, overlay plumbing in every query path, and an amended Pillar 7. Rejected by maintainer choice.
