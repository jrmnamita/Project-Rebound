# Prototype Code Audit — vs. Governing Documentation
**Date:** 2026-07-20 · **Status:** Session report — informational, not a governing document · **Immutable after commit**

**Scope:** `physics.js`, `entities.js`, `level.js`, `game.js`, and the inline script in `index.html`. Baseline: GDD v1.0.0, ARCHITECTURE v3 delta, PROJECT_VISION v1.0.0. The prototype is evidence, not authority.

**Critical structural finding:** `index.html` does **not** load the four module files — it contains a complete inline duplicate of all classes. The ES modules are dead code, and the two copies have already drifted (landing threshold `localY < 20` vs `< 35`; `vy > 0` vs `vy >= 0`; different side-collision death guards). `game.js` uses `Particle` without importing it → the module build would crash with a ReferenceError on first death if ever executed. `style.css` is likewise never linked (dead).

---

## 1. physics.js
- **Purpose:** `CONFIG` tunables, unused `Vector`, circle-vs-rotated-rect collision for sloped platforms.
- **Matches:** tap/hold-cut jump constants (§6.1 in spirit); INITIAL/MAX speed echoes escalation; slope-capable collision (§6.2).
- **Violates:** unversioned flat config, no simVersion; no named speed curve (§8.5); per-frame trig vs. determinism discipline; duplicated wholesale in index.html (two sources of truth).
- **Temporary:** dead `Vector`, unused `FRICTION`, stale tuning comments.
- **Risks:** silent divergence between CONFIG copies; collision heuristics consumed with different thresholds by the two copies.
- **Refactor:** retire; re-express as sim-core constants + curve + rng; height-field terrain removes per-frame trig.

## 2. entities.js
- **Purpose:** Ball (physics + rendering), Platform, Particle, Spike (static/moving).
- **Matches:** ground-only jump, no double jump/air control; release-cut jump; auto-forward; squash/stretch & pop = reusable juice techniques (ARCH §2.7).
- **Violates:** sim and render fused in every class (constitutional separation); hold does not scale height up to a cap (§6.1 partial); moving spikes not in vocabulary (§6.2); no lives/protection/checkpoint fields (§8.3–8.4); Math.random beside gameplay classes.
- **Temporary:** hardcoded palette; dead `initialX`; inline interpolation constants.
- **Risks:** frame-rate-dependent physics (rAF-driven update) — a 120 Hz device plays a different game, fatal to Pillar 7 and replay validation; renderer-coupled state blocks headless sim.
- **Refactor:** split into sim-core player module (pure step, input intents, match state) + presentation sprites; salvage feel coefficients as written reference.

## 3. level.js
- **Purpose:** streaming random terrain (platforms/gaps/slopes/spikes) + parallax background.
- **Matches:** endless generate-ahead/prune-behind pattern (§6.2, Pillar 8); slopes and gaps in vocabulary; spike ramp echoes content-difficulty-by-distance.
- **Violates:** unseeded Math.random throughout — the disqualifying violation (no shared worlds, daily, ghosts, validation, fairness); no (seed, chunkIdx, simVersion) chunk identity; **no checkpoints at all** (generator artifacts by architectural decision); missing floating platforms, hazard zones, large-gap taxonomy, pickups; gap width keyed to current speed instead of content-to-distance/speed-to-clock; no survivable-by-construction guarantee.
- **Temporary:** prototype-era `bg.png` (identity restarts from zero, ARCH §2.7); inline magic numbers; module/inline drift.
- **Risks:** unclearable random compositions read as "the game cheated me" (a Vision failure state); pruning behind `ballX` deletes ground a respawning player needs once checkpoints exist.
- **Refactor:** full replacement by seeded chunked generator with complete vocabulary, checkpoint/pickup artifacts, clearability constraints from jump metrics; parallax to presentation. Keep only the streaming-window pattern (prune behind earliest live checkpoint).

## 4. game.js
- **Purpose:** orchestrator — state machine, input, per-frame update/draw, score/phase/speed, collision resolution, camera, DOM HUD, localStorage.
- **Matches:** press/release maps 1:1 to input intents (§6.1); one-tap restart honors rematch spirit (§7); score only rises while alive; preventDefault touch (one-thumb awareness).
- **Violates:** one death = game over (no lives/checkpoints/respawn/protection/elimination — §8.3–8.4 absent); 3 unnamed score-keyed phases vs. 4 named match-clock phases (§8.5 structurally wrong); `score += 0.1` per *frame* → frame-rate-dependent scoring (§8.2, Pillar 7); slope-pull `vx += sin*0.5` lets terrain alter forward speed (Pillars 3/7 — desyncs any shared clock); variable-timestep rAF, no fixed 60-tick + interpolation (ARCH invariant); fixed 200 px camera anchor in 1200×800 landscape-max container (§6.3, ARCH §2.1); localStorage direct in game logic; DOM writes in the loop (UI ⟂ gameplay); side-collision "walls kill" rule exists in no document.
- **Temporary:** `setTimeout(1500)` game-over delay; hardcoded phase colors; naive resize handler.
- **Risks:** **crashes if ever run** (Particle not imported) — proof the module build is unexercised; behavioral drift vs. inline copy = two subtly different games; mid-run resize silently changes generation/camera math.
- **Refactor:** dissolve into documented roles: match rules → sim-core; loop/timing → GameHost; drawing → Phaser; HUD/menus → React. Survives only as a behavior checklist.

## 5. index.html (inline script)
- **Purpose:** the complete, self-contained, actually-executed game.
- **Matches:** runs with zero backend/build (accidental echo of the offline mandate); same partial matches as modules; its landing logic is the more playable variant.
- **Violates:** everything above, plus identity: "Bounce Runner | Retro Arcade," "Inspired by Nokia Bounce" (GDD §1 "not a remake," ARCH §2.7 naming-from-zero); `bounce-best` storage key bakes in old identity; landscape-max layout (Pillars 2/4); full duplicate of all gameplay code — maximal single-source violation, drift already realized.
- **Temporary:** inline CSS/JS monolith; Google Fonts dependency; PWA manifest link with no documented plan.
- **Risks:** ambiguity about which copy defines "prototype behavior"; fixes to modules invisible in the running game; shipping anything derived propagates Bounce-derived branding into public history.
- **Refactor:** retire first. Before deletion extract: (1) game-feel reference (squash/stretch factors, particle counts, shake magnitude/decay, landing-threshold feel comparison); (2) behavior checklist as Phase 1 regression context.

---

## Overall Verdict

The prototype validates one thing the documents care about: a tap/hold jump against auto-scrolling slope terrain is fun enough to build on. Architecturally it is a photographic negative of the documentation — every foundational invariant is absent or inverted, and its two divergent copies mean it is not even a single reference implementation. Per ARCH §2.7: its techniques are salvageable as written references; its code is not a foundation. The Phase 1 build supersedes it wholesale; no incremental refactor.
