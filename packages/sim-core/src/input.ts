/**
 * ============================================================
 *  input.ts — the Input System: how one thumb becomes game data
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Project Rebound has exactly one gameplay control: the jump.
 *    Press to jump, keep holding to jump higher, release to cut the
 *    jump short. This file defines how that single physical action
 *    is represented as data — the "input intent" — and provides the
 *    IntentBuffer, which collects raw press/release signals from the
 *    outside world and turns them into a clean, validated, ordered
 *    list of intents for each simulation tick.
 *
 *    Think of it as the customs checkpoint at the border of the
 *    simulation: chaotic real-world events (touchscreens, keyboards,
 *    later the network) arrive on one side; only orderly, verified
 *    intents come out the other.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §6.1: "The only player input is the jump: tap → normal
 *      jump, hold → higher jump." Tap and hold are both built from
 *      just two signals — press and release — so two intent types
 *      are all this game will ever need.
 *    - GDD §12 Pillar 1: "One input. Jumping (tap/hold) is the only
 *      gameplay control. Forever." This file is that pillar in code:
 *      there is deliberately nowhere to add a second verb.
 *    - ARCHITECTURE §3: the "input-intent model" is a foundational,
 *      unchanged decision — intents are the unit that gets recorded
 *      for replays, validated after matches, and (in Phase 2)
 *      stamped onto ticks by the multiplayer room.
 *
 *  HOW IT FITS
 *    Capture code (the GameHost, built later in the Game Loop
 *    module) listens to pointer/keyboard events and calls
 *    IntentBuffer.record(). Once per simulation tick, the fixed-step
 *    loop calls drainTick() and hands the result to the simulation.
 *    The replay recorder stores these same intents; the validator
 *    and ghost playback re-feed them. One data shape, four consumers.
 *
 *  WHAT IT MUST NEVER DO
 *    This file lives inside the determinism boundary. It must never
 *    read the clock, listen to browser events itself, or import
 *    anything. Its outputs must depend ONLY on the sequence of
 *    record() calls it received — same calls in, same intents out,
 *    on every machine in a match. That is what keeps all four
 *    players' simulations perfectly in agreement (GDD §12.7).
 * ============================================================
 */

/**
 * Purpose: The two signals a thumb can produce — the complete input
 * vocabulary of the game.
 *
 * Why it exists: GDD §6.1 defines tap and hold, but both are made of
 * the same two raw events: a press (thumb lands) and a release
 * (thumb lifts). A tap is a press quickly followed by a release; a
 * hold is a press with a late release. By storing the raw signals
 * instead of interpreted "tap"/"hold" labels, the *simulation*
 * decides what a press became — which keeps interpretation
 * deterministic and identical for live play, replays, and rivals.
 *
 * Related systems: consumed by the Player module (jump physics) and
 * the replay trace format.
 */
export type InputIntentType = 'press' | 'release';

/**
 * Purpose: One validated input event, attributed to one player.
 *
 * Why it exists: this is the atom of the input-intent model
 * (ARCHITECTURE §3). Everything a player ever "does" in Project
 * Rebound is a list of these — which is why a whole match's inputs
 * can be stored in a few kilobytes and replayed perfectly.
 *
 * Why playerId exists even in solo play: multiplayer is the primary
 * mode (GDD §9). In a 4-player room, every simulation processes
 * every player's intents; attributing each intent from day one means
 * the Phase 2 networking module transports this exact shape instead
 * of redesigning it.
 *
 * Inputs/Outputs: plain immutable data — `readonly` because an
 * intent, once recorded, is history; replays depend on history never
 * being edited.
 */
export interface InputIntent {
  readonly playerId: string;
  readonly type: InputIntentType;
}

/**
 * Purpose: Everything every player did during one simulation tick,
 * in the exact order it was accepted.
 *
 * Why it exists: the simulation advances in fixed 60-per-second
 * ticks (ARCHITECTURE §3, fixed-timestep decision). Inputs therefore
 * can't be applied "whenever they happen" — they are grouped into
 * per-tick batches so that every machine applies the same intents at
 * the same tick. Order inside a tick matters: at 60 ticks/second a
 * fast tap can press AND release inside a single tick, and the
 * player module must see the press first.
 */
export type TickInputs = readonly InputIntent[];

/**
 * Purpose: Upper bound on intents accepted from one player in one
 * tick (a tick is ~16.7 ms).
 *
 * Why it exists: boundary validation (CODING_STANDARDS §10 —
 * "validate at boundaries, trust inside"). A human thumb produces at
 * most a press+release pair in 16.7 ms; four slots is double that
 * physical ceiling. Anything beyond it is a malfunctioning device or,
 * in Phase 2, a flooding client — either way the simulation should
 * never see it. The cap also bounds replay-trace size, so no one can
 * fabricate a gigabyte "match" for the validator (ARCHITECTURE:
 * anti-cheat layers).
 *
 * Why it is not in constants.ts: this is a boundary-integrity limit,
 * not a gameplay-feel tunable — changing it must never change how
 * the game plays, only what abuse it tolerates. Gameplay tunables
 * will live in constants.ts (Utilities module) per CODING_STANDARDS
 * §11.
 */
export const MAX_INTENTS_PER_PLAYER_PER_TICK = 4;

