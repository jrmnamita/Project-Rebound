/**
 * ============================================================
 *  procedural.test.ts — guarantees of the Procedural module
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Property-tests the generator across many seeds and chunks:
 *    bit-identical determinism, structural validity at the Terrain
 *    doorway, survivable-by-construction sizing (gaps vs. measured
 *    jump distances, platforms vs. measured rise), checkpoint
 *    safety, the risk/reward pickup weave, tier pacing — and the
 *    first full-stack proof: a player rolling across a generated
 *    world with the real physics.
 *
 *  WHY IT EXISTS (design anchor)
 *    The generator is where "the world is fair" is either
 *    manufactured or lost (GDD §6.2, §12.7). Guessed constants rot;
 *    these properties are checked against the REAL player/physics
 *    via computeJumpMetrics, so a future jump retune that breaks
 *    world fairness fails here, loudly, before any player sees it.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  CHUNK_LENGTH,
  GENERATION,
  PHYSICS,
  Terrain,
  chunkEndX,
  chunkStartX,
  computeJumpMetrics,
  createPlayer,
  extendTerrain,
  generateChunk,
  land,
  stepPhysics,
  validateChunk,
  type Chunk,
  type GenerationParams,
  type PlayerState,
} from '@rebound/sim-core';

const SEEDS = ['alpha', 'daily-2026-07-20', 'room-XKCD'];
const CHUNK_RANGE = 12; // covers tiers 0 through max
const params = (seed: string): GenerationParams => ({ seed });
const metrics = computeJumpMetrics(GENERATION.BASE_SPEED_UNITS_PER_TICK);

/** Gap spans of a chunk: distances between consecutive ground segments. */
function gapsOf(chunk: Chunk): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < chunk.groundSegments.length; i += 1) {
    const prev = chunk.groundSegments[i - 1];
    const next = chunk.groundSegments[i];
    if (prev && next && next.x0 > prev.x1) gaps.push(next.x0 - prev.x1);
  }
  return gaps;
}

describe('Procedural — determinism (the shared world, ARCHITECTURE §2.2)', () => {
  it('the same (seed, idx) produces bit-identical chunks, every time', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        expect(generateChunk(params(seed), idx)).toEqual(generateChunk(params(seed), idx));
      }
    }
  });

  it('different seeds produce different worlds; different chunks differ within a world', () => {
    const a = generateChunk(params('alpha'), 5);
    const b = generateChunk(params('beta'), 5);
    const c = generateChunk(params('alpha'), 6);
    expect(a).not.toEqual(b);
    expect(a.groundSegments).not.toEqual(c.groundSegments);
  });

  it('chunks are independently generatable — chunk 9 needs no knowledge of chunks 0..8', () => {
    // Generate out of order and compare against in-order generation.
    const outOfOrder = generateChunk(params('alpha'), 9);
    for (let idx = 0; idx < 9; idx += 1) generateChunk(params('alpha'), idx);
    expect(generateChunk(params('alpha'), 9)).toEqual(outOfOrder);
  });
});

describe('Procedural — structural honesty (validated at the world’s doorway)', () => {
  it('every generated chunk passes validateChunk and chains seamlessly into Terrain', () => {
    for (const seed of SEEDS) {
      const terrain = new Terrain();
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        const chunk = generateChunk(params(seed), idx);
        expect(() => validateChunk(chunk)).not.toThrow();
        expect(() => terrain.addChunk(chunk)).not.toThrow();
      }
    }
  });

  it('every chunk starts and ends at the baseline seam (independent generatability)', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        const chunk = generateChunk(params(seed), idx);
        expect(chunk.entryY).toBe(GENERATION.BASELINE_Y);
        expect(chunk.exitY).toBe(GENERATION.BASELINE_Y);
      }
    }
  });

  it('the ground never wanders outside the vertical bounds', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        for (const seg of generateChunk(params(seed), idx).groundSegments) {
          expect(seg.y0).toBeGreaterThanOrEqual(GENERATION.MIN_Y);
          expect(seg.y0).toBeLessThanOrEqual(GENERATION.MAX_Y);
          expect(seg.y1).toBeGreaterThanOrEqual(GENERATION.MIN_Y);
          expect(seg.y1).toBeLessThanOrEqual(GENERATION.MAX_Y);
        }
      }
    }
  });
});

describe('Procedural — survivable by construction (GDD §6.2, sized by the REAL physics)', () => {
  it('every gap is clearable with margin by a full-hold jump at base speed', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        for (const gap of gapsOf(generateChunk(params(seed), idx))) {
          expect(gap).toBeLessThanOrEqual(metrics.holdDistance * GENERATION.LARGE_GAP_FACTOR_MAX + 1);
        }
      }
    }
  });

  it('every platform is reachable with margin by a full-hold jump', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        const chunk = generateChunk(params(seed), idx);
        const terrain = groundLookup(chunk);
        for (const platform of chunk.platforms) {
          const groundY = terrain(platform.x0 + 1);
          expect(groundY).not.toBeNull();
          const height = (groundY as number) - platform.y; // y grows down: positive = above ground
          expect(height).toBeGreaterThan(0);
          expect(height).toBeLessThanOrEqual(metrics.holdRise * GENERATION.PLATFORM_HEIGHT_FACTOR_MAX + 1);
        }
      }
    }
  });

  it('every hazard zone is clearable by one committed hold, and has ground beneath it', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        const chunk = generateChunk(params(seed), idx);
        const terrain = groundLookup(chunk);
        for (const hazard of chunk.hazardZones) {
          expect(hazard.x1 - hazard.x0).toBeLessThanOrEqual(
            metrics.holdDistance * GENERATION.HAZARD_LENGTH_FACTOR_MAX + 1,
          );
          expect(terrain(hazard.x0 + 1)).not.toBeNull(); // marked, not missing
          expect(terrain(hazard.x1 - 1)).not.toBeNull();
        }
      }
    }
  });

  /** Ground height lookup within a single (not-yet-streamed) chunk. */
  function groundLookup(chunk: Chunk): (x: number) => number | null {
    return (x) => {
      for (const seg of chunk.groundSegments) {
        if (x >= seg.x0 && x <= seg.x1) {
          return seg.y0 + ((x - seg.x0) / (seg.x1 - seg.x0)) * (seg.y1 - seg.y0);
        }
      }
      return null;
    };
  }
});

