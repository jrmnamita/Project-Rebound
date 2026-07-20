/**
 * ============================================================
 *  terrain-render.ts — drawing the world the sim describes
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Renders one terrain chunk into a Phaser Graphics object:
 *    ground silhouette, platforms, spikes, hazard stripes,
 *    checkpoint flags, and pickup crates. Pure translation from
 *    sim data to pixels — it draws WHAT IS, it decides nothing.
 *
 *  WHY IT EXISTS (design anchor)
 *    - GDD §6.2: the vocabulary must stay "instantly readable at
 *      extreme speed" — every element gets one unmistakable
 *      signature: grass-topped earth, floating slabs, warning-
 *      striped hazard ground, bright triangle spikes, celebratory
 *      checkpoint flags (§8.4 "visible, celebratory markers").
 *    - CODING_STANDARDS §7: presentation renders results. The
 *      renderer never re-derives rules — a spike kills because the
 *      sim says so; here it is only a triangle.
 *    - Colors are RENDER_COLORS placeholders pending the identity
 *      pass (ARCHITECTURE §2.7), same status as theme.ts.
 *
 *  HOW IT FITS
 *    The scene keeps one Graphics per loaded chunk (created when a
 *    chunk enters the window, destroyed when pruned) — a chunk's
 *    pixels are drawn once, then just scroll; nothing is redrawn
 *    per frame.
 * ============================================================
 */

import type { Chunk } from '@rebound/sim-core';
import { SPIKE } from '@rebound/sim-core';
import type Phaser from 'phaser';

/** Placeholder world palette (identity-pass-owned, GDD §14 Q5). */
export const RENDER_COLORS = {
  earth: 0x2e2a4f,
  grass: 0x4ade80,
  platform: 0x818cf8,
  spike: 0xe2e8f0,
  hazard: 0xfb7185,
  checkpoint: 0xfbbf24,
  pickup: 0x38bdf8,
} as const;

/** How far below the deepest ground the earth fill extends — purely
 *  cosmetic depth; the kill plane is a sim rule, not a pixel. */
const EARTH_DEPTH = 900;
const GRASS_THICKNESS = 8;

/**
 * Purpose: Draw one chunk into the given Graphics object.
 *
 * Inputs: g — a fresh (or cleared) Phaser Graphics positioned at
 * world origin; chunk — the sim's readonly chunk data.
 * Outputs: none. Side effects: drawing commands on g only.
 * Related systems: called by scene.ts when a chunk enters the
 * window; chunk data comes from Terrain.loadedChunks.
 */
export function drawChunk(g: Phaser.GameObjects.Graphics, chunk: Chunk): void {
  // Ground: each segment becomes a filled quad down to cosmetic
  // depth, with a grass line on top — gaps render as nothing, which
  // is exactly what they are (vocabulary.ts: absence is the truth).
  for (const seg of chunk.groundSegments) {
    g.fillStyle(RENDER_COLORS.earth, 1);
    g.fillPoints(
      [
        { x: seg.x0, y: seg.y0 },
        { x: seg.x1, y: seg.y1 },
        { x: seg.x1, y: seg.y1 + EARTH_DEPTH },
        { x: seg.x0, y: seg.y0 + EARTH_DEPTH },
      ],
      true,
    );
    g.lineStyle(GRASS_THICKNESS, RENDER_COLORS.grass, 1);
    g.lineBetween(seg.x0, seg.y0, seg.x1, seg.y1);
  }

  // Hazard zones: warning stripes ON the ground — marked, not
  // hidden (GDD §6.2: hazard zones demand a plan, so they must
  // read from the full lookahead distance).
  g.lineStyle(6, RENDER_COLORS.hazard, 0.9);
  for (const hz of chunk.hazardZones) {
    for (let x = hz.x0; x < hz.x1; x += 34) {
      g.lineBetween(x, findSurfaceY(chunk, x) - 4, Math.min(x + 18, hz.x1), findSurfaceY(chunk, x) - 12);
    }
  }

  // Floating platforms: slabs with a bright top edge (§6.2's
  // optional high route reads as landable at a glance).
  for (const p of chunk.platforms) {
    g.fillStyle(RENDER_COLORS.platform, 1);
    g.fillRect(p.x0, p.y, p.x1 - p.x0, 14);
    g.lineStyle(4, RENDER_COLORS.grass, 1);
    g.lineBetween(p.x0, p.y, p.x1, p.y);
  }

  // Spikes: bright triangles — small, precise, unmistakable (§6.2).
  g.fillStyle(RENDER_COLORS.spike, 1);
  for (const s of chunk.spikes) {
    g.fillTriangle(
      s.x - SPIKE.HALF_WIDTH, s.y,
      s.x + SPIKE.HALF_WIDTH, s.y,
      s.x, s.y - SPIKE.HEIGHT,
    );
  }

  // Checkpoints: a flag on a pole — visible and celebratory (§8.4),
  // planted on the safe pad the generator guarantees.
  for (const cx of chunk.checkpointXs) {
    const baseY = findSurfaceY(chunk, cx);
    g.lineStyle(5, RENDER_COLORS.checkpoint, 1);
    g.lineBetween(cx, baseY, cx, baseY - 88);
    g.fillStyle(RENDER_COLORS.checkpoint, 1);
    g.fillTriangle(cx, baseY - 88, cx, baseY - 62, cx + 34, baseY - 75);
  }

  // Pickups: glowing crates on the high route (§11.2).
  for (const pk of chunk.pickups) {
    g.fillStyle(RENDER_COLORS.pickup, 1);
    g.fillRoundedRect(pk.x - 14, pk.y - 14, 28, 28, 6);
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeRoundedRect(pk.x - 14, pk.y - 14, 28, 28, 6);
  }
}

/** Surface height at x within one chunk — the renderer's local copy
 *  of linear interpolation (drawing convenience; the SIM's authority
 *  on this question is Terrain.groundSurfaceAt). */
function findSurfaceY(chunk: Chunk, x: number): number {
  for (const seg of chunk.groundSegments) {
    if (x >= seg.x0 && x <= seg.x1) {
      return seg.y0 + ((x - seg.x0) / (seg.x1 - seg.x0)) * (seg.y1 - seg.y0);
    }
  }
  return 0;
}
