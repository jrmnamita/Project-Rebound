/**
 * ============================================================
 *  scene.ts — the Phaser scene: the world made visible
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Runs the render side of a match: keeps one Graphics per loaded
 *    terrain chunk, draws the ball with squash/stretch, applies the
 *    camera module's framing every frame, and — critically — hosts
 *    the fixed-timestep accumulator that drives the simulation
 *    through the GameHost's tick callback.
 *
 *  WHY IT EXISTS (design anchor)
 *    - ARCHITECTURE §3: "fixed 60-tick loop with render
 *      interpolation." Phaser's update() gives variable frame time;
 *      the accumulator converts it into zero-or-more EXACT ticks,
 *      and rendering interpolates between the last two sim states.
 *      The prototype ran physics per frame — the audit's fatal
 *      finding; this loop is the cure, in code.
 *    - GDD §5.1: squash/stretch and landing feedback are the juice —
 *      computed HERE from sim state, never stored in it
 *      (presentation reads results; ARCHITECTURE §2.7 blesses the
 *      techniques).
 *    - Camera behavior is camera.ts's pure math (§2.1); this scene
 *      only applies the returned frame. Identical framing for every
 *      player is inherited, not re-implemented.
 *
 *  WHAT IT MUST NEVER DO
 *    Step the simulation by frame-time, decide any gameplay
 *    outcome, or reach into sim internals beyond read-only
 *    snapshots. The scene is a spectator with a paintbrush.
 * ============================================================
 */

import Phaser from 'phaser';
import {
  CAMERA,
  computeFixedZoom,
  createCamera,
  frameCamera,
  stepCamera,
  type CameraState,
} from './camera.js';
import { drawChunk } from './terrain-render.js';
import type { Chunk, MatchPlayer, Terrain } from '@rebound/sim-core';

/** What the scene needs from its driver (the GameHost) — a
 *  consumer-defined seam, like every boundary in this codebase. */
export interface SceneDriver {
  /** Advance the simulation exactly one tick; false when the match
   *  is over (the accumulator then stops asking). */
  tick(): boolean;
  /** Read-only view of the running match for drawing. protectedNow
   *  is computed by the host from the sim clock — the scene never
   *  reasons about ticks (cosmetics only). */
  view(): {
    terrain: Terrain;
    me: MatchPlayer | undefined;
    baseSpeed: number;
    protectedNow: boolean;
  } | null;
}

const TICK_MS = 1000 / 60;
/** Accumulator clamp: after a background tab pause, simulate at most
 *  this many catch-up ticks per frame — the sim stays correct (ticks
 *  are ticks), the frame stays responsive. */
const MAX_TICKS_PER_FRAME = 5;

export class MatchScene extends Phaser.Scene {
  private driver: SceneDriver | null = null;
  private accumulatorMs = 0;
  private chunkGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  private ball: Phaser.GameObjects.Graphics | null = null;
  private cameraState: CameraState = createCamera({ x: 0, y: 0, vy: 0 });
  private zoom = 1;
  /** Previous-tick position for render interpolation. */
  private prevX = 0;
  private prevY = 0;

  constructor() {
    super('match');
  }

  /** Called by the GameHost when a match starts — binds the driver
   *  and resets all per-match render state. */
  bind(driver: SceneDriver): void {
    this.driver = driver;
    this.accumulatorMs = 0;
    for (const g of this.chunkGraphics.values()) g.destroy();
    this.chunkGraphics.clear();
    const view = driver.view();
    if (view?.me !== undefined) {
      this.cameraState = createCamera(view.me.player);
      this.prevX = view.me.player.x;
      this.prevY = view.me.player.y;
      this.zoom = computeFixedZoom(view.baseSpeed);
    }
  }

