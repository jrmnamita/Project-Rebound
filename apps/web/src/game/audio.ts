/**
 * ============================================================
 *  audio.ts — the Audio system: pops, chirps, and the phase beat
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Synthesizes every sound effect in the game with the Web Audio
 *    API — no audio files. Each game event has a CUE: a tiny recipe
 *    of oscillator tones (data, not code) that the AudioFx player
 *    schedules when asked. The GameHost (Game Loop module) will call
 *    one method per simulation event; nothing here decides WHEN
 *    something sounds — only HOW it sounds.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §5.5 (lightness): "cheerful, readable, a little cheeky.
 *      Emoji avatars, satisfying pops and bounces." The recipes
 *      below are pops and chirps by construction — short, bright,
 *      square/triangle-wave arcade timbres. Losing is comedy: the
 *      death sound is a descending cartoon boing, not a doom chord.
 *    - GDD §8.5: phase transitions are "announced and felt — a
 *      visual/audio beat the whole room shares." phaseBeat() is that
 *      beat, and it rises in pitch with each phase — the same
 *      escalation the PhaseBanner shows in color.
 *    - GDD §4: the primary persona plays "often with sound off."
 *      THE RULE THIS IMPLIES: every sound here DOUBLES something
 *      visual (squash on jump, banner on phase, flash on
 *      checkpoint). Audio is seasoning; it may never be the only
 *      carrier of information a player needs. Any future cue that
 *      breaks this rule is a design violation, not a taste choice.
 *
 *  WHY SYNTHESIS INSTEAD OF AUDIO FILES
 *    The identity/art-direction pass has not happened (GDD §14 Q5;
 *    ARCHITECTURE §2.7 — identity starts from zero). Committing
 *    placeholder .mp3/.wav binaries would bake stand-in identity
 *    into repository history forever; a few dozen lines of tone
 *    recipes are replaceable in one commit and weigh nothing. When
 *    the identity pass lands, recipes may become curated samples —
 *    behind this same class, so no caller changes.
 *
 *  HOW IT FITS
 *    Presentation layer, outside the determinism boundary — the
 *    simulation neither knows nor cares that sound exists (the
 *    dependency arrow means sim-core cannot even reach this file).
 *    Mute state is in-memory only for now: persisting it belongs to
 *    the services layer (CODING_STANDARDS §7 — no localStorage
 *    outside a service implementation), wired when services land.
 *
 *  WHAT IT MUST NEVER DO
 *    Throw into the game loop (no sound is ever worth a crash —
 *    CODING_STANDARDS §10: presentation degrades, never masks), be
 *    required for play, or influence the simulation in any way.
 * ============================================================
 */

/**
 * Purpose: One tone in a cue — when it starts, what it sounds like,
 * how long, how loud.
 *
 * Why data instead of code: recipes-as-data can be inspected,
 * tested, and eventually swapped for the real identity's sounds
 * without touching playback logic. It is the same split as terrain
 * vocabulary vs. generator: definitions here, execution below.
 */
export interface ToneStep {
  readonly atMs: number;
  readonly freqHz: number;
  readonly durationMs: number;
  readonly type: OscillatorType;
  /** Peak gain 0..1 — every step decays to silence from this. */
  readonly gain: number;
}

/** The game events that make a sound. One name per documented beat —
 *  the GameHost maps simulation events onto exactly these. */
export type SoundCue =
  | 'jump'
  | 'land'
  | 'death'
  | 'checkpoint'
  | 'pickup'
  | 'phase'
  | 'newBest';

/**
 * Purpose: The sound identity of the game, as tone recipes.
 *
 * Why these shapes (each is a §5.5 "pop" with a job):
 *   jump       — a quick upward blip: effort, going up.
 *   land       — a low thump: the "satisfying thud of a good
 *                landing" (GDD §1).
 *   death      — a descending cartoon boing: comedy, not punishment
 *                (GDD §5.5 "losing is comedy").
 *   checkpoint — a bright two-note ding: celebratory markers
 *                (GDD §8.4 "visible, celebratory").
 *   pickup     — a rising sparkle: something good just happened.
 *   phase      — the shared act-break beat (GDD §8.5); pitch is
 *                multiplied per phase by phaseBeat().
 *   newBest    — a little fanfare: delight (GDD §5.5 "winning is
 *                delight").
 * All cues are short (< 1 s): sounds punctuate a 60 Hz game; they
 * never linger over it.
 */
export const CUES: Record<SoundCue, readonly ToneStep[]> = {
  jump: [{ atMs: 0, freqHz: 380, durationMs: 70, type: 'square', gain: 0.12 }],
  land: [{ atMs: 0, freqHz: 140, durationMs: 60, type: 'triangle', gain: 0.16 }],
  death: [
    { atMs: 0, freqHz: 520, durationMs: 90, type: 'square', gain: 0.18 },
    { atMs: 90, freqHz: 340, durationMs: 90, type: 'square', gain: 0.16 },
    { atMs: 180, freqHz: 180, durationMs: 160, type: 'square', gain: 0.14 },
  ],
  checkpoint: [
    { atMs: 0, freqHz: 660, durationMs: 80, type: 'triangle', gain: 0.14 },
    { atMs: 90, freqHz: 880, durationMs: 120, type: 'triangle', gain: 0.14 },
  ],
  pickup: [
    { atMs: 0, freqHz: 700, durationMs: 60, type: 'square', gain: 0.12 },
    { atMs: 60, freqHz: 1050, durationMs: 90, type: 'square', gain: 0.12 },
  ],
  phase: [
    { atMs: 0, freqHz: 440, durationMs: 110, type: 'square', gain: 0.16 },
    { atMs: 120, freqHz: 440, durationMs: 110, type: 'square', gain: 0.16 },
    { atMs: 240, freqHz: 587, durationMs: 220, type: 'square', gain: 0.18 },
  ],
  newBest: [
    { atMs: 0, freqHz: 523, durationMs: 100, type: 'triangle', gain: 0.15 },
    { atMs: 110, freqHz: 659, durationMs: 100, type: 'triangle', gain: 0.15 },
    { atMs: 220, freqHz: 784, durationMs: 100, type: 'triangle', gain: 0.15 },
    { atMs: 330, freqHz: 1046, durationMs: 240, type: 'triangle', gain: 0.17 },
  ],
};

