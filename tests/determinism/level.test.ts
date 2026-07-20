/**
 * ============================================================
 *  level.test.ts — guarantees of the Level module (Terrain)
 * ============================================================
 *  WHAT THIS FILE DOES
 *    Pins the world's data honesty as executable guarantees: chunk
 *    validation, seam continuity, gap-as-absence, slope
 *    interpolation without trigonometry, checkpoint queries,
 *    checkpoint-safe pruning, loud out-of-window failures — and the
 *    first cross-module integration: a player walking, falling, and
 *    landing on real Terrain through the Physics module.
 *
 *  WHY IT EXISTS (design anchor)
 *    The world is the shared truth of every match (GDD §12.7). A
 *    dishonest chunk or a silent query failure corrupts all four
 *    players at once, so the world's container is held to the same
 *    stop-ship standard as the simulation itself.
 * ============================================================
 */
import { describe, expect, it } from 'vitest';
import {
  CHUNK_LENGTH,
  PHYSICS,
  Terrain,
  chunkStartX,
  createPlayer,
  land,
  stepPhysics,
  validateChunk,
  type Chunk,
  type PlayerState,
} from '@rebound/sim-core';

/**
 * Chunk builder for tests: flat ground at `y` across the whole
 * chunk, with optional overrides (segments, features, checkpoints).
 */
function makeChunk(idx: number, y: number, overrides: Partial<Chunk> = {}): Chunk {
  const x0 = chunkStartX(idx);
  return {
    idx,
    groundSegments: [{ x0, y0: y, x1: x0 + CHUNK_LENGTH, y1: y }],
    platforms: [],
    spikes: [],
    hazardZones: [],
    pickups: [],
    checkpointXs: [],
    entryY: y,
    exitY: y,
    ...overrides,
  };
}

