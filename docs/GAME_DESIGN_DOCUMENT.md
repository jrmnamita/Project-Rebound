# GAME DESIGN DOCUMENT
## Project Rebound *(working title)*

| | |
|---|---|
| **Document version** | 1.0.0 |
| **Status** | Approved baseline — primary design reference |
| **Scope** | Game design only. Implementation, technology, and architecture live in `docs/ARCHITECTURE.md`. |
| **Authority** | This document governs every gameplay and feature decision. If a proposed feature conflicts with §12 (Design Pillars — Never Change), the feature changes, not the pillar. |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-07-15 | Project team | Initial approved baseline, consolidated from the founding Game Vision statement |

---

## 1. What Is This Game?

**Project Rebound is a competitive arcade survival game for up to four players, played in portrait with one thumb.**

A bouncing character rolls forward through an endless, ever-faster side-scrolling world of slopes, gaps, platforms, and hazards. The player controls exactly one thing: **the jump**. Tap for a normal jump, hold for a higher one. That's the entire control scheme — and mastering it is the entire game.

In a match, four players run the same world at the same time. Nobody can touch anybody. What they *can* do is outlast, outscore, and outsmart each other — surviving longer, jumping cleaner, and using a small arsenal of lightweight power-ups to complicate each other's lives. The world keeps accelerating until it breaks everyone. The last player standing wins; if the world takes them all, the highest score does.

A match lasts two to five minutes. Losing one should make you want to immediately play another.

This game is **inspired by** the physicality of classic ball-bounce platformers — the weight, the arc, the satisfying thud of a good landing — but it is **not a remake of anything**. It has its own identity, its own world, and its own reason to exist.

## 2. Why Does This Game Exist?

Three beliefs, and a gap in the market where they meet:

1. **One perfect input beats ten mediocre ones.** The most enduring arcade games are built on a single verb executed with depth (flap, stack, rotate, jump). We believe a jump — with variable height, real momentum, and terrain that punishes sloppiness — carries a full competitive game.
2. **Short-session multiplayer is underserved on the phone.** Most mobile multiplayer demands long sessions, two hands, tutorials, or a wallet. There is space for a game where a stranger can be mid-match twenty seconds after opening it, one-thumbed, on a bus.
3. **Competitive should not mean predatory.** As an open-source project with no ads, no paid advantages, and no retention traps, this game exists to prove a competitive arcade game can respect its players completely — and be more fun because of it.

## 3. What Makes It Unique?

- **The portrait window is the difficulty.** This is a *horizontal* side-scroller deliberately viewed through a *narrow portrait* camera. Players see only a couple of seconds of terrain ahead — and as the world speeds up, that window effectively shrinks. The tension of the game lives in that narrow view. (This is explicitly *not* a vertical platformer, not an endless-runner-with-lanes, and not a climber.)
- **Shared world, no contact.** All four players face the *identical* terrain, moment for moment. Every death is legible: the world got you, or a rival's trap did — never lag, never a body-block, never randomness that treated you differently from anyone else.
- **Acceleration as the antagonist.** There is no finish line and no final boss. The escalating speed of the world is the enemy, and it always wins eventually. Matches don't end because a timer says so; they end because Extreme Survival speed breaks the last player.
- **Interference, not interruption.** Power-ups let players complicate rivals' terrain — never delete their skill. Nothing in the game can kill a player outright except their own missed jump.

## 4. Target Audience

**Primary — "the quick-match competitor":** ages ~13–35, plays in short bursts (commute, queue, break), comfortable with instant-restart skill games (Flappy Bird–like, io-games), motivated by beating friends and named rivals more than by progression systems. Plays on a phone, one hand, often with sound off.

**Secondary — "the score chaser":** solo-oriented player who grinds daily boards and personal bests, treats practice mode as the main dish, and joins multiplayer when a friend appears.

**Tertiary — the open-source community:** developers and tinkerers who arrive via the repository, stay to play, and occasionally contribute. They are also an audience and deserve a game that's fun, not just a codebase that's clean.

**Explicit non-goals:** players seeking deep progression/RPG systems, long-session esports, gacha/collection loops, or narrative content. We do not design for them.

## 5. Emotional Targets

What a player should feel, in order of priority:

1. **Flow under pressure.** The core sensation: rhythm, anticipation, and clean execution as terrain scrolls faster and faster. The jump must feel *fair, weighty, and instantly responsive* at all times — this feeling is the product.
2. **"One more game."** Defeat should feel self-attributable ("I mistimed that") and immediately redeemable (rematch is seconds away). Frustration should decay in moments; the itch to retry should not.
3. **Rivalry, not rage.** Seeing a named opponent one rank above you should sharpen focus. Being trapped by a rival should provoke a grin and a grudge, never helplessness — every offensive power-up is visible coming and has counterplay.
4. **Shared drama.** The whole room hits Very Fast and Extreme Survival *together*. The synchronized escalation — everyone's screens getting frantic at once, the live board churning — is the spectacle.
5. **Lightness.** Cheerful, readable, a little cheeky. Emoji avatars, satisfying pops and bounces. Losing is comedy, winning is delight. Never grimdark, never solemn.