/**
 * Purpose: How much the phase beat's pitch rises per phase index
 * (0 = Normal … 3 = Extreme Survival).
 *
 * Why it exists: GDD §8.5's act breaks escalate — the same beat,
 * a step hotter each time, mirrors PHASE_COLORS heating up in
 * theme.ts. Semitone-ish steps (≈ ×1.19 per phase) keep it musical
 * rather than shrill. DRAFT values, identity-pass-owned.
 */
export const PHASE_PITCH: readonly number[] = [1, 1.19, 1.41, 1.68];

/**
 * Purpose: The sound player — owns the AudioContext lifecycle,
 * the mute switch, and cue scheduling.
 *
 * Why it is a class: it carries real state across the whole session
 * (the lazily created AudioContext, mute, the failed-permanently
 * flag) — CODING_STANDARDS §6's stateful-lifecycle case.
 *
 * Why the constructor takes a context factory: Web Audio does not
 * exist in the headless test environment, and the class must be
 * fully testable (audio.test.ts injects a fake). Callers in the real
 * app construct with no arguments.
 *
 * Side effects: creates audio nodes on the injected/real context
 * when playing. Never throws past its own boundary — see play().
 */
export class AudioFx {
  private context: AudioContext | null = null;
  private muted = false;
  /** Set once if audio cannot exist here (no API, blocked, broken):
   *  the game plays on in silence, exactly as it must (GDD §4). */
  private unavailable = false;
  private warnedOnce = false;

  constructor(
    private readonly createContext: () => AudioContext = () =>
      new (window.AudioContext ?? (window as never))(),
  ) {}

  /**
   * Purpose: Mute control — the player's choice, honored instantly.
   * Why in-memory only: persistence is the services layer's job
   * (see file header). The UI module's future settings surface
   * calls this; nothing else does.
   * Inputs: muted — the new state. Outputs: none.
   * Side effects: silences/enables all future cues; sounds already
   * scheduled are shorter than any human toggle, so they finish.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Purpose: Resume the AudioContext after a user gesture.
   *
   * Why it exists: mobile browsers create AudioContexts suspended
   * until a gesture — a game whose FIRST input is a tap has the
   * perfect unlock moment. The GameHost calls this on the first
   * press of a session; calling it any other time is harmless.
   * Inputs/Outputs: none. Side effects: resumes the context if one
   * exists and is suspended; never throws.
   */
  unlock(): void {
    if (this.context !== null && this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined);
    }
  }

  /**
   * Purpose: Play one cue — the only way sound happens.
   *
   * Why the shape: lazy context creation (first sound of the
   * session creates it — nothing is paid for silence-lovers);
   * mute and unavailability checked first (silence is FREE); every
   * failure is swallowed after one console.warn — a sound system
   * failure must degrade to silence, never to a crash or a masked
   * error elsewhere (CODING_STANDARDS §10).
   *
   * Inputs: cue — which recipe; pitchMultiplier — scales every
   * frequency (phaseBeat uses it; 1 = as written).
   * Outputs: none.
   * Side effects: schedules oscillator/gain nodes on the context.
   * Related systems: called by the GameHost on simulation events;
   * recipes in CUES; escalation table in PHASE_PITCH.
   */
  play(cue: SoundCue, pitchMultiplier = 1): void {
    if (this.muted || this.unavailable) return;
    try {
      this.context ??= this.createContext();
      const now = this.context.currentTime;
      for (const step of CUES[cue]) {
        const osc = this.context.createOscillator();
        const gainNode = this.context.createGain();
        const start = now + step.atMs / 1000;
        const end = start + step.durationMs / 1000;
        osc.type = step.type;
        osc.frequency.setValueAtTime(step.freqHz * pitchMultiplier, start);
        gainNode.gain.setValueAtTime(step.gain, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, end);
        osc.connect(gainNode);
        gainNode.connect(this.context.destination);
        osc.start(start);
        osc.stop(end);
      }
    } catch (error) {
      // One honest warning, then permanent silence — never a rethrow
      // into the game loop (CODING_STANDARDS §10).
      this.unavailable = true;
      if (!this.warnedOnce) {
        this.warnedOnce = true;
        console.warn('AudioFx: audio unavailable, continuing silently.', error);
      }
    }
  }

  /**
   * Purpose: The phase-transition beat, escalated for the phase
   * reached — GDD §8.5's shared act break, made audible.
   * Inputs: phaseIndex — 0 (Normal) … 3 (Extreme Survival); indexes
   * past the table reuse its last (hottest) entry.
   * Outputs: none. Side effects: as play().
   */
  phaseBeat(phaseIndex: number): void {
    const pitch =
      PHASE_PITCH[Math.min(phaseIndex, PHASE_PITCH.length - 1)] ?? 1;
    this.play('phase', pitch);
  }
}
