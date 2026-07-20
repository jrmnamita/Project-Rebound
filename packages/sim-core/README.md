# @rebound/sim-core

**What it is:** the deterministic heart of Project Rebound. Every gameplay rule — the jump, the terrain, lives, checkpoints, the speed curve, power-up effects — is decided here and only here. Given the same seed and the same inputs, this package produces bit-identical results on every machine, every time. That property is what makes shared worlds, replay validation, ghosts, and the fairness pillar (GDD §12.7) possible.

**Its place in the dependency arrow:** `apps → packages → nothing`. sim-core imports **no other package and no framework**. Renderers, servers, and tests all observe it; it observes nothing.

**What it must never become:** anything that knows about screens, networks, clocks, or browsers. Banned inside this package: `Math.random`, `Date`, timers, DOM globals, Phaser/React/Socket.IO imports, and engine-variant math functions (`Math.sin/cos/tan/pow/exp/log`). All randomness flows from `rng.ts` (when it exists); all time is the tick counter. See `docs/CODING_STANDARDS.md` §7–§8.

**How it is tested:** headlessly, by `tests/determinism` — which is itself the proof that no rendering dependency has leaked in.