## 6. Core Gameplay

### 6.1 Movement & Controls

- The character **moves forward automatically at all times.** The player never steers, brakes, or reverses.
- The **only** player input is the jump:
  - **Tap** → normal jump.
  - **Hold** → higher jump (height scales with hold, up to a cap; releasing early cuts the jump short).
- Jumping is only possible from the ground. There is no double jump, no air control, no dash. *(Air-influence abilities are permanently banned — see §12.)*
- The entire game — menus included — must be comfortably playable **with one thumb in portrait**. No virtual joystick, no movement buttons, ever.

Depth comes from the interaction of one input with the world: jump *timing* (when to leave the ground), jump *sizing* (how long to hold), slope reading (a good landing on a downslope preserves flow; a bad one costs rhythm), and route judgment (high floating platform vs. risky low gap) — all compressed by an ever-shrinking reaction window.

### 6.2 The World

An endless, procedurally generated side-scrolling landscape, built from a vocabulary that must stay *instantly readable at extreme speed*:

| Terrain element | Role |
|---|---|
| Flat ground | Breathing room, rhythm reset |
| Slopes & hills | Flow — the joy of momentum; reward clean landings |
| Small gaps | Timing checks — a confident tap |
| Large gaps | Commitment checks — a full hold, or a route change |
| Floating platforms | Optional high route; risk/reward positioning |
| Spikes | Precise, small, lethal-to-touch punctuation |
| Hazard zones | Marked stretches that demand a plan (clear or avoid), not a reflex |

Generation rules of thumb (design intent, not formulas): every challenge must be **survivable on sight** at the speed it appears; difficulty comes from *density and speed*, never from off-screen surprises or leaps of faith; the world should read as natural and smooth — rolling, organic, continuous — not as an obstacle grid.

### 6.3 The Camera *(design intent)*

Portrait framing over a horizontal world. The player sits in the left third of the screen, maximizing visible terrain ahead — roughly **2–3 seconds of lookahead at base speed** — with generous vertical framing so hills, drops, and high platforms read beautifully in the tall frame. Every player in a match gets *identical framing*; no one ever sees more of the world than a rival. Screen never rotates; the game is portrait-only.

## 7. The Gameplay Loop

**Moment loop (seconds):** read approaching terrain → choose jump timing & size → execute → land → score ticks up → repeat, faster.

**Match loop (2–5 minutes):** join room → countdown → survive & score → lose lives → checkpoint respawns → eliminations → last player standing or all out → results & standings → **rematch in two taps.**

**Session loop (10–30 minutes):** a chain of "one more game" — rematches with the same room, climbing today's board, one revenge match against the rival who trapped you.

**The rematch rule:** from the results screen, a player must be able to start the next match within **two taps and a few seconds**. This is a hard design requirement, not polish — the session loop lives or dies here.

## 8. Match Rules

### 8.1 Objective

There is **no finish line**. Players survive as long as they can while their score climbs. A match ends when every player has spent all their lives. The winner is:

1. **The last player alive**, if one player outlasts all others; otherwise
2. **The highest score**, when the world eliminates everyone.

### 8.2 Scoring

- Score **increases continuously while alive**, driven by survival distance.
- Score is **never lost** — not by death, not by respawn, not by rival power-ups. It only goes up or pauses.
- Small deterministic bonuses may layer on top over time (e.g., near-miss bonuses, clean-streak bonuses) provided they reward *skill exhibited*, never luck. Any bonus must be identical in opportunity for all players in the match.
- Score is the tiebreaker of the whole design: it decides the winner when everyone dies, orders the live board, and feeds daily/season leaderboards.

### 8.3 Lives & Respawn

- Every player enters a match with **3 lives**.
- Death — falling into a gap, touching a spike or hazard — consumes one life.
- On death with lives remaining, the player **respawns at the latest checkpoint** after a brief pause, with a short **spawn-protection window** (immune to hazards and rival effects, cannot gain score) so respawning never chains into an instant second death.
- **Score is fully retained across deaths.**
- On losing the third life, the player is **eliminated**: they remain in the room as a spectator, watching the survivors and the live board until the match resolves. Elimination should feel like a front-row seat, not a lobby kick.

### 8.4 Checkpoints

- Checkpoints are **woven into the terrain at regular intervals** — visible, celebratory markers the player passes through automatically (no action required to claim one).
- Respawn placement is always **safe by construction**: flat, hazard-free ground with fair sightlines to what's coming.
- Checkpoints are identical for all players in the match — same locations, same world.
- Checkpoints do **not** slow the world down: a respawning player re-enters at the match's *current* speed phase. Lives absorb mistakes; they don't rewind the pressure.

