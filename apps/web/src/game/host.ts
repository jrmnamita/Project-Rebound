/**
 * ============================================================
 *  host.ts — the GameHost: the ONLY bridge between worlds
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Owns the running match from the outside: constructs the
 *    Simulation, feeds it validated input intents, translates its
 *    events into store updates and audio cues, drives the Phaser
 *    scene, and implements the UI's GameIntents. This is the one
 *    file in the repository allowed to import BOTH sim-core and
 *    presentation — by structural decree (FOLDER_STRUCTURE §4).
 *
 *  WHY IT EXISTS (design anchor)
 *    ARCHITECTURE §3: "React ⟂ Phaser ⟂ sim-core separation and the
 *    GameHost bridge." Everything the three worlds must say to each
 *    other passes through here, in one direction each:
 *      pointer events → IntentBuffer → sim.step()
 *      sim events     → store (HUD/banner/results) + AudioFx
 *      sim snapshots  → scene (drawing) via the SceneDriver seam
 *    No other file may know more than one world exists.
 *
 *  FLAGGED DECISIONS
 *    - REMATCH replays the SAME seed (mastery of one world; the
 *      future ghost feature needs a stable seed — GDD §10), while
 *      menu → PRACTICE rolls a fresh seed. Working default, easily
 *      reversed.
 *    - Best score now PERSISTS via @rebound/services (the Utilities
 *      module closed the in-memory stopgap): browser storage when
 *      it truly works, memory otherwise — a private-mode player
 *      loses convenience, never the game.
 *
 *  WHAT IT MUST NEVER DO
 *    Contain a gameplay rule (it sequences and translates), or let
 *    render/UI code reach the Simulation except through it.
 * ============================================================
 */

import Phaser from 'phaser';
import {
  CURVE_DRAFT_1,
  IntentBuffer,
  Simulation,
  isProtected,
  speedAt,
  type SimEvent,
} from '@rebound/sim-core';
import { LocalBestStore, MemoryStore, browserStorage } from '@rebound/services';
import { MatchScene, type SceneDriver } from './scene.js';
import { AudioFx } from './audio.js';
import { CAMERA } from './camera.js';
import { useUiStore, type GameIntents } from '../state/store.js';

const LOCAL_PLAYER_ID = 'local';

/**
 * Purpose: Run matches for this browser session — construct with the
 * mount element once; use as the App's GameIntents forever after.
 *
 * Why a class: session-long lifecycle (Phaser game instance, audio,
 * current simulation, session best) — CODING_STANDARDS §6.
 */
export class GameHost implements GameIntents {
  private readonly game: Phaser.Game;
  private readonly scene: MatchScene;
  private readonly audio = new AudioFx();
  private readonly buffer = new IntentBuffer();
  private sim: Simulation | null = null;
  private currentSeed = newSeed();
  /** Persistent best via the services layer (interfaces in
   *  @rebound/services; composition — which implementation — is
   *  decided here and nowhere else, ARCHITECTURE §3). */
  private readonly bestStore = new LocalBestStore(browserStorage() ?? new MemoryStore());

