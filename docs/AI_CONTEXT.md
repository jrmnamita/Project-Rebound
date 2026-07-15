# AI_CONTEXT.md
### Entry point for AI assistants working on this repository

**Read this file first, completely, before doing anything else.** It tells you what this project is, where authoritative information lives, and how you are expected to work here. It intentionally contains almost no game or technical detail — it routes you to the documents that do. Keep it that way: **never duplicate content from other documents into this file; link to them instead.**

---

## Purpose

This repository is **Project Rebound** (working title): an original open-source competitive arcade game — portrait, one-thumb, up to 4-player live multiplayer. This file exists because AI assistants join this project with no memory. Conversation history is never the project's memory; **version-controlled documents are.** If you learn something important during a session that isn't in a document, your job includes proposing a documentation update — otherwise the knowledge dies with the chat.

## Current Project Status

**Documentation phase — pre-implementation. There is no game code yet.**

Approved so far: the Architecture Proposal (v3), the Game Design Document (v1.1.0), and the README. Nothing else is decided. Do not assume any code, tooling, or infrastructure exists until you can see it in the repository.

> ⚠️ **Maintenance note:** this section and the three sections at the bottom (Current Milestone, Current Priorities, Next Immediate Task) must be updated as the project moves. If they contradict the state of the repository, trust the repository and flag the discrepancy.

## Reading Order

Read in this order — earlier documents outrank later ones when they conflict:

1. **`AI_CONTEXT.md`** (this file) — how to work here.
2. **`docs/PROJECT_VISION.md`** — the founding vision; the supreme authority on what the game must be. *(Pending: until it exists, the GDD carries its content.)*
3. **`docs/GAME_DESIGN_DOCUMENT.md`** — the design source of truth: every rule, system, principle, and pillar. Pay special attention to **§2A Core Design Principles** and **§12 Design Pillars** — they veto everything else.
4. **`docs/ARCHITECTURE.md`** — the technical source of truth: system design, simulation model, networking, and the rationale behind each decision. *(Pending consolidation: until it exists, Architecture Proposal v2 + the v3 delta together are authoritative, with v3 overriding v2 where they differ.)*
5. **`docs/ROADMAP.md`** — milestones and sequencing. *(Future.)*
6. **`README.md`** — the public summary; useful for tone, not for decisions.

For any question of **what the game should do** → GDD. For **how it is built** → ARCHITECTURE. If a needed answer exists in neither, it is an open question: raise it, don't invent it.

## Current Milestone

**Milestone 0 — Documentation Foundation.** Establishing the complete document set before the first line of implementation. Implementation Phase 1 ("Foundation & Practice" — see the roadmap summary in `README.md`) begins only after the maintainer explicitly approves the start of coding.

## Current Priorities

1. Complete the remaining foundation documents: `docs/PROJECT_VISION.md`, consolidated `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.
2. Keep all approved documents mutually consistent (a change in one may ripple; check).
3. Nothing else. Do not start implementation, scaffolding, or dependency setup unprompted.

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
8. **Update the "living" sections of this file** (Status, Milestone, Priorities, Next Task) when your work changes them — with the maintainer's confirmation.
9. **Write for the next reader.** Your output will be consumed by future humans and future AIs with zero context. Prefer explicit over clever.

## Technology Summary

TypeScript end to end. Frontend: React + Phaser + Tailwind, built with Vite, hosted on Netlify, wrapped with Capacitor for mobile. Multiplayer server: Node.js + Socket.IO, self-hosted Linux → VPS. Data/auth/storage: Supabase (anonymous-first). The frontend must always run fully without any backend (demo/practice mode). **All architectural detail, rationale, and constraints: `docs/ARCHITECTURE.md` — do not make technical decisions from this summary alone.**

## Repository Structure

Planned layout (only `docs/` and root documents exist during Milestone 0):

```
/docs           ← all governing documents (see Reading Order)
/packages       ← sim-core, protocol, services, services-remote   (future)
/apps           ← web, mobile, game-server                        (future)
/supabase       ← database migrations & policies                  (future)
/tests          ← determinism suite, e2e                          (future)
README.md       ← public landing page
AI_CONTEXT.md   ← this file
```

The authoritative structure definition and package responsibilities live in `docs/ARCHITECTURE.md`. If the actual tree diverges from this sketch, trust the tree and flag it.

## Next Immediate Task

**Create the remaining foundation documents, in this order:**

1. `docs/PROJECT_VISION.md` — commit the maintainer's founding vision statement (it exists as an approved text; it needs to be placed in the repo verbatim with a version header).
2. `docs/ARCHITECTURE.md` — consolidate Architecture Proposal v2 + v3 delta into one coherent document (v3 overrides v2 on conflicts), with an ADR-style record of major decisions.
3. `docs/ROADMAP.md` — expand the README's four-phase summary into concrete milestones.

Do not begin any of these — or anything else — without the maintainer's go-ahead in the current session. When all three exist and are approved, Milestone 0 is complete and this section must be rewritten for Milestone 1.

---

*This file is part of the project's governing documentation. Keep it short, keep it current, keep it honest.*