describe('Procedural — checkpoints are safe by construction (GDD §8.4)', () => {
  it('every chunk has exactly one checkpoint, centered on its flat safe pad', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        const chunk = generateChunk(params(seed), idx);
        expect(chunk.checkpointXs).toHaveLength(1);
        const cp = chunk.checkpointXs[0] as number;
        expect(cp).toBe(chunkStartX(idx) + GENERATION.SAFE_PAD_LENGTH / 2);
      }
    }
  });

  it('the safe pad is flat, gap-free, and hazard-free — a respawn can never be ambushed', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        const chunk = generateChunk(params(seed), idx);
        const padStart = chunkStartX(idx);
        const padEnd = padStart + GENERATION.SAFE_PAD_LENGTH;
        const first = chunk.groundSegments[0];
        expect(first).toBeDefined();
        expect(first?.x0).toBe(padStart);
        expect(first?.y0).toBe(first?.y1); // flat
        expect(first?.x1).toBeGreaterThanOrEqual(padEnd); // unbroken through the pad
        for (const spike of chunk.spikes) expect(spike.x).toBeGreaterThan(padEnd);
        for (const hazard of chunk.hazardZones) expect(hazard.x0).toBeGreaterThan(padEnd);
      }
    }
  });
});

describe('Procedural — pacing and the pickup weave (GDD §8.5 gentle Normal, §11.2 risk/reward)', () => {
  it('tier-0 chunks (the first two) are pure flow: no gaps, spikes, hazards, platforms, or pickups', () => {
    for (const seed of SEEDS) {
      for (const idx of [0, 1]) {
        const chunk = generateChunk(params(seed), idx);
        expect(gapsOf(chunk)).toHaveLength(0);
        expect(chunk.spikes).toHaveLength(0);
        expect(chunk.hazardZones).toHaveLength(0);
        expect(chunk.platforms).toHaveLength(0);
        expect(chunk.pickups).toHaveLength(0);
      }
    }
  });

  it('pickups sit only above platforms — the juicy crate is on the high route (GDD §11.2)', () => {
    for (const seed of SEEDS) {
      for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
        const chunk = generateChunk(params(seed), idx);
        for (const pickup of chunk.pickups) {
          const host = chunk.platforms.find((p) => pickup.x >= p.x0 && pickup.x <= p.x1);
          expect(host).toBeDefined();
          expect(pickup.y).toBeLessThan((host as { y: number }).y); // above the platform (y grows down)
        }
      }
    }
  });

  it('pickup kinds respect the mode’s allow-list, and ids are unique per world', () => {
    const shieldOnly = { seed: 'alpha', pickupKinds: ['shield'] as const };
    const ids = new Set<string>();
    for (let idx = 0; idx < CHUNK_RANGE; idx += 1) {
      for (const pickup of generateChunk(shieldOnly, idx).pickups) {
        expect(pickup.kind).toBe('shield');
        expect(ids.has(pickup.id)).toBe(false);
        ids.add(pickup.id);
      }
    }
  });
});

describe('Procedural — the full stack holds (generated world ⨯ real physics)', () => {
  it('a no-input player rolls the whole tier-0 opening without ever losing the ground', () => {
    // The first two chunks are the unaided tutorial (GDD §8.5): pure
    // flow. A player who never touches the screen must survive them.
    const terrain = new Terrain();
    extendTerrain(terrain, params('alpha'), chunkEndX(2));
    const startY = terrain.groundSurfaceAt(10) as number;
    let player: PlayerState = land(createPlayer('p1', 10, 0), startY - PHYSICS.PLAYER_RADIUS);
    while (player.x < CHUNK_LENGTH * 2 - 50) {
      const result = stepPhysics(player, GENERATION.BASE_SPEED_UNITS_PER_TICK, terrain);
      player = result.player;
      expect(result.leftGround).toBe(false); // flow means the ground never vanishes
    }
    expect(player.onGround).toBe(true);
  });

  it('extendTerrain keeps generation ahead of any asked-for x', () => {
    const terrain = new Terrain();
    extendTerrain(terrain, params('alpha'), 10_000);
    expect(() => terrain.groundSurfaceAt(10_000)).not.toThrow();
    const last = terrain.loadedChunks[terrain.loadedChunks.length - 1];
    expect(chunkEndX((last as Chunk).idx)).toBeGreaterThan(10_000);
  });

  it('two machines streaming the same seed hold identical worlds', () => {
    const build = (): readonly Chunk[] => {
      const terrain = new Terrain();
      extendTerrain(terrain, params('daily-2026-07-20'), 15_000);
      return terrain.loadedChunks;
    };
    expect(build()).toEqual(build());
  });
});