  constructor(mount: HTMLElement) {
    this.scene = new MatchScene();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mount,
      width: CAMERA.DESIGN_WIDTH,
      height: CAMERA.DESIGN_HEIGHT,
      backgroundColor: '#101423',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: this.scene,
    });
    this.bindPointerInput(mount);
  }

  // ── GameIntents (the UI's only requests — store.ts) ──

  /** Menu → PRACTICE: a fresh world (new seed each visit). */
  startPractice(): void {
    this.currentSeed = newSeed();
    this.startMatch();
  }

  /** Results → REMATCH: the SAME world again, one tap (GDD §7's
   *  two-tap budget, half spent). Same seed = comparable runs and,
   *  later, ghosts (GDD §10). */
  rematch(): void {
    this.startMatch();
  }

  backToMenu(): void {
    this.sim = null;
    useUiStore.getState().showMenu();
  }

  // ── The bridge internals ──

  private startMatch(): void {
    this.sim = new Simulation({ seed: this.currentSeed, playerIds: [LOCAL_PLAYER_ID] });
    this.buffer.reset(); // a stale held thumb must not eat the first press (input.ts)
    this.scene.bind({
      tick: () => this.tick(),
      view: () => this.view(),
    });
    useUiStore.getState().showPlaying();
    this.pushHud();
  }

  /** One simulation tick: drain validated intents, step, translate
   *  events. Called only by the scene's fixed-step accumulator —
   *  the host owns WHAT happens per tick, the scene owns WHEN. */
  private tick(): boolean {
    const sim = this.sim;
    if (sim === null || sim.over) return false;
    const events = sim.step(this.buffer.drainTick());
    for (const event of events) this.onEvent(event);
    if (sim.tick % 6 === 0) this.pushHud(); // 10 Hz HUD refresh — plenty for numbers
    return !sim.over;
  }

  /** Sim events → presentation, one honest translation each.
   *  (Pickup consequences await the Effects module — today a pickup
   *  is a chirp and an event, changing no gameplay state.) */
  private onEvent(event: SimEvent): void {
    const store = useUiStore.getState();
    switch (event.type) {
      case 'jumped': this.audio.play('jump'); break;
      case 'landed': this.audio.play('land'); break;
      case 'checkpoint': this.audio.play('checkpoint'); break;
      case 'pickup': this.audio.play('pickup'); break;
      case 'death': this.audio.play('death'); break;
      case 'respawn': this.pushHud(); break;
      case 'eliminated': break; // solo: matchOver follows immediately
      case 'phaseChanged':
        store.announcePhase(event.phaseName);
        this.audio.phaseBeat(event.phaseIndex);
        break;
      case 'matchOver': this.finishMatch(); break;
    }
  }

  private finishMatch(): void {
    const sim = this.sim;
    const me = sim?.playerById(LOCAL_PLAYER_ID);
    if (sim === undefined || sim === null || me === undefined) return;
    const score = Math.floor(me.score);
    // The store makes the one judgment (services/best-runs.ts:
    // callers never re-derive "new best") and persists it.
    const verdict = this.bestStore.submit(score);
    if (verdict.isNewBest) this.audio.play('newBest');
    useUiStore.getState().showResults({
      score,
      bestScore: verdict.best,
      isNewBest: verdict.isNewBest,
      phaseReached: sim.phaseName,
    });
  }

  /** Snapshot for HUD + solo live board (a row of one — the same
   *  component Phase 2 fills with rivals; GDD §9). */
  private pushHud(): void {
    const sim = this.sim;
    const me = sim?.playerById(LOCAL_PLAYER_ID);
    if (sim === undefined || sim === null || me === undefined) return;
    const store = useUiStore.getState();
    store.updateHud({
      score: me.score,
      bestScore: this.bestStore.getBest(),
      lives: me.lives,
      phaseName: sim.phaseName,
      spawnProtected: isProtected(me, sim.tick),
    });
    store.updateBoard([
      {
        id: LOCAL_PLAYER_ID,
        avatar: '🟦',
        name: 'You',
        score: me.score,
        lives: me.lives,
        eliminated: me.eliminated,
        isSelf: true,
      },
    ]);
  }

  private view(): ReturnType<SceneDriver['view']> {
    const sim = this.sim;
    if (sim === null) return null;
    const me = sim.playerById(LOCAL_PLAYER_ID);
    return {
      terrain: sim.world,
      me,
      baseSpeed: speedAt(CURVE_DRAFT_1, 0),
      protectedNow: me !== undefined && isProtected(me, sim.tick),
    };
  }

  /** The whole screen is the jump button (GDD §12 Pillar 1): press
   *  and release anywhere become intents; the first press also
   *  unlocks mobile audio (audio.ts's gesture ritual). The
   *  IntentBuffer, not this handler, is the validator — capture
   *  stays dumb on purpose (input.ts owns the rules). */
  private bindPointerInput(mount: HTMLElement): void {
    mount.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.audio.unlock();
      this.buffer.record(LOCAL_PLAYER_ID, 'press');
    });
    window.addEventListener('pointerup', () => {
      this.buffer.record(LOCAL_PLAYER_ID, 'release');
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) this.buffer.record(LOCAL_PLAYER_ID, 'press');
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.buffer.record(LOCAL_PLAYER_ID, 'release');
    });
  }
}

/** A fresh world seed — Math.random is LEGAL here (outside the
 *  determinism boundary): choosing a seed is an app decision; the
 *  seed itself is what determinism flows from (rng.ts). */
function newSeed(): string {
  return `practice-${Math.random().toString(36).slice(2, 10)}`;
}
