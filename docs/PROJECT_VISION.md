# PROJECT_VISION.md
## Project Rebound *(working title)*

| | |
|---|---|
| **Document version** | 1.0.0 |
| **Status** | Approved — governing document |
| **Scope** | Purpose, philosophy, values, and long-term direction. *What* the game is belongs to `GAME_DESIGN_DOCUMENT.md`; *how* it is built belongs to `ARCHITECTURE.md`. In the reading order defined by `AI_CONTEXT.md`, this document outranks both. |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-07-15 | Project maintainer | Initial approved vision |

---

## Mission

**To build a competitive multiplayer arcade game that respects its players completely — and to prove that this respect makes the game better, not smaller.**

We are making a game where a stranger can be mid-match twenty seconds after opening it, holding their phone in one hand, and where the only thing that ever decides a match is how well they play. No purchase, no grind, no trick of psychology stands between any player and the full game. The project is open source from its first commit, developed in public, documented so thoroughly that anyone — contributor, player, or future maintainer — can understand not just what was built, but why.

## Vision

In five years, this project should be three things at once:

**A game people actually play.** Not a portfolio piece, not a tech demo — a living arcade game with a small, warm community of players who open it on the bus, rope their friends into rooms, chase daily boards, and hold grudges about spike traps. Success at any scale counts, but it must be *play*, sustained by fun alone, because fun is the only retention mechanic we allow ourselves.

**A counterexample.** The mobile arcade space treats players as revenue surfaces: ads between deaths, energy meters, pay-to-skip friction that was installed on purpose. We believe the industry's cynicism is a choice, not a necessity. This project exists to be the working proof — a competitive, polished, multiplayer mobile-first game with literally nothing to sell, where every design decision was made for the player and the receipts are public in version control.

**A durable, welcoming codebase.** A project that a solo developer can maintain for years without burning out, that a stranger can understand in an afternoon of reading, and that could outlive its founder because everything that matters is written down. The repository itself — its documents, its discipline, its decision records — is part of the vision, not just a container for it.

## Core Values

1. **Respect for the player.** The player's time, money, attention, and intelligence are never exploited. No ads, no pay-to-win, no energy systems, no loot boxes, no dark patterns, no tracking beyond what the game genuinely needs to function. Anonymous play is a permanent right, not a trial mode.
2. **Fairness as a foundation.** Every player in a match faces the same world, the same speed, the same view, the same opportunities. Defeat must always be legible and self-attributable. A game that is not fair is not competitive — it is merely contested.
3. **Honesty.** In the game: no mechanic may deceive a player about their situation. In the project: development happens in public, decisions are recorded with their reasoning, mistakes are documented rather than buried, and the roadmap says what we actually believe.
4. **Simplicity with depth.** We add nothing that fun does not demand. Complexity must always justify itself; simplicity never has to. The perfect version of this game is the one where nothing more can be removed.
5. **Craft.** Small scope is not an excuse for roughness. The jump must feel perfect, the defeat must sting cleanly, the rematch must be instant. We would rather ship one mechanic at excellent than five at adequate.
6. **Sustainability.** This is a marathon run by (at first) one person. We protect the maintainer like we protect the player: realistic scope, phases that each ship something whole, and no obligation — financial or emotional — that turns a passion project into a debt.

## Design Philosophy

The full, binding statement of design philosophy lives in `GAME_DESIGN_DOCUMENT.md` (§2A Core Design Principles and §12 Design Pillars). At the vision level, it reduces to three convictions:

**One perfect verb.** The most enduring games in history are built on a single action executed with endless nuance. We believe depth comes from mastering simple things — never from learning complicated ones — and we accept the discipline this imposes: every feature idea must survive the question *"does this deepen the jump, or distract from it?"*

**The player's skill is sacred.** Nothing in the game — not power-ups, not randomness, not another player, not the business model (of which there is none) — may ever matter more than execution. Everything else is scenery and seasoning.

**Constraints are the identity.** One thumb. Portrait. No steering. Two-to-five-minute matches. These are not limitations we tolerate; they are the creative bet the whole project is built on. When a constraint chafes, the answer is better design within it, not an exception to it.

## Open Source Philosophy

