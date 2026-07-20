# Documentation Review — Senior Game Technical Director pass
**Date:** 2026-07-20 · **Status:** Session report — informational, not a governing document · **Immutable after commit** (corrections go in a new dated file)

**Scope:** AI_CONTEXT.md, PROJECT_VISION.md v1.0.0, GAME_DESIGN_DOCUMENT.md v1.0.0, ARCHITECTURE.md (v3 delta), README.md. Prototype code excluded.

Issue IDs (A1–F2) are referenced by AI_CONTEXT "Current Priorities" and future ADRs. Format per issue: Problem → Why it matters → Suggested documentation improvement.

---

## A. Contradictions

- **A1. Project status disagrees across documents.** AI_CONTEXT said "no game code yet"; README says implementation is underway. → Newcomers plan against the wrong phase. → Reconcile AI_CONTEXT living sections (done 2026-07-20); README defers to AI_CONTEXT on status.
- **A2. Approval states disagree.** AI_CONTEXT calls v3 approved; the v3 file says "awaiting approval." AI_CONTEXT cited GDD v1.1.0; disk has v1.0.0. → "Documents are law" fails when the laws disagree about which are in force. → Record approval in the approved document itself; add missing revision entries; maintainer ruling on GDD version.
- **A3. Stale "pending" annotations in the reading order.** VISION was marked pending though it exists. → Mis-ranks conflict authority. → Fixed 2026-07-20; add exists/version/approved checklist discipline.
- **A4. "Identical world" pillar vs. terrain-modifying power-ups.** Pillar 7 promises identical terrain moment-for-moment; Bomb/Spike Trap modify a target's terrain. Nothing states whether modifications are per-player overlays (worlds diverge) or global (offense hits everyone). → Constitutional ambiguity in the core competitive mechanic; drives overlay architecture, validation, spectating. → Amend Pillar 7/§11: base world identical; rival effects are per-player overlays visible to all; requires pillar-change sign-off. **BLOCKING for implementation.**
- **A5. Spike Trap placement contradicts checkpoint safety.** GDD: "on the target's path ahead"; ARCH §2.3: "at a target checkpoint zone"; GDD §8.4 guarantees safe respawns. → Undermines safe-respawn guarantee or misdescribes a core module. → Correct ARCH to match GDD; add explicit rule: checkpoint pads immune to all placed effects.
- **A6. "Carries at most one" vs. auto-activation default.** §11.2 inventory rule is dead text if auto-activation (§14 default) is adopted. → Implementers will build (or skip) inventory on a coin flip. → Condition §11.2 on Open Question #1's outcome, explicitly.
- **A7. "Speed Boost" name vs. effect; §8.2 purity.** Effect is a score-rate surge (cannot alter speed — Pillar 7); name says otherwise; §8.2 defines score as distance-driven, which a multiplier quietly breaks. → Name leaks into UI/code/player expectations; validator needs an honest scoring function signature. → Rename (e.g., "Score Surge") or add definition note; amend §8.2 to "distance/ticks × deterministic modifiers."
- **A8. Match-end wording is internally muddled.** "Ends when every player has spent all lives" vs. "last player alive wins"; ARCH state diagram's LastStand exit conditions are contradictory. → Unclear whether the match ends at last-survivor or at last death; different results, persisted scores, spectator duration. → Rewrite §8.1 as a total termination rule incl. same-tick eliminations; fix diagram. **BLOCKING.**

## B. Missing systems

- **B1. Room lifecycle / lobby.** No doc defines room creation, join methods, min players, countdown, seat-filling, leavers. → Front door of the primary mode. → Add "Rooms (launch scope)" to GDD + room-actor lifecycle to ARCH.
- **B2. Disconnect / reconnect.** No policy for mid-match connection loss or mobile backgrounding. → Most common mobile event; Vision promises defeat is "never lag." → Add grace window, deterministic input treatment, rejoin policy, honest results labeling.
- **B3. Daily challenge unspecified.** Seed rotation, attempts, offline behavior, board validation undefined; shared-seed invites trace plagiarism. → Score-chaser core feature and anti-cheat surface. → Specify in §10.x + validation note in ARCH.
- **B4. Onboarding/tutorial unowned.** "Understands within one match, unaided" has no designed mechanism. → Measurable criterion discovered late otherwise. → Add "First-run experience" note to §10 (even if "the first 20 seconds of terrain are the tutorial").
- **B5. Telemetry unscoped vs. no-tracking value.** Open questions rely on "playtest telemetry"; Vision forbids tracking beyond need. → Privacy value vs. data need collides silently. → Write a telemetry & privacy section: exact anonymous events, storage, retention.
- **B6. Version-compatibility policy missing.** simVersion gates determinism; mixed-version rooms, app-store build lag, forced-update UX undefined. → First sim tuning change post-mobile-launch breaks multiplayer for someone. → Rooms are simVersion-homogeneous; server advertises supported window; document update UX.
- **B7. Accessibility absent.** No colorblind/reduced-motion/reach/board-readability commitments. → "Player respect is structural" and readability-at-speed already imply it. → Add launch accessibility floor to GDD.

