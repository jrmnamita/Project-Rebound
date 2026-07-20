/**
 * ============================================================
 *  replay.ts — traces: a whole match in a few kilobytes
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Records a match as (seed, simVersion, curveId, per-tick input
 *    frames) and replays such a trace into a fresh Simulation —
 *    reproducing the entire match, tick for tick, hash for hash.
 *
 *  WHY IT EXISTS (design anchor)
 *    One mechanism, three documented features (which is why it is
 *    one file — FOLDER_STRUCTURE §4):
 *      - VALIDATION (ARCHITECTURE §2.3): the Phase 2 validator
 *        replays (seed, inputs, event log) and confirms the
 *        reported score — the anti-cheat backbone. The protocol's
 *        trace:upload message carries exactly this file's shape.
 *      - GHOSTS (GDD §10): "race your own best" replays the best
 *        trace in a second Simulation beside the live one — free,
 *        because replay exists.
 *      - THE DETERMINISM SUITE: record a match, replay it, compare
 *        hashes — the strongest possible same-game proof.
 *
 *  WHY INPUTS, NOT POSITIONS
 *    A position log could be edited into any story ("and then I
 *    scored a million"). An INPUT log cannot lie profitably: the
 *    simulation itself re-derives every consequence, so the only
 *    thing a forged trace can claim is button presses — and the
 *    physics decides what those were worth (Vision: anyone can
 *    verify "there is no house edge anywhere").
 *
 *  WHAT IT MUST NEVER DO
 *    Replay under different rules: a trace stamped with another
 *    SIM_VERSION refuses loudly (changed rules are a changed
 *    universe — constants.ts). No silent best-effort replays.
 * ============================================================
 */

import { SIM_VERSION } from './constants.js';
import { Simulation } from './sim.js';
import { hashMatchState } from './statehash.js';
import type { MatchPlayer } from './match.js';
import type { SimEvent } from './events.js';
import type { TickInputs } from './input.js';

/** The inputs of one tick that HAD any — empty ticks are omitted
 *  (most ticks are: the ball mostly rolls), which is what keeps a
 *  five-minute match a few kilobytes. */
export interface TraceFrame {
  readonly tick: number;
  readonly intents: TickInputs;
}

/** A complete, self-contained match recording — JSON-serializable
 *  as-is (the protocol's trace:upload payload is this shape). */
export interface InputTrace {
  readonly seed: string;
  readonly simVersion: number;
  readonly curveId: string;
  readonly playerIds: readonly string[];
  readonly frames: readonly TraceFrame[];
}

/**
 * Purpose: Collect a trace during a live match.
 *
 * Why a class: it accumulates across the match's lifecycle
 * (CODING_STANDARDS §6's stateful case). The driver (GameHost now,
 * room later) calls record() with each tick's drained inputs —
 * the SAME batch it hands the Simulation, which is the point:
 * what was played is what is recorded is what will replay.
 */
export class TraceRecorder {
  private readonly frames: TraceFrame[] = [];

  constructor(
    private readonly seed: string,
    private readonly curveId: string,
    private readonly playerIds: readonly string[],
  ) {}

  /** Record one tick's inputs (no-op for empty ticks — omission is
   *  the compression). Side effects: appends to the trace. */
  record(tick: number, intents: TickInputs): void {
    if (intents.length > 0) this.frames.push({ tick, intents });
  }

  /** The finished trace, stamped with the CURRENT rules version.
   *  Outputs a plain value — serialize it, store it, upload it. */
  toTrace(): InputTrace {
    return {
      seed: this.seed,
      simVersion: SIM_VERSION,
      curveId: this.curveId,
      playerIds: [...this.playerIds],
      frames: [...this.frames],
    };
  }
}

/** What a replay reports — enough to verify a claim (validator) or
 *  to drive a ghost (the caller steps its own sim instead). */
export interface ReplayResult {
  readonly ticks: number;
  readonly statehash: number;
  readonly players: readonly MatchPlayer[];
  readonly events: readonly SimEvent[];
}

/**
 * Purpose: Re-run a recorded match to its end and report what
 * happened — THE verification primitive.
 *
 * Why the rules-version check throws: replaying a v1 trace under v2
 * rules would produce a DIFFERENT match while claiming to be the
 * same one — a lie with a paper trail. Refusing is the honest
 * failure (CODING_STANDARDS §10); the caller decides what refusal
 * means (an expired ghost, a stale leaderboard entry).
 *
 * Inputs: trace — the recording; maxTicks — safety bound (a trace
 * cannot make a replay run forever — bounded work, same instinct as
 * the trap-placement scan).
 * Outputs: ReplayResult at match end (or at the bound).
 * Side effects: none observable — the Simulation it builds is its
 * own and is discarded.
 */
export function replayTrace(trace: InputTrace, maxTicks = 120_000): ReplayResult {
  if (trace.simVersion !== SIM_VERSION) {
    throw new Error(
      `replayTrace: trace is simVersion ${trace.simVersion}, rules are ${SIM_VERSION} — a changed universe cannot replay`,
    );
  }
  const sim = new Simulation({ seed: trace.seed, playerIds: trace.playerIds });
  const events: SimEvent[] = [];
  let frameIndex = 0;
  let ticks = 0;
  while (!sim.over && ticks < maxTicks) {
    ticks += 1;
    const frame = trace.frames[frameIndex];
    let inputs: TickInputs = [];
    if (frame !== undefined && frame.tick === ticks) {
      inputs = frame.intents;
      frameIndex += 1;
    }
    events.push(...sim.step(inputs));
  }
  return { ticks, statehash: sim.statehash(), players: sim.players, events };
}