describe('Level — chunk validation (a broken world fails fast, CODING_STANDARDS §10)', () => {
  it('accepts a well-formed flat chunk', () => {
    expect(() => validateChunk(makeChunk(0, 100))).not.toThrow();
  });

  it('rejects overlapping ground segments', () => {
    const bad = makeChunk(0, 100, {
      groundSegments: [
        { x0: 0, y0: 100, x1: 1000, y1: 100 },
        { x0: 900, y0: 100, x1: 1920, y1: 100 }, // overlaps the first
      ],
    });
    expect(() => validateChunk(bad)).toThrow(/sorted and non-overlapping/);
  });

  it('rejects features outside the chunk bounds', () => {
    const bad = makeChunk(1, 100, { spikes: [{ x: 10, y: 100 }] }); // x=10 is in chunk 0
    expect(() => validateChunk(bad)).toThrow(/spike outside chunk bounds/);
  });

  it('rejects backwards segments and non-ascending checkpoints', () => {
    expect(() =>
      validateChunk(makeChunk(0, 100, { groundSegments: [{ x0: 50, y0: 100, x1: 40, y1: 100 }] })),
    ).toThrow(/left-to-right/);
    expect(() => validateChunk(makeChunk(0, 100, { checkpointXs: [500, 500] }))).toThrow(
      /strictly ascending/,
    );
  });

  it('the same bad chunk produces the same error — failures are deterministic too', () => {
    const bad = makeChunk(0, 100, { checkpointXs: [9999999] });
    const message = (): string => {
      try {
        validateChunk(bad);
        return 'no error';
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(message()).toBe(message());
  });
});

describe('Level — the streaming window (Pillar 8: endless world, finite memory)', () => {
  it('rejects non-contiguous chunks — the world has no missing pages', () => {
    const terrain = new Terrain();
    terrain.addChunk(makeChunk(0, 100));
    expect(() => terrain.addChunk(makeChunk(2, 100))).toThrow(/must stay contiguous/);
  });

  it('rejects seam cliffs — entryY must equal the previous exitY (GDD §6.2: continuous world)', () => {
    const terrain = new Terrain();
    terrain.addChunk(makeChunk(0, 100));
    expect(() => terrain.addChunk(makeChunk(1, 250))).toThrow(/seams must join/);
  });

  it('prune releases chunks behind the safe line but always keeps the chunk containing it', () => {
    const terrain = new Terrain();
    [0, 1, 2, 3].forEach((i) => terrain.addChunk(makeChunk(i, 100)));
    const safeLine = chunkStartX(2) + 10; // e.g. the earliest live checkpoint
    terrain.prune(safeLine);
    expect(terrain.loadedChunks.map((c) => c.idx)).toEqual([2, 3]);
    expect(terrain.groundSurfaceAt(safeLine)).toBe(100); // respawn ground survives
  });

  it('querying pruned or never-loaded world throws loudly — never a silent fake gap', () => {
    const terrain = new Terrain();
    [0, 1, 2].forEach((i) => terrain.addChunk(makeChunk(i, 100)));
    terrain.prune(chunkStartX(2));
    expect(() => terrain.groundSurfaceAt(5)).toThrow(/outside the loaded window/);
    expect(() => terrain.groundSurfaceAt(chunkStartX(3) + 1)).toThrow(/outside the loaded window/);
  });
});

describe('Level — ground queries (GDD §6.2: slopes are endpoints, gaps are absence)', () => {
  it('flat ground reports its height everywhere on the segment', () => {
    const terrain = new Terrain();
    terrain.addChunk(makeChunk(0, 100));
    expect(terrain.groundSurfaceAt(0)).toBe(100);
    expect(terrain.groundSurfaceAt(1000)).toBe(100);
  });

  it('a slope interpolates linearly — no trigonometry anywhere', () => {
    const terrain = new Terrain();
    terrain.addChunk(
      makeChunk(0, 100, {
        groundSegments: [
          { x0: 0, y0: 100, x1: 960, y1: 160 }, // downhill
          { x0: 960, y0: 160, x1: 1920, y1: 160 },
        ],
        exitY: 160,
      }),
    );
    expect(terrain.groundSurfaceAt(480)).toBe(130); // exactly halfway down
  });

  it('a span with no segment is a gap: null', () => {
    const terrain = new Terrain();
    terrain.addChunk(
      makeChunk(0, 100, {
        groundSegments: [
          { x0: 0, y0: 100, x1: 800, y1: 100 },
          { x0: 900, y0: 100, x1: 1920, y1: 100 }, // 100-unit gap at [800, 900]
        ],
      }),
    );
    expect(terrain.groundSurfaceAt(850)).toBeNull();
    expect(terrain.groundSurfaceAt(799)).toBe(100);
  });

  it('the surface is continuous across a chunk seam', () => {
    const terrain = new Terrain();
    terrain.addChunk(makeChunk(0, 100));
    terrain.addChunk(makeChunk(1, 100));
    const seam = chunkStartX(1);
    expect(terrain.groundSurfaceAt(seam - 1)).toBe(100);
    expect(terrain.groundSurfaceAt(seam)).toBe(100);
    expect(terrain.groundSurfaceAt(seam + 1)).toBe(100);
  });
});

describe('Level — checkpoint queries (GDD §8.3/§8.4: passed automatically, respawn at the latest)', () => {
  function checkpointed(): Terrain {
    const terrain = new Terrain();
    terrain.addChunk(makeChunk(0, 100, { checkpointXs: [500, 1500] }));
    terrain.addChunk(makeChunk(1, 100, { checkpointXs: [2500] }));
    return terrain;
  }

  it('checkpointsIn reports crossings once, with a half-open interval', () => {
    const terrain = checkpointed();
    expect(terrain.checkpointsIn(400, 600)).toEqual([500]);
    expect(terrain.checkpointsIn(500, 600)).toEqual([]); // x0 exclusive: already counted
    expect(terrain.checkpointsIn(400, 2600)).toEqual([500, 1500, 2500]);
  });

  it('latestCheckpointAtOrBefore finds the respawn target — or null before any checkpoint', () => {
    const terrain = checkpointed();
    expect(terrain.latestCheckpointAtOrBefore(2000)).toBe(1500);
    expect(terrain.latestCheckpointAtOrBefore(2500)).toBe(2500);
    expect(terrain.latestCheckpointAtOrBefore(499)).toBeNull();
  });
});

describe('Level — feature queries (Match judges, renderer draws; Physics cannot even ask)', () => {
  it('platforms, spikes, and pickups filter by range; hazard zones answer point membership', () => {
    const terrain = new Terrain();
    terrain.addChunk(
      makeChunk(0, 100, {
        platforms: [{ x0: 200, x1: 400, y: 40 }],
        spikes: [{ x: 700, y: 100 }],
        hazardZones: [{ x0: 1000, x1: 1200 }],
        pickups: [{ id: 'pk-0', x: 300, y: 20, kind: 'shield' }],
      }),
    );
    expect(terrain.platformsIn(0, 250)).toHaveLength(1);
    expect(terrain.platformsIn(500, 600)).toHaveLength(0);
    expect(terrain.spikesIn(650, 750)).toEqual([{ x: 700, y: 100 }]);
    expect(terrain.hazardZoneAt(1100)).toBe(true);
    expect(terrain.hazardZoneAt(999)).toBe(false);
    expect(terrain.pickupsIn(250, 350)[0]?.kind).toBe('shield');
  });
});

describe('Level ⨯ Physics — the first integration (the seam holds)', () => {
  it('a player walks real terrain, falls into a real gap, and lands on the far side', () => {
    const terrain = new Terrain();
    terrain.addChunk(
      makeChunk(0, 100, {
        groundSegments: [
          { x0: 0, y0: 100, x1: 800, y1: 100 },
          { x0: 840, y0: 100, x1: 1920, y1: 100 }, // a 40-unit gap: a timing check
        ],
      }),
    );
    terrain.addChunk(makeChunk(1, 100));

    let player: PlayerState = land(createPlayer('p1', 0, 0), 100 - PHYSICS.PLAYER_RADIUS);
    let leftGround = false;
    let landed = false;
    for (let tick = 0; tick < 60; tick += 1) {
      const result = stepPhysics(player, 30, terrain); // Terrain IS the GroundQuery
      player = result.player;
      leftGround ||= result.leftGround;
      landed ||= result.landed;
    }
    expect(leftGround).toBe(true); // the gap took the ground away
    expect(landed).toBe(true); // and the far side caught the fall
    expect(player.onGround).toBe(true);
    expect(player.y + PHYSICS.PLAYER_RADIUS).toBe(100);
  });

  it('identically-built terrains answer identically — the shared world, twice over', () => {
    const build = (): number[] => {
      const terrain = new Terrain();
      terrain.addChunk(
        makeChunk(0, 100, {
          groundSegments: [
            { x0: 0, y0: 100, x1: 700, y1: 140 },
            { x0: 700, y0: 140, x1: 1920, y1: 140 },
          ],
          exitY: 140,
        }),
      );
      const samples: number[] = [];
      for (let x = 0; x < CHUNK_LENGTH; x += 97) {
        const y = terrain.groundSurfaceAt(x);
        samples.push(y === null ? Number.NaN : y);
      }
      return samples;
    };
    expect(build()).toEqual(build());
  });
});
