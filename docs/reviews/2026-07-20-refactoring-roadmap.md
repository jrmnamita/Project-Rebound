# Production Refactoring Roadmap — Prototype → Documented Architecture
**Date:** 2026-07-20 · **Status:** Session report — planning input for `docs/ROADMAP.md`; not itself a governing document · **Immutable after commit**

**Basis:** GDD v1.0.0, ARCHITECTURE v3 delta (+v2 by reference), PROJECT_VISION v1.0.0. Target structure: `docs/FOLDER_STRUCTURE.md`. Phase 1 fully specified; Phase 2 seams noted where they constrain Phase 1.

**Governing rule:** nothing is refactored incrementally from prototype files into production files. The prototype is a behavioral reference; every production module is built clean inside the documented structure, then the prototype is retired in one step. "Split" means responsibilities extracted into new homes.

---

## Module map

| # | Module | From → To | Order | Risk |
|---|---|---|---|---|
| 1 | Tunables & physics math | physics.js → sim-core constants/curve/rng | Step 1 | Low |
| 2 | Player entity | entities.js Ball → sim-core player + web sprites | Step 3 | Medium |
| 3 | World generation | level.js → sim-core terrain/ + web renderers | Steps 2, 5 | **High** |
| 4 | Match rules | (smeared in game.js) → sim-core match | Step 4 | Medium |
| 5 | Power-up effects | (absent) → sim-core effects/ | Step 6 | Medium-high |
| 6 | Orchestration & presentation | game.js + inline monolith → apps/web (host/scene/ui) | Step 7 (skeleton at 3) | Medium |
| 7 | Persistence & services | localStorage calls → packages/services | Step 8 (interfaces at 1) | Low |
| 8 | Prototype retirement & knowledge capture | all prototype files → /prototype-archive + design-notes | Step 0 capture; Step 9 delete | Low |
| 9 | Determinism tests & CI | (absent) → /tests/determinism + ci.yml | Continuous from Step 1 | Low effort / critical consequence |

## Per-module detail

**M1 — Tunables & math.** New: versioned constants with simVersion; named 4-phase speed curve keyed to match tick with unbounded Extreme tail; seeded PRNG/hash making Math.random forbidden-and-unneeded. Colors leave for the web theme. Collision trig dissolves into the height-field terrain model. Deps: none (sim-core stays dependency-free). Risk: tuning-feel drift — mitigated by feel notes (M8).

