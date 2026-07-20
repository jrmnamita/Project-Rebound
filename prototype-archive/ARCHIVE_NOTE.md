# prototype-archive/ — the original "Bounce Runner" prototype (frozen)

**What this is:** the single-file vanilla-JS/CSS prototype that predates Project Rebound's governing documents. It is **not** part of the production game and is **not** a source of truth. It is kept here as a historical and game-feel reference only.

**Files:** `index.html` (a self-contained monolith — its own copy of all classes), plus the unused ES modules `game.js`, `entities.js`, `level.js`, `physics.js`, the `style.css`, `bg.png`, and `manifest.json`.

**Why it was archived (not deleted):** per the refactoring roadmap and AI_CONTEXT, the prototype's *techniques* (squash/stretch, particle bursts, screen shake, the tap/hold-jump feel) are worth preserving as a reference while the production build calibrates its own DRAFT tunables (roadmap Step 3). Its *code* is superseded wholesale by the monorepo (`packages/` + `apps/web`).

**Why it is NOT at the repository root anymore:**
- Its branding ("Bounce Runner", "Inspired by Nokia Bounce") contradicts the identity rules in the GDD and ARCHITECTURE §2.7 ("not a remake"; identity starts from zero).
- It contradicts the documented architecture on nearly every point and would confuse anyone reading the repo. Full audit: `docs/reviews/2026-07-20-prototype-audit.md`.

**Do not:** extend it, import from it, deploy it, or treat any of its behavior as a design decision. The Netlify demo serves `apps/web/dist`, never these files.

**When to delete entirely:** once feel calibration against this prototype is complete and signed off (roadmap Step 9), this whole folder may be removed. Until then it stays, frozen.
