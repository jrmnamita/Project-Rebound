# AI_CONTEXT.md
### Entry point for AI assistants working on this repository

**Read this file first, completely, before doing anything else.** It tells you what this project is, where authoritative information lives, and how you are expected to work here. It intentionally contains almost no game or technical detail — it routes you to the documents that do. Keep it that way: **never duplicate content from other documents into this file; link to them instead.**

---

## Purpose

This repository is **Project Rebound** (working title): an original open-source competitive arcade game — portrait, one-thumb, up to 4-player live multiplayer. This file exists because AI assistants join this project with no memory. Conversation history is never the project's memory; **version-controlled documents are.** If you learn something important during a session that isn't in a document, your job includes proposing a documentation update — otherwise the knowledge dies with the chat.

## ⏩ IF YOU ARE RESUMING THIS PROJECT — read this first

You (human or AI) are picking up a project whose **Phase 1 foundation is fully built, tested, and playable**. Do not re-plan or rebuild it. Orient yourself in this order:

1. **`ClaudeContext.md`** (repo root) — the single-page handoff: final verdict, what exists, what's blocking a public release, how to run it. Start here.
2. **This file** — how to work here and where authority lives (the Reading Order below).
3. **`docs/reviews/`** — dated, immutable reports: the documentation review (open rulings A1–F2), the prototype audit, the refactoring roadmap, and **`2026-07-20-phase1-production-readiness.md`** (the ranked issue list) + the gate review. These are the "what's wrong and what's left" record.
4. **`docs/project-roadmap-gantt.html`** — the visual timeline through public launch, multiplayer, and mobile.
5. **`docs/adr/`** — the two closed maintainer rulings (0001 shared-world effects, 0002 crater healing).

**Golden rule unchanged:** documents are law, the repository is the source of truth. If this file and the code ever disagree, trust the code and fix this file.

## Current Project Status (as of 2026-07-20)

**Milestone:** Phase 1 (Foundation & Practice) implementation is **COMPLETE**. The twelve-module sequence the maintainer directed — Input → Player → Physics → Level → Camera → Procedural → UI → Audio → Game Loop → Networking(wire contract) → Effects → Utilities — is all built.

**Verified state:** 173/173 tests green across five packages (`sim-core`, `protocol`, `services`, `web`, `tests/determinism`); all typecheck clean under full strict mode; production Vite build succeeds; **the game is playable offline** (`pnpm install` then `pnpm --filter @rebound/web dev`). Determinism is proven end-to-end (record → replay → identical statehash).

**What the build IS:** offline solo practice — the jump, accelerating 4-phase world, seeded terrain, spikes/hazards/checkpoints, 3 lives + respawn + spawn protection, monotonic score, results + two-tap rematch, all five power-ups (sim-verified; they fizzle in solo with no rival to target), synthesized audio, local best-score persistence.

**What the build is NOT yet:** multiplayer (the Node game server is Phase 2 — only the wire-contract package `protocol` exists, no server); calibrated feel (all tunables are DRAFT, never playtested); mobile (Phase 3).

**Being prepared now:** upload to GitHub + a **Netlify solo-practice demo** (frontend is static, zero backend — `netlify.toml` at repo root configures the build). Before the repo goes *public*: add a `LICENSE` (README says all-rights-reserved until one exists) and refresh the README (its "nothing playable yet" line is stale) — see the four release blockers in the gate review.

**Closed by maintainer ruling:** ADR-0001 (terrain effects hit the shared world), ADR-0002 (craters/traps heal ~4 s; checkpoint pads immune).
**Still open (flagged, not invented):** A8/C1 multiplayer match termination, B1 room lifecycle — both gate real Phase 2; C2/C5 live as flagged working defaults in code. See `docs/reviews/2026-07-20-documentation-review.md`.

**Known debts before production** (full ranked list in `docs/reviews/2026-07-20-phase1-production-readiness.md`): no LICENSE/CONTRIBUTING/CI/ESLint yet; `replayTrace` ignores curve/generation params (latent — fix before trusting validation); `Simulation.step()` exceeds the size limit; terrain generation re-runs jump metrics per chunk; HUD reads storage ~10×/s; cross-engine determinism asserted but not tested; GDD version discrepancy + §11.3 amendment owed; ARCHITECTURE not yet consolidated; ROADMAP.md absent; prototype not yet archived.