- **Open source is a value here, not a distribution channel.** The code is public because we believe play, fairness, and craft are worth studying and sharing — and because a game about fairness should have nothing to hide. Anyone can read exactly how the world is generated, how scores are verified, and confirm there is no house edge anywhere.
- **Openness with stewardship.** Open source does not mean design-by-committee. The vision, pillars, and principles are maintained with a firm hand; contributions are welcomed warmly and reviewed against the governing documents. A kind "no, and here's why" is part of good stewardship.
- **The documents are the institution.** Contributors will come and go; AI assistants will come and go; someday the founding maintainer may go. The project survives through its written record: vision, design document, architecture, decision records. If it matters and it isn't written down, it doesn't exist yet.
- **Welcoming by design.** The barrier to entry is kept deliberately low — the game must run with zero infrastructure for anyone who clones it, the documents assume no prior context, and "I just want to fix a typo" is an honored contribution.
- **Free means free.** Forks, mods, study, and reuse under the project's license are encouraged. We ask only what the license asks.

## Player Experience Goals

What playing this game should *feel like* — the experiential bar every release is measured against (the mechanical detail behind these lives in the design document):

- **Instant.** From opening the game to playing it: seconds. From losing to trying again: a breath. The game never makes a player wait to play.
- **Flow under pressure.** The core sensation is rhythm and clean execution against rising speed — absorbing enough that a two-minute match feels like ten seconds, fair enough that a death never feels stolen.
- **"One more game."** The itch to retry must outlast the sting of losing. If players quit angry rather than quit late, the design has failed.
- **Rivalry with a face.** Opponents are named, visible, few, and personal. The emotional register is the grin of a grudge match between friends — never the loneliness of a crowd or the rage of injustice.
- **Lightness.** Cheerful, readable, a little cheeky. Losing is comedy, winning is delight, and nothing about the game is solemn.
- **Trust.** A player who never reads a menu, never pays a cent, and never makes an account gets the entire game and knows it. That certainty — nothing is being withheld from me — is itself part of the experience.

## Long-Term Goals

In rough order of horizon, deliberately modest and deliberately real:

1. **Ship the foundation** — the complete documented base and an offline practice mode that is already fun on its own.
2. **Ship the real game** — live four-player rooms with power-ups and standings; the moment the vision becomes playable.
3. **Reach a sustaining rhythm** — a small community playing regularly, contributors trickling in, releases on a calm cadence a solo maintainer can hold indefinitely.
4. **Deepen the competition** — the ecosystem the design document reserves for later: seasons, matchmaking, tournaments, and identity — added only as the community's size makes each one meaningful.
5. **Outlast.** The quiet, most ambitious goal: a game still playable, still maintained, still respectful, years from now — including surviving transitions of maintainership, because the written record makes the project transferable.

We explicitly do **not** aim for: virality, install-count milestones, esports scale, platform-holder deals, or revenue of any kind. If any of those happen incidentally, fine; none of them steer.

## Success Criteria

How we will honestly know it's working — checked against each release and each year, chosen to be observable rather than aspirational:

**The game succeeds when…**

- A brand-new player understands the game within one match, unaided, and voluntarily starts a second one.
- Session patterns show chains of rematches — the "one more game" loop is empirically real, not hoped-for.
- Defeated players can accurately say why they lost, and the answer is never "the game cheated me," "lag," or "their wallet."
- Complete strangers fill four-player rooms and come back the next day without any retention mechanic asking them to.

**The project succeeds when…**

- Every promise in this document is still true in the shipped game — verifiable by anyone reading the source.
- A newcomer (human or AI) can go from cloning the repository to a correct understanding of the project in one sitting, using only the documents.
- Outside contributions arrive, pass review against the governing documents, and ship — and their authors return.
- The maintainer still enjoys working on it. Burnout is a failure state of the project, not a badge.

**And it fails — regardless of any other metric — if…**

- A single ad, paid advantage, or dark pattern ever ships.
- Skill stops being the deciding factor in matches.
- The documents rot: the written record and the shipped reality drift apart and nobody closes the gap.

---

*This document changes rarely and only with deliberate intent. Amendments require a version bump, a revision-history entry, and maintainer sign-off with written rationale. When day-to-day decisions feel ambiguous, re-read the Mission — most ambiguity dissolves there.*