  create(): void {
    // A calm vertical gradient sky — placeholder identity, drawn
    // once, fixed to the camera (parallax layers arrive with the
    // identity pass; ARCHITECTURE §2.7).
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x101423, 0x101423, 0x1e2b4a, 0x1e2b4a, 1);
    sky.fillRect(0, 0, CAMERA.DESIGN_WIDTH, CAMERA.DESIGN_HEIGHT);
    sky.setScrollFactor(0);
    this.ball = this.add.graphics();
  }

  override update(_time: number, deltaMs: number): void {
    const driver = this.driver;
    if (driver === null) return;

    // ── The fixed-timestep accumulator (ARCHITECTURE §3) ──
    // Frame time pours in; whole ticks pour out. A 120 Hz frame
    // banks ~8 ms and often steps zero ticks; a 30 Hz frame steps
    // two. The SIMULATION never knows the frame rate exists.
    this.accumulatorMs = Math.min(this.accumulatorMs + deltaMs, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulatorMs >= TICK_MS) {
      this.accumulatorMs -= TICK_MS;
      const view = driver.view();
      if (view?.me !== undefined) {
        this.prevX = view.me.player.x;
        this.prevY = view.me.player.y;
      }
      if (!driver.tick()) break;
    }

    const view = driver.view();
    if (view === null || view.me === undefined) return;
    this.syncChunks(view.terrain);

    // ── Render interpolation: draw BETWEEN the last two ticks ──
    // alpha is how far into the next tick this frame falls; the ball
    // is drawn at the blended position, so 60 Hz sim looks smooth at
    // any refresh rate (ARCHITECTURE §3: render interpolation).
    const alpha = this.accumulatorMs / TICK_MS;
    const body = view.me.player;
    const drawX = this.prevX + (body.x - this.prevX) * alpha;
    const drawY = this.prevY + (body.y - this.prevY) * alpha;

    this.drawBall(drawX, drawY, body.vy, view.me, view.protectedNow);

    // ── Camera: pure math in, frame out (camera.ts) ──
    this.cameraState = stepCamera(this.cameraState, { x: drawX, y: drawY, vy: body.vy }, deltaMs);
    const frame = frameCamera(this.cameraState, { x: drawX, y: drawY, vy: body.vy }, this.zoom);
    this.cameras.main.setZoom(frame.zoom);
    this.cameras.main.setScroll(frame.worldLeft, frame.worldTop);
  }

  /** Keep one Graphics per loaded chunk: draw on arrival, destroy on
   *  prune — pixels are made once and then only scroll. */
  private syncChunks(terrain: Terrain): void {
    const loaded = new Set<number>();
    for (const chunk of terrain.loadedChunks) {
      loaded.add(chunk.idx);
      if (!this.chunkGraphics.has(chunk.idx)) {
        const g = this.add.graphics();
        drawChunk(g, chunk as Chunk);
        this.chunkGraphics.set(chunk.idx, g);
      }
    }
    for (const [idx, g] of this.chunkGraphics) {
      if (!loaded.has(idx)) {
        g.destroy();
        this.chunkGraphics.delete(idx);
      }
    }
  }

  /** The ball: a circle with velocity-driven squash/stretch — the
   *  §5.1 juice, computed from vy each frame, stored nowhere. The
   *  protection blink makes the §8.3 immunity window VISIBLE — an
   *  invisible mechanic would make deaths illegible (GDD §5.2). */
  private drawBall(x: number, y: number, vy: number, me: MatchPlayer, protectedNow: boolean): void {
    const g = this.ball;
    if (g === null) return;
    g.clear();
    if (!me.alive) return; // between death and respawn: no body
    const stretch = Math.min(Math.abs(vy) * 0.02, 0.3);
    const radius = 20; // mirrors PHYSICS.PLAYER_RADIUS — what you see is what collides
    const blinking = protectedNow && Math.floor(this.time.now / 120) % 2 === 0;
    g.fillStyle(0x38bdf8, blinking ? 0.45 : 1);
    g.fillEllipse(x, y, radius * 2 * (1 - stretch), radius * 2 * (1 + stretch));
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(x - radius * 0.3, y - radius * 0.35, radius * 0.7, radius * 0.45);
  }
}
