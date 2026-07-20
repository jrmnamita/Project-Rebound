# ClaudeContext.md
## Final say on Project Rebound — Phase 1 build handoff

| | |
|---|---|
| **Author** | Claude (claude-fable-5), acting Lead Software Architect → Principal Engineer gate review |
| **Date** | 2026-07-20 |
| **Purpose** | A single, honest, standalone summary for the next reader (human or AI): what was built, what state it is in, and what stands between it and a public release. If you read one file to catch up, read this — then `docs/AI_CONTEXT.md`. |

---

## Final verdict (one paragraph)

Project Rebound's Phase 1 foundation is **architecturally sound, genuinely deterministic, thoroughly documented, exhaustively taught, and playable offline** — and it is **not yet cleared for public open-source release**. The gap is small, specific, and entirely additive: a license, a corrected README, an automated CI + lint gate, and a contributing guide. None of it touches gameplay code. My formal disposition is **conditional approval**: the code is release-quality; the *repository as a public artifact* is blocked on four items that are perhaps a day of work. Composite gate score **6.9/10**, dragged down almost entirely by open-source packaging (4/10) and unproven scaling (5/10), not by the code itself.

## What exists

A TypeScript pnpm monorepo implementing the complete twelve-module sequence, built one module at a time with documentation-first discipline:

- **`packages/sim-core`** — the deterministic heart (no framework imports, no clock, no unseeded randomness): input intents, player/jump, physics, terrain vocabulary + chunks + queries, seeded generation, speed curve, match rules (lives/checkpoints/score/elimination), all five power-ups, the simulation façade, statehash, and replay.
- **`packages/protocol`** — the wire contract (message types + zod guards + versioned codec) for Phase 2 live rooms. **No server was built** — that is Phase 2.
- **`packages/services`** — interfaces + Local implementations (best scores, ghost traces, settings, anonymous identity). Its existence is the offline guarantee.
- **`apps/web`** — React + Zustand + Tailwind chrome, the Phaser scene, and the GameHost bridge (the one file allowed to touch both sim and presentation).
- **`tests/determinism`** + colocated package tests — **173 tests, all green**; five packages typecheck clean under full strict mode; production Vite build succeeds.

Two maintainer rulings are recorded as ADRs: **ADR-0001** (terrain effects hit the shared world) and **ADR-0002** (craters heal ~4 s; checkpoint pads immune).

## Release blockers (public launch gated on all four)

1. **No `LICENSE`** — the repo is legally all-rights-reserved; it cannot be called open source until this lands (README says so itself).
2. **README is factually stale** — says "nothing playable yet" (now false) and carries an "Orb Arena" alias in no governing doc.
3. **No CI workflow and no ESLint config** — both are in the governed tree and called "CI-blocking," but neither file exists, so the determinism-boundary rules are enforced by discipline, not machinery.
4. **No `CONTRIBUTING.md`** — the Vision promises an honored path for "I just want to fix a typo"; none exists yet.

## Quality debt (gates Phase 2, not public release)

- **`replayTrace` ignores the trace's curve/generation params** — correct today (all matches use defaults), a correctness landmine the moment a custom match is recorded. Fix before trusting the validation pipeline.
- **`Simulation.step()` is 148 lines** vs. the project's own 60-line hard limit — extract `stepPlayer()` / `slideWindow()`.
- **`computeJumpMetrics` re-runs two ~600-tick sims per generated chunk** — compute once; pure win.
- **Best score read from `localStorage` ~10×/second** in the HUD path — cache it.
- **Per-tick array allocations** in `Simulation.players` and window maintenance — fold into the existing player loop.
- **Cross-engine determinism is asserted, not tested** across engines (risk is low — no banned math — but unverified).

## Open documentation debts (Milestone 0 closeout)

GDD §11.3 wording amendment owed by ADR-0001; GDD version discrepancy (AI_CONTEXT cited 1.1.0, disk is 1.0.0); `ARCHITECTURE.md` still an unconsolidated v3 delta (v2 missing); `ROADMAP.md` absent; feel calibration vs. the archived prototype never done; the legacy prototype not yet archived; open rulings A8/C1 (multiplayer termination) and B1 (room lifecycle) still unruled.

## The one-day path to lifting the gate

Close blockers 1–4 — all independent of gameplay code: add the intended OSI `LICENSE`, refresh the README, author `eslint.config.js` (with the sim-core restricted-import rules) + `.github/workflows/ci.yml` (typecheck + all tests), and write `CONTRIBUTING.md` pointing at the governing docs. Then fix the `replayTrace` params bug before Phase 2. Everything else is scheduled hygiene.

## How to run it (offline, no backend)

From the repository root:

```
pnpm install          # one time; needs Node 20+ and pnpm 9+
pnpm --filter @rebound/web dev
```

Open the printed local URL (Vite serves it, default http://localhost:5173). Tap / click / press **Space** to jump, hold for a higher jump. It runs entirely offline — there is no server, and there never needs to be one for solo practice. To verify the whole suite: `pnpm test` and `pnpm typecheck` from the root. To build the static bundle: `pnpm --filter @rebound/web build` (output in `apps/web/dist`).

---

*This file is a snapshot as of 2026-07-20. The living source of truth is `docs/AI_CONTEXT.md` and the dated reports in `docs/reviews/`. If this file and the repository ever disagree, trust the repository and flag it.*