### 8.5 The Speed Curve *(signature mechanic)*

The world accelerates through named phases on a **shared match clock** — every player in the room experiences the same speed at the same moment:

| Phase | Feel | Design role |
|---|---|---|
| **Normal** | Comfortable, readable | Warm-up; nobody should die here except by throwing |
| **Faster** | Brisk; sloppy play punished | Skill separation begins; first eliminations |
| **Very Fast** | Frantic; every jump matters | The dramatic heart of most matches |
| **Extreme Survival** | Barely sustainable, unwinnable forever | The closer; guarantees every match ends |

- Phase transitions are **announced and felt** — a visual/audio beat the whole room shares. These are the match's dramatic act breaks.
- The curve is tuned so that a typical match resolves in **2–5 minutes**, ended by the world, not by a timer.
- Deaths and respawns never reset or slow the clock. Solo practice uses the *identical* curve — practice trains the real game.

## 9. Multiplayer

**Multiplayer is the primary mode of this game.** Solo exists for practice (see §10). Everything else in this document is designed multiplayer-first.

- **Rooms of up to 4 players.** Small enough for every rival to be a *person* — a name, an avatar, a grudge — not a crowd.
- **Same world, same moment.** All players traverse identical terrain under an identical speed clock. Fairness is absolute and legible.
- **Visible rivals.** Opponents are rendered live in the world as real, animated competitors — not ghosts, not abstractions. When a rival is beyond the narrow camera's view, an **edge indicator** (their avatar, direction, and distance gap) keeps them perceptually present at all times. A player should always be able to answer "where is everyone?" at a glance.
- **No physical contact.** Players pass through each other. No collision, no pushing, no blocking. All interaction flows through power-ups (§11) and the scoreboard.
- **The live match leaderboard** is permanently on screen: four rows — avatar, rank, score, lives. It updates **in real time**, and rank swaps, deaths, and eliminations produce immediate, satisfying feedback (a flash, a chirp, a wobble). Watching yourself overtake second place *while jumping for your life* is a core thrill of the game.
- **Spectating:** eliminated players watch the remaining survivors with the live board — kept warm for the rematch.
- **Rematch:** the room flows back into a new countdown in two taps (§7).

## 10. Solo / Practice Mode

- The same game, alone: same terrain vocabulary, same speed curve, same scoring, same lives-and-checkpoints structure. Practice must train *exactly* the skills multiplayer tests.
- **Race your own best:** the player's best run can appear as a translucent ghost of themselves to chase. (Ghosts are a solo-practice feature only; multiplayer rivals are always live.)
- **Daily challenge:** each day, one shared world for everyone — a global board for bragging rights.
- Solo is always available **offline and without any account** — it is also the game's demo, tutorial, and warm-up room.

## 11. Power-Ups

### 11.1 Philosophy — the Skill Supremacy Rule

Power-ups exist to create *stories between players*, not to decide matches. The governing law, testable for every current and future ability:

> **A better player with no power-ups should usually beat a weaker player with all of them.** No ability may kill directly, remove a player's control, or bypass the skill of jumping.

Every offensive effect must satisfy all four: **(1) telegraphed** — the victim sees it coming with enough time to react; **(2) survivable** — a skilled response always exists; **(3) brief** — seconds, not phases; **(4) counterable** — shields and smart play answer it.

### 11.2 Acquisition

Power-ups appear as **pickups placed in the terrain** — same locations for every player, woven into risk/reward routes (the juicy pickup is on the high platform; the safe line has none). A player carries at most one at a time.

### 11.3 Launch Set

| Power-up | Type | Effect (design terms) | Counterplay |
|---|---|---|---|
| **Bomb** | Offense | Blasts a crater into terrain ahead of the target rival — turning their easy ground into a gap they must now jump | See it land, size the jump; Shield eats it |
| **Spike Trap** | Offense | Plants a visible spike hazard on the target's path a comfortable distance ahead | Jump it like any spike; Shield eats it |
| **Slow Effect** | Offense | Briefly dampens the target's jump feel (heavier, stickier) — pressure, not paralysis | Play conservative lines for a few seconds; Shield |
| **Shield** | Defense | Absorbs the next negative effect entirely; visible bubble so attackers know | Bait it out with a cheap effect first |
| **Speed Boost** | Self | Brief score-rate surge for the user (racing ahead of the pressure) | None needed — it doesn't touch rivals |

