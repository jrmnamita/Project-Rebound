# Project Rebound *(Orb Arena)*

> **Codename:** Project Rebound — the final public game title may change before release.

An original competitive arcade survival game, played in portrait with one thumb. Open source. Free forever. No ads.

## Elevator Pitch

Four players. One accelerating world. One button.

Project Rebound is an endless side-scrolling survival game viewed through a narrow portrait camera. Your character rolls forward automatically — all you control is the jump: tap for a normal jump, hold for a higher one. Slopes, gaps, floating platforms, and spikes rush toward you faster and faster until the world's speed finally breaks everyone. Outlast your rivals, outscore them, and complicate their lives with lightweight power-ups — you can never touch them, but you can definitely ruin their afternoon. Matches last 2–5 minutes. Losing one makes you want another.

Inspired by the physicality of classic ball-bounce platformers, but an original game with its own identity — not a remake of anything.

## Features

**Core gameplay**

- One-input controls: tap = jump, hold = higher jump — the entire control scheme
- Endless procedurally generated terrain: slopes, hills, gaps, floating platforms, spikes, hazard zones
- A signature escalating speed curve: Normal → Faster → Very Fast → Extreme Survival
- 3 lives per match with checkpoint respawns — score is never lost
- Fully playable with one thumb, in portrait, on a phone

**Multiplayer (primary mode)**

- Live rooms of up to 4 players racing the identical world at the identical speed
- Visible rivals with off-screen indicators — real competitors, never ghosts
- No body collision: competition through score, survival, and power-ups (Bomb, Spike Trap, Shield, Speed Boost, Slow)
- An always-visible live match leaderboard that updates in real time
- Last player alive wins — or highest score if the world takes everyone
- Instant rematch: the next game is always two taps away

**Solo practice**

- The same game, offline-capable, no account needed — race your own best-run ghost and take on daily challenge worlds

## Current Development Status

🚧 **In active development — pre-release.** The design and architecture are approved and documented; implementation is in its early phases. Nothing here is playable yet. Watch/star the repo to follow along.

## Documentation

All project decisions live in version-controlled documents, not in anyone's head:

| Document | Purpose |
|---|---|
| `docs/PROJECT_VISION.md` *(coming soon)* | The founding vision statement — why this game exists and the experience it must deliver |
| `docs/GAME_DESIGN_DOCUMENT.md` | **The design source of truth.** What the game is: rules, scoring, lives, multiplayer, power-ups, design principles, and the pillars that must never change |
| `docs/ARCHITECTURE.md` | **The technical source of truth.** How the game is built: system design, simulation model, networking approach, and the reasoning behind every major decision |
| `docs/ROADMAP.md` *(future)* | Milestones, phases, and what's being worked on now |

New contributors (human or AI): read the Game Design Document first, then the Architecture document. Feature discussions start from those two files.

## Technology Stack

- **Game & UI:** TypeScript, React, Phaser, Tailwind CSS, built with Vite
- **Multiplayer server:** Node.js with Socket.IO
- **Data & accounts:** Supabase (anonymous-first — no sign-up required to play)
- **Web hosting:** Netlify · **Game server:** self-hosted Linux, VPS-ready
- **Mobile:** Capacitor (same codebase as the web version)

The frontend runs entirely without the backend — solo practice works offline and serves as the live demo.

## Project Goals

- Prove that a **competitive multiplayer arcade game can fully respect its players**: no ads, no pay-to-win, no energy systems, no loot boxes, no dark patterns — ever
- Build a game with **one perfect input** — easy to learn in one breath, worth mastering for a thousand hours
- Serve **short-session mobile play**: a stranger should be mid-match twenty seconds after opening the game, one-thumbed, on a bus
- Grow a healthy **open-source game project** that is fun to play first and rewarding to contribute to second
- Keep every design and technical decision **documented, versioned, and reviewable** in this repository

## Roadmap Summary

1. **Foundation & Practice** — deterministic game core, portrait presentation, offline solo practice with ghost runs
2. **Live Rooms** — 4-player multiplayer matches with power-ups, live standings, and global/daily leaderboards
3. **Community Polish** — avatars, achievements, friend boards, spectating, mobile app releases
4. **Competitive Depth** — matchmaking with ratings, tournaments, seasons, new modes and power-ups

Detailed milestones will live in `docs/ROADMAP.md`.

## Running the Project

> ⚠️ Placeholder — implementation is not yet available. These instructions will be finalized with the first runnable build.

```
# Planned developer experience:
git clone https://github.com/<owner>/<repo>.git
cd <repo>
pnpm install
pnpm dev        # runs the game in demo mode — no backend or secrets required
```

The project is designed so that `pnpm dev` will always launch a fully playable offline demo with zero configuration. Server and database setup will be optional and documented separately.

## Contributing

Contributions will be very welcome once the foundation is in place. A `CONTRIBUTING.md` with guidelines, design-decision records, and good first issues is planned. Until then: read the docs, open an issue to discuss ideas, and note that every gameplay proposal is checked against the Game Design Document's Core Design Principles and Design Pillars first.

## Support

This game is **free to play, forever, with no advertisements** — and it will stay that way. There is nothing to buy in the game and never will be. If you'd like to support development, an optional [Ko-fi](https://ko-fi.com) donation link is planned. That's it — playing it and sharing it is support enough.

## License

📄 *License to be finalized before the first public release — an OSI-approved open-source license (MIT or Apache-2.0) is intended.* Until a `LICENSE` file is present in this repository, all rights are reserved.
