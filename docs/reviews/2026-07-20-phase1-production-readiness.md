# Phase 1 Production-Readiness Review

**Date:** 2026-07-20 · **Status:** Session report — immutable after commit · **Reviewer:** Lead architect pass over the complete twelve-module refactor

**Verified state:** 173/173 tests green (118 determinism + 30 web + 18 protocol + 7 services); five packages typecheck clean under `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; production Vite build succeeds (~154 KB app + Phaser, gzip ~49 KB app). The game is playable offline via `pnpm dev`.

This report grades seven dimensions, then lists remaining issues before production, ranked by severity. **Nothing below is a green-test contradiction — these are the gaps tests were never written to catch.**

---

## Scorecards

### Documentation compliance — B+
Every source file carries the mandated header and doc-cited comments; two maintainer rulings are recorded as ADRs (0001, 0002); AI_CONTEXT's living sections tracked every module in real time. **Gaps:** the GDD §11.3 wording amendment owed by ADR-0001 is not yet applied; the GDD version discrepancy (AI_CONTEXT cited v1.1.0, disk is v1.0.0 — review A2) is still open; README still says "nothing here is playable yet" (now false) and still carries the "Orb Arena" alias (review F2); `ARCHITECTURE.md` is still the v3 delta, not the consolidated document (D1); `ROADMAP.md` still absent. These are the Milestone-0 documentation debts, untouched by implementation.

### Architecture compliance — A−
The dependency arrow holds: sim-core imports no framework (verified — its tsconfig has no `dom` lib, so browser globals cannot even typecheck in), services and protocol are platform-neutral leaves, `host.ts` is the sole dual-citizen. Determinism is real and proven end-to-end (record→replay→hash-match). Fixed 60-tick timestep with render interpolation is in place. **Gap:** the boundary is enforced by *compiler configuration and discipline*, not by the lint rules CODING_STANDARDS §8/§12 mandate as CI-blocking — see Issue 1.

### Coding standards compliance — B
Naming, file/folder conventions, error philosophy (typed results at boundaries, throw only on invariant violation), and formatting intent are all followed. **Two concrete violations of §5/§6 size limits**, measured, not estimated:
- `Simulation.step()` is **148 lines** — hard limit is 60. Its cyclomatic complexity is well past the §5 ceiling (even the sim-core exemption caps at 15).
- `sim.ts` is 403 lines and `Simulation` the class is near the 300-line class ceiling.
These are the honest cost of writing the tick sequencer as one readable narrative; they are real violations regardless. See Issue 3.

### Performance — B−
For 1–4 players at 60 Hz the sim is comfortably real-time. But three patterns will not scale and one wastes real work today:
- **`computeJumpMetrics` runs two ~600-tick physics simulations on every `generateChunk` call** (Issue 4) — terrain generation secretly runs hundreds of mini-simulations. Correct, deterministic, and wasteful.
- **`host.pushHud()` reads `localStorage` (via `bestStore.getBest()`) ~10×/second** during play (Issue 5) — a synchronous disk-backed read in the render path.
- **`Simulation.players` allocates a fresh array on every access**, and `step()` accesses it several times per tick plus runs `extendTerrain`/`prune` every tick — steady GC pressure (Issue 6).
None breaks a solo match; all are worth fixing before the Phase 2 4-player server multiplies them.

### Maintainability — A−
Modular, replaceable, one-responsibility-per-file, seams everywhere the future needs them (GroundQuery, ViewTarget, SceneDriver, GameIntents, service interfaces, the protocol). ADRs capture the *why* of contested decisions. **Drag:** the DRAFT tunables are scattered across nine files by deliberate choice (taught in constants.ts) — defensible, but a contributor retuning "feel" touches many files; and the two size violations above make `sim.ts` the one file that resists change.

### Readability — A
Consistent vocabulary drawn from the GDD glossary, coordinate conventions declared once and honored, no cleverness. A stranger can open any file and know what it is and why from the header alone.

### Educational quality — A
The mandate is met thoroughly: every exported function teaches purpose/why/inputs/outputs/side-effects/related-systems; non-trivial blocks cite the gameplay rule they implement; the *why* behind constraints (no-`vx`, endpoints-not-angles, quantize-before-hash, leaf-not-registry) is taught in place. A beginner reading top-to-bottom genuinely learns how the game works. The one caveat: comments claim lint enforcement (§12) that does not yet exist — teaching a rule the repo doesn't mechanically keep.

---

## Remaining issues before production, ranked

**Issue 1 — No ESLint config or CI workflow exist. (Highest severity.)**
`eslint.config.js` and `.github/workflows/ci.yml` appear in FOLDER_STRUCTURE's tree and are called "CI-blocking" throughout CODING_STANDARDS §12, but neither file is present. Consequence: the determinism-boundary import bans, complexity limits, no-floating-promises, and no-cycles rules are enforced only by my discipline and the compiler's partial help — a future contributor can import Phaser into sim-core and nothing stops them until a human notices. The determinism suite exists but runs in no automated gate. *Fix:* author `eslint.config.js` with the §8 restricted-import rules for `packages/sim-core`, complexity/size rules, and a `ci.yml` running typecheck + all package tests on every push. Until then, the standards are aspirational, not enforced.

**Issue 2 — `replayTrace` ignores the trace's curve and generation params. (Correctness, latent.)**
`InputTrace` stores `curveId` but `replayTrace` constructs `new Simulation({ seed, playerIds })` — dropping the curve and never storing generation params (`pickupKinds`, custom curve) at all. Today every match uses `CURVE_DRAFT_1` and default generation, so replays match and tests pass. The moment a daily challenge uses a custom pickup set or a tuned curve, its trace will replay under defaults and the validator will reject honest scores. *Fix:* store the full generation params in the trace and reconstruct the Simulation with them; resolve `curveId` to its curve. This is the one latent correctness bug in the build.

**Issue 3 — `Simulation.step()` violates the function-size and complexity limits.**
148 lines against a 60-line hard limit. *Fix:* extract the per-player body (respawn → intents → physics → checkpoints → death → pickups → score) into a private `stepPlayer()` and the window maintenance into `slideWindow()`. The tick *order* — the determinism contract — stays visible in `step()` as a sequence of named calls, which is arguably clearer than the current inline narrative.

**Issue 4 — Terrain generation re-simulates jump metrics per chunk.**
`generateChunk` calls `computeJumpMetrics` (two 600-tick sims) every invocation; `extendTerrain` calls it once per chunk. Metrics at base speed are constant for a given SIM_VERSION. *Fix:* compute once and pass in (or memoize by speed). Pure win — identical output, a fraction of the work.

**Issue 5 — Best-score storage is read from disk ~10×/second.**
`pushHud` calls `bestStore.getBest()` (a `localStorage.getItem`) every 6 ticks. *Fix:* cache the best in the host (read once at match start, update on `submit`), pushing a plain number to the HUD.

**Issue 6 — `Simulation.players` allocates per access; hot-path allocations each tick.**
The getter spreads a Map to an array on every call; `step()` calls it for the termination check and window maintenance, and builds filtered arrays for `extendTerrain`/`prune` every tick. *Fix:* compute the alive-player extents in the single player loop already running; avoid re-spreading.

**Issue 7 — Cross-engine determinism is asserted but not tested across engines.**
The suite proves same-engine reproducibility (run twice). The architecture's real risk (D2) is *different* JS engines disagreeing. sim-core avoids the known trap (no `Math.sin/cos/pow` — only +−×÷, `Math.imul`, `Math.floor/min/max`), so the risk is low, but "low" is not "verified." *Fix:* a CI job that runs the determinism hashes on two Node majors (and ideally a browser runtime), comparing recorded golden hashes.

**Issue 8 — Repository is not yet legally open source.**
No `LICENSE` (README: "all rights reserved until a LICENSE file is present"), no `CONTRIBUTING.md`. The Vision's "open source from its first commit" is currently unmet in the strict sense. *Fix:* add the intended OSI license and a CONTRIBUTING that points contributors at the governing docs.

**Issue 9 — Effect-world entries are keyed to absolute X but the terrain window slides.**
Craters/traps live on the Simulation by absolute x and heal in ~4 s, so in practice they expire long before their ground is pruned — no live bug found. But nothing *asserts* an effect can't outlive its loaded chunk (e.g., if a future tuning lengthens lifetimes past the keep-behind window). *Fix:* a guard or a test tying max effect lifetime to the keep-behind distance; low priority given current numbers.

**Issue 10 — Feel is uncalibrated; ghost rendering absent; open rulings remain.**
All DRAFT tunables satisfy the documented *shapes* and the property tests, but none has been playtested against the archived prototype (roadmap Step 3 gate, still open). Ghost *mechanism* (replay + trace store) exists; ghost *rendering* is unbuilt. Multiplayer termination (A8/C1) and the room lifecycle (B1) remain unruled — correctly deferred, but they gate any real Phase 2.

---

## Verdict

The Phase 1 foundation is architecturally sound, genuinely deterministic, thoroughly taught, and playable. It is **not yet production-ready**, and the gap is honest and small: the enforcement layer that makes the standards self-defending (Issue 1) and one latent replay bug (Issue 2) are the two that matter most; Issues 3–6 are quality/scale hygiene best fixed before the Phase 2 server multiplies them; 7–10 are the known, documented Phase-1-closeout debts. None requires redesign. All are additive.