**M2 — Player.** New: pure deterministic player state (position, velocity, hold state, lives, checkpoint, protection timer, score, effect flags) + step function on input intents, implementing the documented hold-scaled jump (not the prototype's impulse-cut approximation). Sprites read snapshots; squash/stretch is render-only. Merge in: player-adjacent state scattered in game.js. Deps: constants, curve, terrain queries, match. Risk: the jump is the product — jump-metric characterization tests + side-by-side play vs. archived prototype gate this step.

**M3 — Terrain.** New: chunk generator keyed (seed, chunkIdx, simVersion); full §6.2 vocabulary incl. floating platforms, hazard zones, large gaps; checkpoints and pickups as generator artifacts; survivable-by-construction constraints derived from jump metrics (pure calculation from constants keeps the graph acyclic); per-player overlays for craters (pending ruling A4); pruning keyed to earliest live checkpoint. Parallax and drawing go to presentation. Risk: highest — clearability must hold at any arrival speed ≥ base (respawns replay chunks at higher speed); owns its own property-test suite.

**M4 — Match rules.** New: 3 lives; death classification; checkpoint respawn after fixed tick delay with spawn protection (hazard-immune, score-frozen); score as pure function of survived distance/ticks with deterministic modifiers; elimination; termination/winner incl. deterministic tiebreaks (pending rulings A8/C1). Risk: medium — logic is documented; the risk is building on unresolved ambiguities, hence the Step 0 gate.

**M5 — Effects.** New, Phase 1 as sim modules (transport comes in Phase 2): bomb, spike-trap, slow, shield, speed-boost + shared resolve module (tick-stamp ordering, shield absorption, same-tick determinism). Depends on rulings A4–A7, C2–C4 being answered in writing first. One file per effect = the documented extension seam.

**M6 — Orchestration & presentation.** GameHost (`host.ts`): the only file touching both worlds — fixed 60-tick accumulator, pointer→input intents, sim + ghost stepping, snapshots. Phaser scene: interpolated rendering; documented portrait camera (9:16 logical viewport, player ~28% from left, named lookahead-seconds parameter, smoothed vertical follow; identical framing by construction). React/Zustand UI: menu, HUD with named phases + transition banner, results with two-tap rematch; zero gameplay logic in UI. Reconciles the two divergent prototype behaviors once, with the GDD as arbiter.

**M7 — Services.** Interfaces + Local implementations: best scores and best-run traces keyed (seed, simVersion, curveId) for ghosts; settings; anonymous-identity stub admitting the Phase 2 Remote implementation without touching callers. Structurally guarantees zero-backend demo. sim-core never depends on services.

**M8 — Prototype retirement.** Step 0 (before any code): extract feel-reference and behavior checklist to docs/design-notes/. Archive to /prototype-archive with ARCHIVE_NOTE.md; delete only at Phase 1 feel-parity sign-off. Skipping capture converts feel knowledge into permanent loss.

**M9 — Determinism suite & CI.** Hash equality across runs; trace replay fidelity; generator determinism + clearability; match invariants (3 lives, monotonic score, checkpoint respawn, protection); effect resolution; jump-metric characterization pinning feel numbers (changes = deliberate simVersion bumps). Headless by construction — which is itself the proof the sim/render boundary holds. Red determinism run = stop-ship from day one.

## Global execution order

| Step | Work | Modules | Gate to proceed |
|---|---|---|---|
| 0 | Feel notes + behavior checklist; **maintainer rulings on blocking ambiguities** (A4, C4, A8/C1, activation default, C5) | 8 | Rulings written into docs with version bumps + ADRs |
| 1 | Monorepo scaffold; constants/curve/rng; service interfaces sketched; CI skeleton | 1, 7, 9 | Curve + rng suites green |
| 2 | Terrain core: chunks, ground vocabulary, queries, checkpoints | 3, 9 | Generator determinism + clearability green |
| 3 | Player module + walking-skeleton renderer (fixed tick, portrait camera, flat world) | 2, 6p, 9 | Jump-feel sign-off vs. archived prototype |
| 4 | Match rules | 4, 9 | Match-invariant suite green |
| 5 | Vocabulary completion: platforms, hazard zones, large gaps, pickups | 3, 9 | Survivability green at curve extremes |
| 6 | Effect modules + overlays + resolution | 5, 9 | Replay-equality (inputs + effect events) green |
| 7 | Full presentation & UI incl. ghost, rematch flow | 6 | 2–5 min median match; rematch ≤ 2 taps verified |
| 8 | Local services complete; offline verification | 7 | Cold-start offline run with cleared storage |
| 9 | Prototype deletion; AI_CONTEXT/README updates; Phase 1 acceptance vs. GDD checklist | 8 | Maintainer sign-off → Milestone records updated |

**Out of scope (Phase 2+, seams reserved):** protocol schemas, game-server room actors, live-board transport, Supabase Remote services, replay validator service.

## Risk register

| Risk | Level | Step | Mitigation |
|---|---|---|---|
| Jump feel regression under fixed tick | Med-high | 3 | Characterization tests + side-by-side prototype play |
| Terrain generates unfair sequences | High | 2/5 | Property tests at min arrival speed; hazard/checkpoint exclusions |
| Building on unresolved doc ambiguities | High | 0 | Hard gate: no Step 4/6 start without written rulings |
| Sim ⟂ render seam erosion | Med | 3–7 | Headless suite as structural enforcement; lint: no framework imports under packages/ |
| Feel-knowledge loss at deletion | Low | 0/9 | Capture before code; delete only after parity sign-off |
| Scope creep past Phase 1 | Med | all | This table is the contract; Phase 2 items refused by default |