A legacy single-file prototype ("Bounce Runner": `index.html` plus four unused ES-module files at the repository root) **exists but is NOT the source of truth**. It predates the governing documents, contradicts them on nearly every governed point (full audit: `docs/reviews/2026-07-20-prototype-audit.md`), and is scheduled for archival to `/prototype-archive` after its game-feel notes are extracted. Do not extend it; do not treat its behavior as a design decision.

Approved so far: `PROJECT_VISION.md` (v1.0.0), the Game Design Document (v1.0.0 on disk — an earlier revision of this file cited v1.1.0; version reconciliation needs a maintainer ruling), the Architecture Proposal v3 delta (note: its referenced v2 baseline is **missing from the repository**; consolidation into a single `docs/ARCHITECTURE.md` is the top documentation task), and the README.

As of 2026-07-20 the maintainer has directed that this file's living sections be updated **in real time** as project state changes.

> ⚠️ **Maintenance note:** this section and the three sections at the bottom (Current Milestone, Current Priorities, Next Immediate Task) must be updated as the project moves. If they contradict the state of the repository, trust the repository and flag the discrepancy.

## Reading Order

Read in this order — earlier documents outrank later ones when they conflict:

1. **`AI_CONTEXT.md`** (this file) — how to work here.
2. **`docs/PROJECT_VISION.md`** — the founding vision; the supreme authority on what the game must be. *(Exists; approved v1.0.0.)*
3. **`docs/GAME_DESIGN_DOCUMENT.md`** — the design source of truth: every rule, system, principle, and pillar. Pay special attention to **§2A Core Design Principles** and **§12 Design Pillars** — they veto everything else.
4. **`docs/ARCHITECTURE.md`** — the technical source of truth: system design, simulation model, networking, and the rationale behind each decision. *(Currently the Proposal v3 delta only; the v2 baseline it references is missing from the repo. Until consolidation, v3 is authoritative for everything it covers, and anything it defers to v2 is an open question to flag, not to invent.)*
5. **`docs/ROADMAP.md`** — milestones and sequencing. *(Future.)*
6. **`README.md`** — the public summary; useful for tone, not for decisions.

For any question of **what the game should do** → GDD. For **how it is built** → ARCHITECTURE. If a needed answer exists in neither, it is an open question: raise it, don't invent it. Known open rulings are tracked in `docs/reviews/2026-07-20-documentation-review.md`.

## Current Milestone

**Milestone 0 — Documentation Foundation.** Establishing the complete document set before the first line of implementation. Now includes: resolving the design ambiguities flagged in the 2026-07-20 documentation review, consolidating ARCHITECTURE, and archiving the legacy prototype. Implementation Phase 1 ("Foundation & Practice" — see the roadmap summary in `README.md`) begins only after the maintainer explicitly approves the start of coding.

## Repository Philosophy

- **Documents are law; conversations are scratch paper.** Every decision worth keeping gets written into a versioned document with a revision-history entry.
- **Long-term maintainability over speed.** This is a solo-developer, long-horizon open-source project. Never choose a shortcut that forces a future rewrite of a major system.
- **Modular and replaceable.** Every major system sits behind an interface. Gameplay logic, networking, rendering, and UI are strictly separated (details: ARCHITECTURE).
- **Don't over-engineer.** Interfaces where the future needs seams; simplicity everywhere else. When in doubt, choose the option a solo developer can maintain.
- **Player respect is structural.** Free, no ads, no pay-to-win, anonymous play always possible. This shapes technical decisions too (e.g., no tracking-heavy dependencies).

## Things That Must Never Change

The complete, authoritative list is **GDD §12 (Design Pillars)** — read it. Headlines, so you never violate one before reading it: jumping is the only gameplay input; one-thumb portrait play; auto-forward movement; horizontal world through a portrait camera; no player collision; skill beats power-ups and luck; identical worlds and framing for all players in a match; endless escalation with no finish line; score never decreases; no monetization beyond optional donations; 2–5 minute matches with instant rematch. On the technical side, ARCHITECTURE's foundational invariants (deterministic simulation core independent of the rendering engine; simulation/network/render/UI separation) are equally protected. **If a request conflicts with any of these, stop and say so rather than complying.**

## AI Working Rules

