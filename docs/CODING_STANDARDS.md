# CODING_STANDARDS.md
## Project Rebound — Coding Standards

| | |
|---|---|
| **Document version** | 1.0.0 |
| **Status** | Adopted working standard (maintainer-directed, 2026-07-20) — ratification entry pending maintainer sign-off |
| **Scope** | Binding standards for all code in this repository, all phases. Established **before the first line of production code**, so no code ever needs retrofitting to comply. Contains no implementation. |
| **Authority** | Subordinate to the governing documents (`AI_CONTEXT.md` reading order) and to `docs/FOLDER_STRUCTURE.md` for placement questions. Where a standard here conflicts with an architectural invariant, the invariant wins. |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-07-20 | AI assistant, maintainer-directed session | Initial standards |
| 1.0.1 | 2026-07-20 | AI assistant, maintainer-directed session | §2: test-placement rule extended — app-package tests colocate next to the module they guard |

---

## 0. The Four Meta-Rules

Every rule below serves one of these; when a case is unclear, decide by them:

1. **Write for the next reader** (AI_CONTEXT, Working Rule 9). Contributors and AI sessions arrive with zero context. Explicit beats clever, boring beats impressive, named beats anonymous.
2. **The codebase is a textbook** (maintainer directive, 2026-07-20). Every file must be *educational*: a beginner programmer reading the source top-to-bottom should come away understanding how the game works and why it was built this way. This is a natural extension of the Vision's openness value ("play, fairness, and craft are worth studying and sharing") — the code is part of the public receipts. §4 defines the mechanics.
3. **The determinism boundary is sacred.** Code inside `packages/sim-core` follows stricter rules than code outside it. Where this document says "sim-core:", that rule is load-bearing for fairness (GDD §12.7) — violating it is a correctness bug, not a style issue.
4. **Standards are enforced by machines where possible.** Anything lint/format/CI can check, lint/format/CI *does* check (§11). Humans review for meaning, not whitespace.

## 1. Naming Conventions (identifiers)

