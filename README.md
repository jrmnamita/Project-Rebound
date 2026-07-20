# Project Rebound *(working title)*

> The final public game title may change before release. Identity and art direction are a deliberate later pass.

An original competitive arcade survival game, played in portrait with one thumb. Open source. Free forever. No ads.

## Elevator Pitch

Four players. One accelerating world. One button.

Project Rebound is an endless side-scrolling survival game viewed through a narrow portrait camera. Your character rolls forward automatically — all you control is the jump: tap for a normal jump, hold for a higher one. Slopes, gaps, floating platforms, and spikes rush toward you faster and faster until the world's speed finally breaks everyone. Outlast your rivals, outscore them, and complicate their lives with lightweight power-ups — you can never touch them, but you can definitely ruin their afternoon. Matches last 2–5 minutes. Losing one makes you want another.

Inspired by the physicality of classic ball-bounce platformers, but an original game with its own identity — not a remake of anything.

## Current Development Status

🎮 **Phase 1 (Foundation & Practice) is complete and playable offline.** The full deterministic game core, portrait presentation, and solo-practice match run end to end — 173 automated tests passing across five packages, production build verified. See [`ClaudeContext.md`](./ClaudeContext.md) for the exact state and what remains.

- ✅ **Playable now:** offline solo practice — the tap/hold jump, the accelerating four-phase world, procedurally generated terrain, checkpoints, 3 lives, scoring, results and instant rematch.
- 🚧 **Not yet:** live multiplayer (Phase 2 — the game server is designed and the wire protocol is built, but the server itself is next), and mobile (Phase 3). Feel tuning is still draft, pending playtest.

This means the **Netlify demo runs the solo game**; the four-player rooms described below arrive with Phase 2.

## Features

**Core gameplay — built and playable**

- One-input controls: tap = jump, hold = higher jump — the entire control scheme
- Endless procedurally generated terrain: slopes, hills, gaps, floating platforms, spikes, hazard zones
- A signature escalating speed curve: Normal → Faster → Very Fast → Extreme Survival
- 3 lives per match with checkpoint respawns — score is never lost
- Fully deterministic simulation (record → replay → identical result), the foundation of fair play
- Fully playable with one thumb, in portrait

**Multiplayer — designed, Phase 2**

- Live rooms of up to 4 players racing the identical world at the identical speed
- Visible rivals with off-screen indicators — real competitors, never ghosts
- No body collision: competition through score, survival, and power-ups (Bomb, Spike Trap, Shield, Speed Boost, Slow — all five already implemented in the simulation core)
- An always-visible live match leaderboard that updates in real time
- Last player alive wins — or highest score if the world takes everyone
- Instant rematch: the next game is always two taps away

**Solo practice — built**

- The same game, offline-capable, no account needed. (Best-run ghost racing and daily challenge worlds are planned — the replay mechanism that powers them already exists.)

## Running the Project

Requires **Node.js 20+** and **pnpm 9+** (`npm install -g pnpm` if you don't have it).

```bash
pnpm install
pnpm --filter @rebound/web dev
```

Open the local URL Vite prints (default http://localhost:5173). Tap / click / press **Space** to jump; hold for a higher jump.

The frontend runs **entirely without a backend** — solo practice works fully offline and is the live demo. To run the whole test suite: `pnpm test`. To build the static site (what Netlify deploys): `pnpm --filter @rebound/web build` (output in `apps/web/dist`).

## Documentation

All project decisions live in version-controlled documents, not in anyone's head. New contributors (human or AI) should start with **[`ClaudeContext.md`](./ClaudeContext.md)** and **[`docs/AI_CONTEXT.md`](./docs/AI_CONTEXT.md)**.

| Document | Purpose |
|---|---|
| `ClaudeContext.md` | One-page handoff: current state, what's built, what's left, how to run |
| `docs/AI_CONTEXT.md` | Entry point for anyone resuming the project — routing and working rules |
| `docs/PROJECT_VISION.md` | The founding vision: why this game exists and the experience it must deliver |
| `docs/GAME_DESIGN_DOCUMENT.md` | **The design source of truth** — rules, scoring, lives, multiplayer, power-ups, and the pillars that must never change |
| `docs/ARCHITECTURE.md` | **The technical source of truth** — system design, simulation model, networking *(currently the v3 delta; consolidation pending)* |
| `docs/FOLDER_STRUCTURE.md` / `docs/CODING_STANDARDS.md` | How the repository is organized and the standards all code follows |
| `docs/adr/` | Architecture Decision Records — the reasoning behind contested rulings |
| `docs/reviews/` | Dated review reports: documentation audit, prototype audit, refactoring roadmap, production-readiness review |
| `docs/project-roadmap-gantt.html` | Visual timeline through public launch, multiplayer, and mobile |

## Technology Stack

- **Game & UI:** TypeScript, React, Phaser, Tailwind CSS, built with Vite
- **Multiplayer server (Phase 2):** Node.js with Socket.IO
- **Data & accounts (Phase 2):** Supabase (anonymous-first — no sign-up required to play)
- **Web hosting:** Netlify · **Game server:** self-hosted Linux, VPS-ready
- **Mobile (Phase 3):** Capacitor (same codebase as the web version)

A pnpm workspace monorepo: `packages/` holds the deterministic `sim-core`, the `protocol` and `services` packages; `apps/web` is the client; `tests/determinism` is the fairness-guaranteeing suite.

## Roadmap Summary

1. **Foundation & Practice** — deterministic game core, portrait presentation, offline solo practice — ✅ **done**
2. **Live Rooms** — 4-player multiplayer matches with power-ups, live standings, and global/daily leaderboards — *next*
3. **Community Polish** — avatars, achievements, friend boards, spectating, mobile app releases
4. **Competitive Depth** — matchmaking with ratings, tournaments, seasons, new modes and power-ups

The visual timeline lives in `docs/project-roadmap-gantt.html`.

## Project Goals

- Prove that a **competitive multiplayer arcade game can fully respect its players**: no ads, no pay-to-win, no energy systems, no loot boxes, no dark patterns — ever
- Build a game with **one perfect input** — easy to learn in one breath, worth mastering for a thousand hours
- Serve **short-session mobile play**: a stranger should be mid-match twenty seconds after opening the game, one-thumbed, on a bus
- Keep every design and technical decision **documented, versioned, and reviewable** in this repository

## Contributing

Contributions are welcome. A full `CONTRIBUTING.md` is planned; until then: read the docs (start with `docs/AI_CONTEXT.md`), open an issue to discuss ideas, and note that every gameplay proposal is checked against the Game Design Document's Core Design Principles and Design Pillars first.

## Support

This game is **free to play, forever, with no advertisements** — and it will stay that way. There is nothing to buy in the game and never will be. If you'd like to support development, an optional Ko-fi donation link is planned. That's it — playing it and sharing it is support enough.

## License

Licensed under the **MIT License** — see [`LICENSE`](./LICENSE). Free to use, modify, fork, study, and share; we ask only what the license asks. True to the vision: open source, nothing hidden, nothing to sell.
