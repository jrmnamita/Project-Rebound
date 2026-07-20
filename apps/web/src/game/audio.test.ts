/**
 * ============================================================
 *  audio.test.ts — guarantees of the Audio system
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the audio layer's contracts with a fake AudioContext:
 *    recipes exist and stay short, the phase beat escalates, mute
 *    is truly silent, the context is lazy, and — most important —
 *    a broken audio environment NEVER throws into the game
 *    (silence is a supported way to play, GDD §4).
 * ============================================================
 */
import { describe, expect, it, vi } from 'vitest';
import { AudioFx, CUES, PHASE_PITCH, type SoundCue } from './audio.js';

/** A minimal fake of the Web Audio surface AudioFx touches,
 *  recording every scheduled tone for assertions. */
interface ScheduledTone {
  freq: number;
  start: number;
  stop: number;
}
function fakeContext(): { context: AudioContext; tones: ScheduledTone[]; resumed: () => boolean } {
  const tones: ScheduledTone[] = [];
  let resumed = false;
  const context = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    resume: () => {
      resumed = true;
      return Promise.resolve();
    },
    createGain: () => ({
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => undefined,
    }),
    createOscillator: () => {
      const tone: ScheduledTone = { freq: 0, start: 0, stop: 0 };
      tones.push(tone);
      return {
        type: 'sine',
        frequency: { setValueAtTime: (f: number) => (tone.freq = f) },
        connect: () => undefined,
        start: (t: number) => (tone.start = t),
        stop: (t: number) => (tone.stop = t),
      };
    },
  } as unknown as AudioContext;
  return { context, tones, resumed: () => resumed };
}

describe('Audio — the recipes (GDD §5.5: pops and chirps, never lingering)', () => {
  it('every documented cue has a recipe, and every recipe ends within one second', () => {
    for (const [name, steps] of Object.entries(CUES)) {
      expect(steps.length, name).toBeGreaterThan(0);
      const endMs = Math.max(...steps.map((s) => s.atMs + s.durationMs));
      expect(endMs, name).toBeLessThanOrEqual(1000);
    }
  });

  it('playing a cue schedules exactly its steps, pitch-scaled as asked', () => {
    const fake = fakeContext();
    const fx = new AudioFx(() => fake.context);
    fx.play('checkpoint', 2);
    expect(fake.tones).toHaveLength(CUES.checkpoint.length);
    expect(fake.tones[0]?.freq).toBe((CUES.checkpoint[0]?.freqHz ?? 0) * 2);
  });
});

describe('Audio — the phase beat escalates (GDD §8.5: shared act breaks, hotter each time)', () => {
  it('PHASE_PITCH rises strictly across the four phases', () => {
    expect(PHASE_PITCH).toHaveLength(4);
    for (let i = 1; i < PHASE_PITCH.length; i += 1) {
      expect(PHASE_PITCH[i]).toBeGreaterThan(PHASE_PITCH[i - 1] as number);
    }
  });

  it('phaseBeat(3) plays the phase cue higher than phaseBeat(0), and clamps past the table', () => {
    const first = fakeContext();
    new AudioFx(() => first.context).phaseBeat(0);
    const last = fakeContext();
    new AudioFx(() => last.context).phaseBeat(3);
    const clamped = fakeContext();
    new AudioFx(() => clamped.context).phaseBeat(99);
    expect(last.tones[0]?.freq).toBeGreaterThan(first.tones[0]?.freq ?? Infinity * -1);
    expect(clamped.tones[0]?.freq).toBe(last.tones[0]?.freq);
  });
});

describe('Audio — mute and laziness (silence is free and honored)', () => {
  it('creates no AudioContext until the first audible play', () => {
    const factory = vi.fn(fakeContext().context ? () => fakeContext().context : undefined as never);
    const fx = new AudioFx(factory as () => AudioContext);
    fx.setMuted(true);
    fx.play('jump');
    expect(factory).not.toHaveBeenCalled(); // muted play costs nothing
    fx.setMuted(false);
    fx.play('jump');
    expect(factory).toHaveBeenCalledTimes(1); // first audible sound pays
  });

  it('muted play schedules nothing; unmuting restores sound', () => {
    const fake = fakeContext();
    const fx = new AudioFx(() => fake.context);
    fx.setMuted(true);
    fx.play('death');
    expect(fake.tones).toHaveLength(0);
    fx.setMuted(false);
    fx.play('death');
    expect(fake.tones).toHaveLength(CUES.death.length);
  });

  it('unlock resumes a suspended context (the mobile first-tap ritual)', () => {
    const fake = fakeContext();
    const fx = new AudioFx(() => fake.context);
    fx.play('jump'); // creates the (suspended) context
    fx.unlock();
    expect(fake.resumed()).toBe(true);
  });
});

describe('Audio — failure degrades to silence, never to a crash (CODING_STANDARDS §10; GDD §4)', () => {
  it('a broken audio environment never throws, warns exactly once, and stays silent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fx = new AudioFx(() => {
      throw new Error('no audio hardware');
    });
    const cues: SoundCue[] = ['jump', 'land', 'death', 'phase'];
    for (const cue of cues) {
      expect(() => fx.play(cue)).not.toThrow();
    }
    expect(warn).toHaveBeenCalledTimes(1); // one honest warning, then quiet
    warn.mockRestore();
  });
});