- **Types, interfaces, classes, enums, React components:** `PascalCase` — `PlayerState`, `SpeedCurve`, `ChunkQuery`, `PhaseBanner`. No `I`-prefix on interfaces (`Services`, not `IServices`); no `Abstract`/`Base` prefixes — name the concept, not the pattern.
- **Functions, methods, variables, parameters:** `camelCase` — `speedAt`, `latestCheckpoint`, `spawnProtectionTicks`. Functions are verbs or verb phrases (`applyEffect`, `generateChunk`); booleans read as predicates (`isAlive`, `hasShield`, `onGround` — never `flag`, `check`, `status`).
- **True constants** (compile-time, never reassigned, conceptually fixed): `SCREAMING_SNAKE_CASE` — `TICK_RATE`, `SIM_VERSION`, `LIVES_PER_MATCH`. Config *objects* holding tunables are `camelCase` values with `SCREAMING_SNAKE_CASE` leaf keys only where they are genuinely constant.
- **Enum members:** `PascalCase` (`Phase.ExtremeSurvival`). Prefer string-literal union types over enums in sim-core (serializes deterministically, diffs readably).
- **Generics:** meaningful names (`TEvent`, `TState`) — single-letter `T` only when the type is truly opaque.
- **Vocabulary comes from the GDD glossary (§15).** Code says `checkpoint`, `pickup`, `eliminated`, `liveBoard`, `edgeIndicator`, `match`, `room` — exactly as the glossary does, never synonyms (`respawnPoint`, `powerupCrate`, `dead`, `scoreboard`). If the glossary lacks a needed term, propose a glossary addition *first*; the doc names the thing, then the code does. Canonical power-up identifiers: `bomb`, `spikeTrap`, `slow`, `shield`, `speedBoost` (pending the A7/F2 terminology rulings; renames follow the docs).
- **Phase names** in code match GDD §8.5 exactly: `Normal`, `Faster`, `VeryFast`, `ExtremeSurvival` — never `Phase1..4` (the prototype's mistake).

## 2. File Naming

- **All source files:** `kebab-case.ts` — `spike-trap.ts`, `terrain-render.ts`, `best-runs.ts`.
- **React components:** `PascalCase.tsx`, filename = exported component — `Hud.tsx`, `PhaseBanner.tsx`. One component per file.
- **Tests:** `<unit>.test.ts` — the *name states what is being guaranteed*, e.g. `hash-equality.test.ts`, not `misc.test.ts`. Placement: sim-core guarantees live in the headless suite (`tests/determinism/` — its headlessness is itself the boundary proof); app-package tests (presentation math that can be pure, e.g. the camera) are colocated next to the module they guard inside that app's `src/`.
- **One primary export per file**, and the filename names it. A file that needs a vague name (`helpers.ts`, `utils.ts`, `misc.ts`) is a file that shouldn't exist — find the concept or inline the code (FOLDER_STRUCTURE §5: no grab-bags).
- **Documents:** `SCREAMING_SNAKE_CASE.md` for governing documents (existing convention), `kebab-case.md` for ADRs and design notes, `YYYY-MM-DD-kebab-case.md` for reviews.

## 3. Folder Naming

- **All folders:** `kebab-case`, singular for a concept (`terrain/`, `state/`), plural for a collection of peers (`effects/`, `migrations/`, `reviews/`).
- **New folders require a version-bumped update to `FOLDER_STRUCTURE.md` in the same change** (its governance rule 2). Folder names appear in that document's tree or they don't exist.
- No nesting deeper than 3 levels below a package's `src/` — depth that "organizes" is usually hiding a missing module boundary.

## 4. Comment & Educational Standards

The codebase teaches (Meta-Rule 2). Comments are therefore *lessons*, held to documentation quality — but never narration of syntax. The line between the two: an educational comment explains the **concept, the reason, and the gameplay rule**; a forbidden comment restates **what the next line literally does**. "`i++  // increment i`" is banned; "`Score accrues per tick survived, never per event — GDD §8.2 says score is driven by survival, so no action can ever be worth more than staying alive`" is the standard.

**4.1 File headers — mandatory, large, and structured.** Every source file begins with a documentation header that a beginner can learn from before reading any code:

```
/**
 * ============================================================
 *  <file name> — <one-line role>
 * ============================================================
 *  WHAT THIS FILE DOES
 *    2–5 sentences, in plain language, assuming no prior context.
 *  WHY IT EXISTS (design anchor)
 *    The governing document sections that demand it
 *    (e.g., GDD §8.5, ARCHITECTURE §2.2, ADR-0003).
 *  HOW IT FITS
 *    Who calls this, what it depends on, where it sits in the
 *    dependency arrow (apps → packages → nothing).
 *  WHAT IT MUST NEVER DO
 *    The boundary rules that protect it (e.g., "no rendering,
 *    no randomness outside rng.ts — this file is inside the
 *    determinism boundary").
 * ============================================================
 */
```

**4.2 Exported functions — full teaching block, no exceptions.** Every exported function/method carries TSDoc covering, in order: **Purpose** (what it accomplishes in gameplay terms), **Why it exists** (the design rule or system that demands it, with doc citation), **Inputs** (each parameter: meaning and units — "ticks", "world units", not just types), **Outputs** (what the return value means, including what `null`/empty means), **Side effects** (state mutated, events emitted — or the explicit words "Pure function: no side effects", which in sim-core is the expected answer), **Related systems** (which modules consume this, which GDD/ARCHITECTURE sections it implements). Internal helpers need Purpose + Inputs/Outputs at minimum when their role isn't obvious from the name.

**4.3 Non-trivial logic blocks — why + which rule.** Any block whose intent isn't obvious to a beginner (a formula, a branch encoding a game rule, an ordering that matters) gets a comment stating **why it exists** and **which gameplay rule it implements**, cited: `// Respawn placement comes from the chunk's checkpoint anchor, never from where the player died — GDD §8.4: respawns are safe by construction.` If a block has no rule to cite and no why to give, question the block, not the comment.

**4.4 The remaining rules:**

- **Never write comments that simply repeat the code.** Restating syntax is noise that trains readers to skip comments — the opposite of teaching. Deleted in review, always.
- **Doc-anchored decisions get doc-anchored comments** — this is how "receipts are public" reaches the source level.
- **`TODO` requires an owner and a pointer:** `// TODO(#42): pending C5 ruling on protection-vs-pickup.` Orphan TODOs fail review; a known defect is an issue, not a comment.
- **No commented-out code, ever.** Git is the archive.
- **Language: English**, full sentences, written for someone learning. (The prototype's Tagalog comments were fine for a personal prototype; production code must teach any contributor — Vision: "welcoming by design.")
- **Educational weight scales with importance:** sim-core files (where the game's rules live) carry the richest teaching; presentation and config files may be leaner, but never header-less.

## 5. Function Size Limits

- **Guideline: ≤ 40 lines. Hard limit: 60 lines** (blank lines and comments excluded). A function at the hard limit is presumed to be doing two jobs; the burden of proof is on keeping it whole.
- **One level of abstraction per function.** A function either orchestrates named steps or performs one step — not both.
- **≤ 4 parameters;** beyond that, pass a named options object whose type documents the call.
- **Cyclomatic complexity ≤ 10** (lint-enforced). The *exception* is the documented one: a sim-core step/resolve function may reach 15 where splitting would scatter a single documented rule across files — the exemption must be annotated with the doc section that defines the rule being implemented.
- Early returns over nested conditionals; no `else` after a returning `if`.

## 6. Class Size Limits

- **Guideline: ≤ 200 lines. Hard limit: 300 lines**, and **≤ 10 public members.** A class at the limit is a module wearing a trench coat — split along the documented responsibility seams.
- **Classes are for stateful lifecycles only** (a `Simulation`, a `GameHost`, a Phaser scene, a room actor). Everything else — and *most of sim-core* — is plain functions over plain data types: deterministic code is easiest to test, replay, and hash when state is data, not object graphs.
- **No inheritance in project code.** Composition and interfaces only. (Extending framework classes — Phaser's `Scene` — is the sole exception; one level, never chained.)
- One class per file (§2).

## 7. Module Responsibilities

The authoritative map is `FOLDER_STRUCTURE.md` §4; these are the coding-level consequences:

- **A module implements exactly one documented system** and its file header names it. If a change touches a system with no owning module, the *structure* discussion happens first (FOLDER_STRUCTURE governance), not an opportunistic placement.
- **sim-core:** pure deterministic logic. No I/O, no rendering, no networking, no framework imports, no wall-clock, no unseeded randomness, no engine-variant math (`Math.sin/cos/tan/pow/exp/log` banned — use the project's deterministic equivalents in `rng.ts`/lookup tables when they exist; ADR required to add one). All randomness flows from `rng.ts`; all time is the tick counter.
- **`apps/web/src/game/host.ts` is the only file that may import both sim-core and presentation.** Anything else needing both is a design error.
- **UI (React) contains zero gameplay logic** — it renders store snapshots and dispatches intents. **Presentation (Phaser) contains zero gameplay decisions** — it renders sim state and plays events; it may interpolate, never extrapolate rules.
- **services:** owns *all* persistence. No `localStorage`/network call exists outside a service implementation (the prototype's direct calls were the anti-pattern).
- A module's public surface is its `index.ts`; internals are private by structure, not by discipline.

## 8. Import Rules

- **The dependency arrow (`apps → packages → nothing`) is law**, lint-enforced: nothing under `packages/` imports from `apps/`; nothing under `packages/sim-core/` imports any other package or any framework; `services` may import sim-core *types* only.
- **Banned imports/APIs under `packages/sim-core`** (lint-enforced, CI-gated): `phaser`, `react`, `socket.io*`, `zustand`, DOM globals, `Math.random`, `Date`, `performance`, `setTimeout`/`setInterval`, the banned `Math.*` functions above.
- **No deep imports across packages:** consumers import `@rebound/sim-core`, never `@rebound/sim-core/src/terrain/generator`. The public surface is the contract.
- **No circular imports** anywhere (lint-enforced). A cycle means a missing shared module or a wrong split.
- **Import order** (auto-sorted, not hand-tended): node/builtin → external → workspace packages → relative. `import type` for type-only imports, always.
- **Adding an external dependency is a decision, not a reflex:** it requires a one-paragraph justification in the PR (what it does, why not write it, license, size) — solo-maintainer sustainability and "no tracking-heavy dependencies" (AI_CONTEXT) both hang on a short dependency list. New runtime deps in sim-core: effectively never (an ADR would be required).

## 9. Documentation Requirements

- **Public API surfaces carry the full teaching block of §4.2** (Purpose / Why it exists / Inputs / Outputs / Side effects / Related systems). Internal helpers follow §4.2's reduced form.
- **Every package has a `README.md`** (one screen max): what it is, what it must never become, its place in the dependency arrow.
- **Decisions with rejected alternatives become ADRs** in `docs/adr/` (numbered, immutable once accepted) — the code cites the ADR, the ADR cites the governing docs.
- **Tunable changes are visible changes:** any change to gameplay constants or curve values bumps `SIM_VERSION` and states the intent in the commit/PR — feel changes are deliberate, never incidental (roadmap M9).
- **Docs move with code in the same change:** if a change makes any governing document false, the same PR updates the document (version bump + revision entry) or it doesn't merge. This is the mechanical form of "documents are law."
- Commit messages: imperative summary line ≤ 72 chars; body explains why; references issues/ADRs/doc sections touched.

## 10. Error Handling Rules

- **In sim-core, expected game outcomes are *states*, never exceptions.** Death, elimination, failed pickup, absorbed effect — these are values in the returned state/events. `throw` in sim-core is reserved for **invariant violations** (corrupted state, impossible tick input) — programmer errors that must fail fast, loudly, and deterministically (same input → same throw).
- **Validate at boundaries, trust inside.** External data (stored traces, network messages, URL params) is validated at the edge — zod guards in `protocol`, versioned parsing in `services`. Past the boundary, types are trusted; re-validation noise inside sim-core is itself a smell.
- **Services return typed results for expected failures** (`{ ok: true, value } | { ok: false, reason }`); exceptions are for the unexpected. Callers must handle the `reason` branch — no floating promises, no ignored results (lint-enforced).
- **No silent `catch`.** Every catch block either handles meaningfully, converts to a typed result, or rethrows with context. `catch {}` fails review unconditionally.
- **Presentation never crashes the loop:** render/audio failures degrade (skip the effect, log once) — but they *never* mask sim errors, which must surface.
- **Player-facing failure is honest failure** (Vision: no mechanic may deceive; defeat must be legible). Error UX names what actually happened — "connection lost," "couldn't save your run" — never a generic shrug, and never a lie that shifts blame to the player.
- **A red determinism test is a stop-ship invariant violation**, not an error to handle. CI treats it as such.

## 11. Formatting Rules

- **Prettier owns formatting. Nobody argues with it, nobody hand-formats around it.** Configuration (locked at repo root): 2-space indent; single quotes; semicolons on; trailing commas `all`; print width 100; LF line endings (`.editorconfig` agrees).
- **ESLint owns correctness-adjacent style** and the structural rules above (banned imports, complexity, no-cycles, no-floating-promises, exhaustive switches on union types — exhaustiveness matters in sim event handling).
- **`strict: true` TypeScript everywhere,** plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in sim-core. **`any` is banned** (lint); `unknown` + narrowing at boundaries. `as`-casts require a comment justifying why the type system can't know better.
- **Format + lint run in CI and block merge.** A PR with formatting noise gets auto-fixed, not reviewed; a PR mixing reformatting with logic changes is split.
- Numbers in sim-core that are *tunables* live in `constants.ts` — a bare magic number in sim logic fails review; a named constant with a doc citation passes.

## 12. Enforcement Summary

| Standard | Enforced by |
|---|---|
| Formatting, import order | Prettier + lint, CI-blocking |
| Banned imports/APIs in sim-core, dependency arrow, cycles | ESLint rules, CI-blocking |
| Complexity, function/class limits | ESLint (`max-lines-per-function`, `complexity`, `max-lines`), CI-blocking |
| Determinism | `tests/determinism` suite — red = stop-ship |
| File-header presence, TSDoc presence on exports | Lint (`jsdoc`/header rules), CI-blocking |
| Educational quality (§4.1–4.3 content), TODO ownership, naming-vs-glossary | Human review (PR checklist in the template, Phase 3) |
| Doc/code co-movement, ADR discipline | Human review + AI_CONTEXT Working Rule 4 |

---

*End of CODING_STANDARDS.md v1.0.0. Changes require a version bump and revision-history entry. The lint/format configurations that mechanize these rules are implementation artifacts (Phase 1, roadmap Step 1) and must match this document; where they drift, this document wins and the configs are fixed.*
