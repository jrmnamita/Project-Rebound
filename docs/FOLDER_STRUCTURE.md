# FOLDER_STRUCTURE.md
## Project Rebound — Production Repository Architecture

| | |
|---|---|
| **Document version** | 1.0.8 |
| **Status** | Adopted working structure (maintainer-directed, 2026-07-20) — ratification entry pending maintainer sign-off |
| **Scope** | The final production folder structure for the entire project lifecycle (Phases 1–4), the reason every folder and file exists, and the rules for adding new ones. Contains **no implementation** — architecture only. |
| **Authority** | Subordinate to `AI_CONTEXT.md`, `PROJECT_VISION.md`, `GAME_DESIGN_DOCUMENT.md`, and `ARCHITECTURE.md`. Where this document and ARCHITECTURE.md conflict, ARCHITECTURE.md wins. |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-07-20 | AI assistant, maintainer-directed session | Initial structure, derived from ARCHITECTURE v3 (+v2 by reference), the GDD, and the 2026-07-20 refactoring roadmap (`docs/reviews/`) |
| 1.0.1 | 2026-07-20 | AI assistant, maintainer-directed session | Added `docs/CODING_STANDARDS.md` to the tree (governance rule 2) |
| 1.0.2 | 2026-07-20 | AI assistant, maintainer-directed session | Added `sim-core/src/input.ts` (Input System module — first production module, maintainer-opened Phase 1); package READMEs noted |
| 1.0.3 | 2026-07-20 | AI assistant, maintainer-directed session | Added `sim-core/src/physics.ts` (Physics module — motion integrator, previously implicit in player/terrain responsibilities) |
| 1.0.4 | 2026-07-20 | AI assistant, maintainer-directed session | Added `apps/web/vitest.config.ts` and colocated `*.test.ts` files in app packages (Camera module; see CODING_STANDARDS §2 amendment) |
| 1.0.5 | 2026-07-20 | AI assistant, maintainer-directed session | Added `apps/web/src/index.css` (Tailwind layers + device-level rules; UI module). Colocated-test note covers `.tsx` as well |
| 1.0.6 | 2026-07-20 | AI assistant, maintainer-directed session | `packages/protocol` materialized ahead of its Phase 2 slot (maintainer's Networking module — wire contract only, no server); added its `vitest.config.ts` and colocated test |
| 1.0.7 | 2026-07-20 | AI assistant, maintainer-directed session | Utilities module: `packages/services` materialized (+ its `vitest.config.ts`); sim-core `constants.ts` documented as a leaf + index (tunables stay beside their rules — rationale in the file) |
| 1.0.8 | 2026-07-20 | AI assistant, maintainer-directed session | Root `netlify.toml` (solo-demo deploy config); `ClaudeContext.md` and `docs/project-roadmap-gantt.html` added as root/docs artifacts for project handoff |

---

## 1. Purpose

This document is the answer to "where does this go, and why?" for every artifact the project will ever contain. Its governing rule, inherited from the project's philosophy:

> **Nothing exists without a written purpose.** Every folder and file below cites the document section or project need that justifies it. A file that cannot cite a justification does not get created (see §7).

The structure is **final but materializes progressively**: it is designed once, here, so that no phase ever forces a restructuring of a previous phase's work ("never choose a shortcut that forces a future rewrite" — AI_CONTEXT, Repository Philosophy). §6 maps each folder to the phase in which it first appears.

## 2. Structural Principles

These five principles generate the entire tree. Every placement decision below is an application of one of them.

1. **The dependency arrow points one way: `apps → packages → nothing`.** `sim-core` depends on zero packages and zero frameworks — it is the root of the graph because determinism, replay validation, and fairness (GDD §12.7) all live or die there. No package may ever import from an app. No sim code may ever import a renderer, a network library, or a UI framework (AI_CONTEXT, AI Working Rule 7).
2. **The determinism boundary is a folder boundary.** Everything inside `packages/sim-core` obeys the determinism laws (no wall-clock, no unseeded randomness, no engine-variant math). Everything outside it may be freely non-deterministic. Making the boundary a *directory* makes it reviewable at a glance and mechanically enforceable (lint rule: no forbidden imports under `packages/`).
3. **Interfaces and implementations live apart.** `packages/services` holds interfaces plus Local (offline) implementations; `packages/services-remote` holds the backend-connected implementations. This is what structurally guarantees "the frontend must always run fully without any backend" (AI_CONTEXT, Technology Summary): the web app can depend on `services` alone and be complete.
3. **One deployable = one folder under `/apps`.** Web client, game server, and mobile shell each build, version, and deploy independently; nothing deployable hides inside a library package.
5. **Documents are law and live together.** Everything governing lives in `/docs`; generated reports and session outputs live in `/docs/reviews` (dated, immutable); decisions with alternatives get ADRs in `/docs/adr`. The repository's history of *why* is part of the product (PROJECT_VISION, Open Source Philosophy).

## 3. The Final Tree

```
/
├─ README.md
├─ LICENSE
├─ CONTRIBUTING.md
├─ package.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ tsconfig.base.json
├─ .gitignore
├─ .editorconfig
├─ eslint.config.js
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml
│  │  └─ server-image.yml                  (Phase 2)
│  ├─ ISSUE_TEMPLATE/                      (Phase 3)
│  └─ PULL_REQUEST_TEMPLATE.md             (Phase 3)
│
├─ docs/
│  ├─ AI_CONTEXT.md
│  ├─ PROJECT_VISION.md
│  ├─ GAME_DESIGN_DOCUMENT.md
│  ├─ ARCHITECTURE.md                      (consolidated v2+v3 — pending)
│  ├─ ROADMAP.md                           (pending)
│  ├─ FOLDER_STRUCTURE.md                  (this document)
│  ├─ CODING_STANDARDS.md
│  ├─ adr/
│  │  └─ NNNN-title.md                     (one per recorded decision)
│  ├─ design-notes/
│  │  ├─ feel-reference.md                 (Step 0 artifact)
│  │  └─ prototype-behavior-checklist.md   (Step 0 artifact)
│  └─ reviews/
│     └─ YYYY-MM-DD-*.md                   (dated session reports, immutable)
│
├─ packages/
│  ├─ sim-core/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ README.md
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ input.ts
│  │     ├─ constants.ts
│  │     ├─ rng.ts
│  │     ├─ curve.ts
│  │     ├─ terrain/
│  │     │  ├─ generator.ts
│  │     │  ├─ chunk.ts
│  │     │  ├─ vocabulary.ts
│  │     │  └─ queries.ts
│  │     ├─ player.ts
│  │     ├─ physics.ts
│  │     ├─ match.ts
│  │     ├─ effects/
│  │     │  ├─ bomb.ts
│  │     │  ├─ spike-trap.ts
│  │     │  ├─ slow.ts
│  │     │  ├─ shield.ts
│  │     │  ├─ speed-boost.ts
│  │     │  └─ resolve.ts
│  │     ├─ events.ts
│  │     ├─ statehash.ts
│  │     ├─ replay.ts
│  │     └─ sim.ts
│  │
│  ├─ services/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ vitest.config.ts
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ interfaces.ts
│  │     ├─ storage.ts
│  │     └─ local/
│  │        ├─ best-runs.ts
│  │        ├─ settings.ts
│  │        └─ identity.ts
│  │
│  ├─ protocol/                            (materialized early — v1.0.6)
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ vitest.config.ts
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ messages.ts
│  │     ├─ codec.ts
│  │     ├─ guards.ts
│  │     └─ version.ts
│  │
│  └─ services-remote/                     (Phase 2)
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/
│        ├─ index.ts
│        ├─ supabase-client.ts
│        ├─ remote-identity.ts
│        ├─ remote-boards.ts
│        └─ remote-history.ts
│
├─ apps/
│  ├─ web/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ vitest.config.ts
│  │  ├─ vite.config.ts
│  │  ├─ tailwind.config.js
│  │  ├─ index.html
│  │  ├─ public/
│  │  │  ├─ manifest.webmanifest
│  │  │  └─ icons/
│  │  └─ src/
│  │     ├─ main.tsx
│  │     ├─ App.tsx
│  │     ├─ index.css
│  │     ├─ theme.ts
│  │     ├─ state/
│  │     │  └─ store.ts
│  │     ├─ game/
│  │     │  ├─ host.ts
│  │     │  ├─ scene.ts
│  │     │  ├─ camera.ts
│  │     │  ├─ terrain-render.ts
│  │     │  ├─ parallax.ts
│  │     │  ├─ fx.ts
│  │     │  └─ audio.ts
│  │     └─ ui/
│  │        ├─ Menu.tsx
│  │        ├─ Hud.tsx
│  │        ├─ PhaseBanner.tsx
│  │        ├─ LiveBoard.tsx               (Phase 2; solo row-of-one in Phase 1)
│  │        └─ Results.tsx
│  │
│  ├─ game-server/                         (Phase 2)
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ Dockerfile
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ room-actor.ts
│  │     ├─ standings.ts
│  │     ├─ validator-worker.ts
│  │     └─ limits.ts
│  │
│  └─ mobile/                              (Phase 3)
│     ├─ capacitor.config.ts
│     ├─ package.json
│     └─ src/adapter/
│        ├─ haptics.ts
│        ├─ safe-area.ts
│        ├─ lifecycle.ts
│        └─ push.ts
│
├─ supabase/                               (Phase 2)
│  ├─ config.toml
│  └─ migrations/
│     └─ NNNN_description.sql
│
├─ tests/
│  ├─ determinism/
│  │  ├─ package.json
│  │  ├─ vitest.config.ts
│  │  ├─ hash-equality.test.ts
│  │  ├─ replay.test.ts
│  │  ├─ generator.test.ts
│  │  ├─ match-rules.test.ts
│  │  ├─ effects.test.ts
│  │  └─ jump-metrics.test.ts
│  └─ e2e/                                 (Phase 2+)
│
└─ prototype-archive/                      (temporary — deleted at Phase 1 sign-off)
   ├─ ARCHIVE_NOTE.md
   └─ (frozen prototype files)
```

## 4. Why Every Folder Exists

### `/` (root)
Holds exactly two kinds of files: the public front door and workspace-wide configuration. Anything else at root is a structure violation.

| File | Purpose — why it belongs here |
|---|---|
| `README.md` | The public landing page (AI_CONTEXT reading order #6). Root because forges render it as the repo's face. |
| `LICENSE` | Vision: open source from the first commit; README currently says "all rights reserved" until this exists — making it a root-level *absence* being tracked. OSI license per README §License. |
| `CONTRIBUTING.md` | Vision: "welcoming by design"; README promises it. Encodes the rule that proposals are checked against GDD §2A/§12 first. |
| `package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` | Monorepo root and workspace map (ARCHITECTURE: monorepo layout; README promises `pnpm install && pnpm dev`). Lockfile committed: reproducible builds are a determinism concern at the toolchain level. |
| `tsconfig.base.json` | Single source of compiler strictness inherited by every package — one TypeScript dialect project-wide ("TypeScript end to end"). |
| `.gitignore` | Keeps generated artifacts (node_modules, dist, coverage) out of the written record. |
| `.editorconfig`, `eslint.config.js` | Multi-contributor hygiene (Vision: strangers contribute). ESLint additionally carries the **mechanical determinism guard**: forbidden-import and forbidden-API rules for `packages/sim-core` (no `Math.random`, no `Date`, no Phaser/React/socket imports). That rule is why lint config is infrastructure here, not taste. |

### `/.github`
Automation and contribution flow — the "receipts are public" machinery.

| Item | Purpose |
|---|---|
| `workflows/ci.yml` | The determinism CI required by ARCHITECTURE/roadmap Phase 1: typecheck, unit + determinism suites, web build, on every push/PR. A red determinism run is stop-ship. |
| `workflows/server-image.yml` (P2) | Builds/publishes the game-server Docker image (ARCHITECTURE: Docker deployment, VPS path). Exists only once there is a server. |
| `ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md` (P3) | Templates that route contributors through the governing documents (PR template literally links GDD §12 checklist). Deferred until contributions open. |

### `/docs`
The institution. Contributors and AI sessions come and go; this folder is what survives (Vision: "the documents are the institution").

| Item | Purpose |
|---|---|
| `AI_CONTEXT.md` | Entry point and working rules; its living sections are updated in real time as of 2026-07-20 (maintainer directive). |
| `PROJECT_VISION.md`, `GAME_DESIGN_DOCUMENT.md`, `ARCHITECTURE.md`, `ROADMAP.md` | The four governing documents in the reading order. `ARCHITECTURE.md` must become the consolidated v2+v3 document; `ROADMAP.md` is owed (AI_CONTEXT, Next Immediate Task). |
| `FOLDER_STRUCTURE.md` | This document — the structure contract that makes "nothing exists without purpose" enforceable in review. |
| `CODING_STANDARDS.md` | Binding code standards adopted before the first line of production code — naming, size limits, imports, error handling, and the educational-codebase mandate (its §4). |
| `adr/` | ADR-per-decision, promised by ARCHITECTURE's sign-off note. ADRs record *rejected alternatives*, which the governing docs deliberately omit. |
| `design-notes/` | Written knowledge that is neither law nor report: the prototype feel-reference and behavior checklist (roadmap Step 0) live here because they inform implementation without governing it. |
| `reviews/` | Dated, immutable session reports (audits, reviews, roadmaps). Kept because the Vision demands mistakes and reasoning stay public; dated filenames prevent them from masquerading as current law. |

### `/packages/sim-core`
**The heart.** Framework-free deterministic simulation — the only code that decides gameplay outcomes; everything else observes it. One file per documented system so that the GDD maps 1:1 onto the source tree:

| File | Purpose — GDD/ARCH anchor |
|---|---|
| `index.ts` | The package's only public surface; enforces that consumers see a façade, not internals. |
| `constants.ts` | All gameplay tunables + `SIM_VERSION` stamp (ARCH: `(seed, chunkIdx, simVersion)` identity). Single-sourced — the prototype's fatal duplication is structurally impossible. |
| `input.ts` | The input-intent model (ARCH §3): press/release intents, per-tick batching, and the IntentBuffer boundary validator — Pillar 1 ("one input") in code. |
| `rng.ts` | Seeded PRNG + hashing; the *only* legal randomness inside the boundary (AI Working Rule 7). |
| `curve.ts` | Named, versioned speed curves: the four phases on the shared match clock (GDD §8.5 — the signature mechanic gets its own file because its numbers will be retuned repeatedly under pillar-protected structure). |
| `terrain/generator.ts` | Chunked seeded generation (ARCH §2.2). |
| `terrain/chunk.ts` | Chunk data model incl. checkpoint anchors and pickup placements *as generator artifacts*. |
| `terrain/vocabulary.ts` | The GDD §6.2 element set (flats, slopes, gaps, platforms, spikes, hazard zones) as data definitions — new vocabulary lands here without touching the generator's spine (GDD §13: vocabulary evolves). |
| `terrain/queries.ts` | Ground/hazard/checkpoint/overlay queries used by player & match; overlays implement the per-player crater doctrine (pending ruling, review A4). |
| `player.ts` | Deterministic player state + step: tap/hold jump per GDD §6.1, lives/protection fields per §8.3. |
| `physics.ts` | The laws of motion: gravity, terminal fall, auto-forward integration at the dictated speed (Pillar 3), and ground contact (land/follow/leave) against the narrow GroundQuery seam the Level module satisfies. |
| `match.ts` | Match grammar: lives, checkpoint respawn, spawn protection, monotonic score, elimination, termination/winner (GDD §8). |
| `effects/*.ts` | One module per launch power-up (GDD §11.3) — the documented extension seam: "adding a new power-up = one sim module + one render descriptor + a generator entry" (ARCH §2.3). |
| `effects/resolve.ts` | Tick-stamped event application and ordering (shield-vs-simultaneous-effects determinism; review C3). |
| `events.ts` | Typed sim-out events (death, checkpoint, phase change…) — the one-way message surface presentation listens to. |
| `statehash.ts` | Per-tick state fingerprint for beacons and desync detection (ARCH sequence diagram). |
| `replay.ts` | Trace record/replay: powers ghosts (GDD §10), validation (ARCH), and the determinism suite — three documented features, one mechanism, hence one file. |
| `sim.ts` | The Simulation façade: constructs terrain/players/match, advances one tick from `(inputs, events)`. |

### `/packages/services` and `/packages/services-remote`
`services`: interfaces + Local implementations (best runs, settings, anonymous identity) over a storage adapter. Its existence *is* the offline guarantee — `apps/web` + `services` alone must be a complete game. `services-remote` (P2) implements the same interfaces against Supabase (identity, persistent boards, match history). Two packages, not one with flags, so the dependency graph proves the demo needs no backend.

### `/packages/protocol` (P2)
Message schemas, codec, zod boundary guards, protocol version — shared by exactly two consumers (web, game-server), which is the definition of a package. Client and server can never disagree about a message shape they both import.

### `/apps/web`
The playable product. Internally mirrors the constitutional separation: `game/host.ts` is the **GameHost bridge** — the only file allowed to touch both sim and presentation (fixed 60-tick loop, input intents, snapshots). `game/*` is Phaser presentation (scene, the §6.3 portrait camera with its named lookahead parameter in `camera.ts`, terrain rendering, parallax, fx, audio). `ui/*` is React chrome (menu, HUD, phase banner, live board, results-with-two-tap-rematch). `state/store.ts` is the Zustand snapshot store — UI reads it, never the sim. `theme.ts` holds the visual identity (colors leave gameplay code forever). `public/manifest.webmanifest` + icons: installable web app (README: playable demo on Netlify).

### `/apps/game-server` (P2)
One deployable Node process (ARCH: in-memory room actors): `room-actor.ts` (lobby/countdown/beacons/effect stamping), `standings.ts` (live board diffs at ~2 Hz + event-driven), `validator-worker.ts` (post-match replay in worker threads), `limits.ts` (rate/abuse guards), `Dockerfile` (documented deployment). Server logic that is *gameplay* does not exist — the server imports sim-core like everyone else.

### `/apps/mobile` (P3)
Capacitor shell around the same web build ("same codebase as the web version" — README). `adapter/` holds the four documented native seams (haptics, safe-area, lifecycle, push) — exactly the post-store-removal adapter set from ARCH §2.6, and nothing more.

### `/supabase` (P2)
Versioned migrations + config: the database schema is law like everything else, and RLS policies are part of the public fairness receipts.

### `/tests`
`determinism/` is a *separate workspace package* on purpose: it imports sim-core headlessly, proving the boundary holds (if it can't run without a browser, principle 2 has been violated). One suite per guarantee: hash equality, replay fidelity, generator determinism + survivable-by-construction, match invariants (3 lives, monotonic score, checkpoint respawn), effect resolution, and jump-metric characterization (feel changes must be deliberate `SIM_VERSION` bumps). `e2e/` arrives with multiplayer.

### `/prototype-archive` (temporary)
The frozen prototype plus `ARCHIVE_NOTE.md` (what it was, why retired, where its knowledge went). Exists so deletion is a calm reviewed step, not a panic revert; removed entirely at Phase 1 feel-parity sign-off. The only folder in this document *designed to disappear*.

## 5. What Is Deliberately Absent

Absences are decisions too: **no `/packages/store` or payment code** (ARCH §2.6 — monetization deleted by design); **no analytics package** (pending the telemetry policy — review B5; it would live in `services`/`services-remote` behind an interface if approved); **no `utils/` or `common/` grab-bag package** (each shared thing earns a named home or doesn't exist); **no per-app duplicated types** (shared types live in the package that owns the concept); **no generated files in git** beyond the lockfile.

## 6. Phase Materialization Map

| Folder | Appears | Reason tied to roadmap |
|---|---|---|
| root configs, `/docs/*`, `/packages/sim-core`, `/packages/services`, `/apps/web`, `/tests/determinism`, `/.github/workflows/ci.yml`, `/prototype-archive` | **Phase 1** | Foundation & Practice: deterministic core, portrait presentation, offline solo, determinism CI |
| `/packages/protocol`, `/packages/services-remote`, `/apps/game-server`, `/supabase`, `/tests/e2e`, `server-image.yml` | **Phase 2** | Live rooms: transport, backend, validation service |
| `/apps/mobile`, issue/PR templates | **Phase 3** | Community polish: Capacitor ship, contributor flow |
| *(no new folders)* | **Phase 4** | Competitive depth is new *modules inside existing folders* (matchmaking in game-server, new effects in sim-core) — by design, the structure absorbs it without growing |

## 7. Rules for Adding Files (Governance)

1. A new file must name the document section (GDD/ARCHITECTURE/this file) that justifies it — in its header comment and in the PR description.
2. A new *folder* requires an update to this document (version bump + revision entry) in the same change.
3. Nothing under `/packages/sim-core` may import from outside the package (except sibling files). Enforced by lint, verified by the headless test suite.
4. A file whose justification disappears (feature removed, doc amended) is deleted in the same change that removes the justification — structure rot is doc rot.
5. `docs/reviews/` files are immutable after commit; corrections are new dated files.

---

*End of FOLDER_STRUCTURE.md v1.0.0. Changes require a version bump and revision-history entry per project document rules.*