1. **Never write code unless the maintainer explicitly asks for it in the current session.** This project's history includes multiple deliberate "design only, no code" phases. Respect the current phase.
2. **Check proposals against GDD §2A and §12 first**, before investing effort. If a request conflicts, surface the conflict — the maintainer decides.
3. **Do not invent features, rules, or numbers.** If it isn't in a document, it's undecided. Flag open questions; recommend, don't presume.
4. **Follow document rules:** any document change requires a version bump and revision-history entry. Pillar/principle changes additionally require explicit maintainer sign-off. Do not renumber existing sections or break cross-references when amending.
5. **Wait for approval at phase boundaries.** The maintainer approves documents and phases explicitly. Deliver, then stop.
6. **Ask when contradicting information appears.** If two sources (documents, code, instructions) disagree, ask the maintainer to clarify rather than choosing silently.
7. **Keep separation sacred in any future code:** no gameplay logic in rendering, no networking in gameplay, no UI in either. Determinism rules (no wall-clock, no unseeded randomness in the simulation) are non-negotiable.
8. **Update the "living" sections of this file** (Status, Milestone, Priorities, Next Task) when your work changes them — the maintainer authorized real-time updates on 2026-07-20; record the date on each update.
9. **Write for the next reader.** Your output will be consumed by future humans and future AIs with zero context. Prefer explicit over clever.

## Technology Summary

TypeScript end to end. Frontend: React + Phaser + Tailwind, built with Vite, hosted on Netlify, wrapped with Capacitor for mobile. Multiplayer server: Node.js + Socket.IO, self-hosted Linux → VPS. Data/auth/storage: Supabase (anonymous-first). The frontend must always run fully without any backend (demo/practice mode). **All architectural detail, rationale, and constraints: `docs/ARCHITECTURE.md` — do not make technical decisions from this summary alone.**

## Repository Structure

The authoritative final production structure — every folder, every file, and the reason each exists — is defined in **`docs/FOLDER_STRUCTURE.md`** (adopted 2026-07-20; structure materializes per phase). Summary sketch:

```
/docs           ← all governing documents, ADRs, design notes, dated reviews
/packages       ← sim-core, services, protocol, services-remote
/apps           ← web, game-server, mobile
/supabase       ← database migrations & policies                  (Phase 2)
/tests          ← determinism suite, e2e
README.md       ← public landing page
```

The current tree does not yet match: the repo root still holds the legacy prototype files (see Current Project Status). If the actual tree diverges from FOLDER_STRUCTURE.md in ways not explained there, trust the tree and flag it.

## Current Priorities

1. **Maintainer rulings** on the blocking design ambiguities flagged in `docs/reviews/2026-07-20-documentation-review.md` — foremost: identical-world pillar vs. per-player terrain effects (A4), crater lifetime (C4), match termination totality (A8/C1), power-up activation default confirmation, spawn-protection scope (C5).
2. Complete the remaining foundation documents: consolidated `docs/ARCHITECTURE.md` (v2+v3), `docs/ROADMAP.md` (seed: `docs/reviews/2026-07-20-refactoring-roadmap.md`).
3. Extract prototype feel-notes to `docs/design-notes/`, then archive the prototype to `/prototype-archive`.
4. Keep all approved documents mutually consistent (a change in one may ripple; check).
5. Nothing else. Do not start implementation, scaffolding, or dependency setup unprompted.

## Next Immediate Task

**Implementation proceeds one module at a time, in the maintainer's declared order** (2026-07-20): Input System ✅ → Player ✅ → Physics ✅ → Level ✅ → Camera ✅ → Procedural ✅ → UI ✅ → Audio ✅ → Game Loop ✅ → Networking ✅ (protocol seam; server = Phase 2) → Effects ✅ → Utilities ✅ — **sequence complete**. Do not start a module without the maintainer's go-ahead for that module. Each module must follow FOLDER_STRUCTURE.md, CODING_STANDARDS.md (including the educational mandate, §4), and ship with its determinism-suite coverage green.

**In parallel, the outstanding Milestone 0 items remain owed:**

1. Maintainer rulings on the five blocking ambiguities (Priority 1 above) — **required before the Match-rules and Effects work**; record each as an ADR and amend the affected documents with version bumps.
2. Consolidate `docs/ARCHITECTURE.md` (v2 + v3 delta; v3 wins conflicts). If v2 cannot be recovered, reconstruct its deferred sections as explicit proposals for maintainer approval.
3. Write `docs/ROADMAP.md` from the README's four-phase summary and the 2026-07-20 refactoring roadmap.
4. Capture `docs/design-notes/feel-reference.md` and `prototype-behavior-checklist.md`; archive the prototype.

---

*This file is part of the project's governing documentation. Keep it short, keep it current, keep it honest. Living sections last updated: 2026-07-20 (status reconciled with repository; structure doc adopted; review reports linked).*