## C. Missing gameplay rules

- **C1. Ties and simultaneous eliminations.** Deterministic lockstep makes exact ties likely. → Winner function must be total. → §8.1: score → survival ticks → deterministic stable tiebreak, disclosed on results. **BLOCKING with A8.**
- **C2. Targeting fallbacks.** "Nearest rival ahead" undefined when in 1st place / all ahead eliminated / target protected. → Auto-activation makes targeting fully rule-driven; silent guesses = desyncs. → Specify full fallback chain in §11.3.
- **C3. Effect stacking/ordering.** Same-tick effects vs. one shield; overlapping Slows; shield acquired mid-telegraph. → Deterministic resolution questions. → Add "effect resolution" paragraph: server stamp order; same-tick deterministic key; refresh policy per effect.
- **C4. Crater lifetime & placement limits.** "Brief — seconds" vs. terrain craters of unstated persistence; crater-on-checkpoint/gap/slope undefined. → Persistent crater = permanent effect; poisons respawn guarantee. → State lifetime; forbid overlap with checkpoint pads; define edge geometry in design terms. **BLOCKING.**
- **C5. Spawn-protection scope fuzzy.** Falls? Pickups? Being targeted? Duration default missing from §14. → Exploits and frustration hide in each unstated interaction. → Enumerate protection matrix + working-default duration.
- **C6. Solo seed policy & ghost applicability.** When does a new world roll; ghost validity across seed/simVersion. → Ghost silently degrades without it. → §10: stable session seed; ghosts only on matching (seed, simVersion); daily = canonical shared seed.
- **C7. Solo pause rule.** Undefined; commuter persona guarantees interruptions; "practice trains the real game" vs. player respect. → Decide either way, one sentence, with rationale.

## D. Architecture gaps

- **D1. The v2 baseline is missing from the repository. (Highest severity.)** The delta defers protocol, tick/clock sync, beacon format, validator, data model, monorepo detail to an absent document. → Faithful implementation formally impossible; "one sitting to correct understanding" fails. → Execute consolidation; commit v2 verbatim as interim if recoverable; otherwise reconstruct deferred sections as proposals.
- **D2. Floating-point/math determinism policy undocumented.** `Math.sin/cos/pow` are not cross-engine bit-identical; slopes invite trig. → Classic lockstep failure mode; invisible until devices disagree. → Sim-core math policy: allowed ops, banned functions, deterministic approximations, cross-engine CI test.
- **D3. Mid-match trust model unstated.** Validation is post-match; live board trusts client beacons meanwhile. → A modified client can fake the live board for a whole match. → Document live sanity checks (score-rate vs. curve, statehash cross-checks) and accepted residual risk.
- **D4. Desync detection/recovery undefined in available docs.** Hash mismatch handling; late effect-tick application for lagging clients. → The two real-world lockstep failure modes. → Specify detection window, recovery ladder, late-application rule (Δ adapts to worst RTT, cap, then disconnect path per B2).
- **D5. Server restart / single-process failure modes.** In-memory rooms; deploy/crash policy unstated. → Defeat-by-ops must be legible too; solo maintainer needs a calm deploy story. → Document accepted failure mode (matches void + honest messaging), drain procedure, one-box ceiling.

## E. Save/load & data

- **E1. Anonymous identity durability.** Device-storage identity loss (cleared storage, new phone) unaddressed pre-linking. → Score-chaser history evaporates silently. → Document loss window; honest UX copy; merge rules on account link.
- **E2. Local solo data spec missing.** Bests/ghost traces: format, keying, size, simVersion invalidation. → Unbounded growth or silently wrong ghosts. → Services-layer data spec keyed (seed, simVersion, curveId).
- **E3. Trace/history retention unbounded.** No retention or privacy statement for uploaded traces/match history. → Cost under donations-only model; honesty value. → Retention policy in data model + link from telemetry section.

## F. Scalability & terminology

- **F1. Validation compute budgeting.** Replay cost per match; queue backpressure at daily-deadline peaks; degradation strategy. → Anti-cheat backbone of every persistent board. → Budget + degradation ladder + scale-out trigger metric.
- **F2. Terminology drift.** "Slow Effect"/"Slow"; "Extreme Survival"/"Extreme"; README's "(Orb Arena)" alias in no governing doc; "beacon/room actor/validator/GameHost" used normatively but defined only in missing v2. → Glossary exists to keep code, docs, UI in one vocabulary. → One canonicalization pass over GDD §15 + README; adopt or delete "Orb Arena" formally.

---

**Priority order:** D1 → A4/C4/A5 → A8/C1 → B1/B2 → D2 → A1/A2/A3 → remainder. Items marked **BLOCKING** gate the start of implementation Steps 4–6 in the refactoring roadmap.