**Targeting** favors the drama of the standings by default (offense strikes the rival nearest ahead of the user). **Activation** is automatic on a rule (see Open Questions §14 — auto-use on pickup is the working default, keeping jump as the game's only input).

**Permanently banned** (per founding vision): body collision, pushing, teleport attacks, flying/air-control abilities, instant kills, score theft, control inversion, and anything that makes a rival's screen lie to them.

### 11.4 Pacing

Power-ups are seasoning, not the meal: a handful of pickups per match per player, budgeted so that Normal phase is nearly clean (learn the world first) and interference peaks in Faster/Very Fast — then thins in Extreme Survival, where the *world* is antagonist enough.

## 12. Design Pillars — What Must NEVER Change

These are constitutional. A future feature that violates one is rejected or redesigned, regardless of how appealing it is.

1. **One input.** Jumping (tap/hold) is the only gameplay control. Forever.
2. **One thumb, portrait.** Fully playable one-handed in portrait. No landscape requirement, no second touch zone for core play.
3. **Auto-forward.** The player never controls horizontal movement.
4. **Horizontal world, portrait window.** It is a side-scroller; the narrow view is the signature tension. It never becomes a vertical platformer or a lane runner.
5. **No player collision.** Rivals never physically touch.
6. **Skill supremacy.** No purchasable, random, or power-up advantage ever outweighs execution. Nothing kills a player except terrain they failed to clear.
7. **Absolute fairness.** All players in a match face the identical world, identical speed, identical framing, identical opportunity.
8. **The world always wins.** Endless, accelerating, no finish line. Matches end by escalation, not timers.
9. **Score only rises.** No mechanic may take earned score from a player.
10. **Respect the player.** No ads, no pay-to-win, no energy systems, no loot boxes, no dark patterns. Open source. Optional donations only. Anonymous play always possible.
11. **Quick matches, instant rematch.** 2–5 minute matches; next game always two taps away.

## 13. What Can Evolve Over Time

Everything not nailed down by §12, deliberately including:

- **The power-up roster** — new abilities, rebalances, retirements (each new ability must pass §11.1's four tests and the Skill Supremacy Rule).
- **Terrain vocabulary** — new elements, biomes/visual themes, seasonal worlds, special daily modifiers.
- **The speed curve's tuning** — phase timings, steepness, match-length calibration (the *existence* of the escalating-phase structure is pillar-protected; its numbers are not).
- **Game modes** — variants built from the same atoms (e.g., sudden-death one-life mode, duos, marathon weekends), so long as the flagship 4-player survival mode remains the headline.
- **Scoring bonuses** — new skill-expressive bonuses, within §8.2's constraints.
- **Cosmetics & identity** — avatars, character skins, trails, celebration effects: all earnable through play only, never purchasable, never gameplay-affecting.
- **Achievements, seasons, leaderboard structures, tournaments, matchmaking** — the competitive superstructure around the unchanging core.
- **Art direction, audio, tone, and the game's final name** — the identity will sharpen; the working title implies nothing.
- **Room size** — 4 is the launch maximum, chosen for legibility; a future mode may experiment *only if* every rival remains individually legible and the live board stays readable in portrait.

## 14. Open Design Questions

Tracked here so they're decided by playtest, not by accident:

| # | Question | Working default | Decided by |
|---|---|---|---|
| 1 | Power-up activation: automatic on pickup vs. a single "use" tap zone | **Auto-activation** (preserves one-input purity) | First multiplayer playtests |
| 2 | Exact speed-phase timings and match-length tuning | Draft curve targeting ~3.5 min median match | Playtest telemetry |
| 3 | Spectator richness after elimination | Watch the leader + live board | Phase 3 review |
| 4 | Near-miss / style bonuses in scoring at launch, or after | After launch (keep launch scoring pure survival) | Post-launch review |
| 5 | Final game name and visual identity | "Project Rebound" placeholder | Identity/art-direction pass, Phase 1 |

## 15. Glossary

| Term | Meaning |
|---|---|
| **Match** | One multiplayer game: countdown → survival → all lives spent → results |
| **Room** | Up to 4 players who share matches and rematches |
| **Phase** | A named stage of the speed curve (Normal / Faster / Very Fast / Extreme Survival) |
| **Checkpoint** | Terrain marker defining the respawn point; passed automatically |
| **Elimination** | Losing the third life; player becomes a spectator for the rest of the match |
| **Live board** | The always-visible in-match leaderboard (rank, score, lives, per player) |
| **Edge indicator** | On-screen marker showing an off-camera rival's avatar and distance |
| **Pickup** | A power-up crate placed in terrain, identical for all players |
| **Daily challenge** | One shared solo world per day with its own leaderboard |
| **Ghost** | Translucent replay of the player's own best run (solo practice only) |

---

*End of GAME_DESIGN_DOCUMENT.md v1.0.0. Changes to this document require a version bump and a revision-history entry. Sections marked as pillars (§12) additionally require explicit maintainer sign-off with written rationale.*