/**
 * Purpose: Collects raw press/release signals between ticks,
 * validates them, and hands the simulation one clean batch per tick.
 *
 * Why it exists: the outside world is messy — keyboards auto-repeat
 * "keydown" while held, touchscreens occasionally double-fire, and
 * (in Phase 2) remote clients may send garbage. The simulation, by
 * contrast, must be able to trust its inputs completely
 * (CODING_STANDARDS §10). The IntentBuffer is the single place where
 * mess becomes trust. It enforces one physical truth: a thumb that
 * is already down cannot press again, and a thumb that is already up
 * cannot release.
 *
 * Why it is a class: it carries state across ticks (which thumbs are
 * currently down — a hold spans many ticks), which is exactly the
 * "stateful lifecycle" case CODING_STANDARDS §6 reserves classes for.
 *
 * Side effects: internal buffering only. It never touches the world;
 * determinism requires that its behavior depend solely on the
 * sequence of method calls it receives.
 *
 * Related systems: fed by the GameHost (Game Loop module); drained
 * into the Simulation each tick; the same validated stream is what
 * the replay recorder persists.
 */
export class IntentBuffer {
  /** Intents accepted since the last drainTick(), in arrival order. */
  private pending: InputIntent[] = [];

  /**
   * Whether each player's thumb is currently down. Persists across
   * ticks on purpose: a hold jump (GDD §6.1) is a press on one tick
   * and a release many ticks later — forgetting this between ticks
   * would make every hold look like a stuck key.
   */
  private readonly thumbIsDown = new Map<string, boolean>();

  /** Per-player count of intents accepted in the current tick window
   *  (resets at every drainTick) — enforces the flood cap. */
  private readonly acceptedThisTick = new Map<string, number>();

  /**
   * Purpose: Offer one raw press/release signal for validation and
   * buffering.
   *
   * Why it exists: this is the only doorway into the simulation's
   * input stream — capture code calls it for local pointer/keyboard
   * events now, and the Phase 2 room will call it for remote
   * players' signals. One doorway means one set of rules for
   * everyone, which is the fairness pillar (GDD §12.7) applied to
   * input handling.
   *
   * Inputs:
   *   playerId — which player's thumb produced the signal.
   *   type     — 'press' (thumb lands) or 'release' (thumb lifts).
   *
   * Outputs: true if the signal was accepted into the next tick's
   * batch; false if it was rejected as physically impossible or
   * flooding. Callers may ignore the result (capture code usually
   * does); tests and Phase 2 abuse monitoring use it.
   *
   * Side effects: on acceptance, appends to the pending batch and
   * updates the player's thumb state and flood counter.
   *
   * Related systems: gameplay rules implemented here —
   *   GDD §6.1 (tap/hold is built from press→release alternation),
   *   CODING_STANDARDS §10 (validate at the boundary).
   */
  record(playerId: string, type: InputIntentType): boolean {
    // Flood cap first: past this point in a single tick, nothing from
    // this player can be a real thumb — see MAX_INTENTS_PER_PLAYER_PER_TICK.
    const accepted = this.acceptedThisTick.get(playerId) ?? 0;
    if (accepted >= MAX_INTENTS_PER_PLAYER_PER_TICK) {
      return false;
    }

    // Alternation rule: a press is only valid when the thumb is up,
    // a release only when it is down. This single check absorbs
    // keyboard auto-repeat (repeated 'press' while held) and
    // double-fired touch events — the two most common real-world
    // corruptions of the one-input scheme (GDD §12 Pillar 1).
    const isDown = this.thumbIsDown.get(playerId) ?? false;
    if (type === 'press' && isDown) {
      return false;
    }
    if (type === 'release' && !isDown) {
      return false;
    }

    this.pending.push({ playerId, type });
    this.thumbIsDown.set(playerId, type === 'press');
    this.acceptedThisTick.set(playerId, accepted + 1);
    return true;
  }

  /**
   * Purpose: Close the current tick's input window and hand its
   * validated batch to the simulation.
   *
   * Why it exists: the fixed-timestep loop (ARCHITECTURE §3) calls
   * this exactly once per tick, which is what converts "signals that
   * happened at some real-world moment" into "intents that happened
   * at tick N" — the alignment every machine in a match must agree
   * on for their simulations to stay identical.
   *
   * Inputs: none.
   *
   * Outputs: the tick's intents in acceptance order (possibly empty —
   * most ticks are; the ball is usually rolling, not being tapped).
   * The returned array is a fresh snapshot: mutating it cannot
   * corrupt the buffer, and replay recording can keep it as-is.
   *
   * Side effects: clears the pending batch and the per-tick flood
   * counters. Deliberately does NOT clear thumb-down states — holds
   * span ticks (see thumbIsDown).
   *
   * Related systems: Game Loop module (caller), Simulation (consumer),
   * replay recorder (observer).
   */
  drainTick(): TickInputs {
    const batch = this.pending;
    this.pending = [];
    this.acceptedThisTick.clear();
    return batch;
  }

  /**
   * Purpose: Return the buffer to its just-constructed state.
   *
   * Why it exists: matches restart (the two-tap rematch, GDD §7) and
   * practice runs restart constantly ("one more game"). A stale
   * thumb-down state from a previous match would swallow the first
   * press of the next one — the player would tap and nothing would
   * happen, which violates "instantly responsive" (GDD §5.1) in the
   * worst possible moment.
   *
   * Inputs: none. Outputs: none.
   * Side effects: discards all pending intents, thumb states, and
   * flood counters.
   *
   * Related systems: called by match setup/teardown (Game Loop
   * module).
   */
  reset(): void {
    this.pending = [];
    this.thumbIsDown.clear();
    this.acceptedThisTick.clear();
  }
}
