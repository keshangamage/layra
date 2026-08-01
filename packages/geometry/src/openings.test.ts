import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import {
  facePanels,
  nearestWallStation,
  resolveOpenings,
  type WallOpening,
} from "./openings";
import { extrudeWalls, type MeshData } from "./extrude";
import { ensureCCW } from "./polygon";

const WALL_LENGTH = 4;
const WALL_HEIGHT = 2.5;

const door: WallOpening = { offset: 1, width: 0.9, height: 2.05, sillHeight: 0 };
const window: WallOpening = { offset: 2.5, width: 1.2, height: 1.1, sillHeight: 0.9 };

describe("resolveOpenings", () => {
  it("keeps an opening that fits", () => {
    expect(resolveOpenings([door], WALL_LENGTH, WALL_HEIGHT)).toEqual([
      { u0: 1, u1: 1.9, v0: 0, v1: 2.05 },
    ]);
  });

  it("drops one that runs past the end of the wall", () => {
    const tooFar: WallOpening = { ...door, offset: 3.5, width: 1 };
    expect(resolveOpenings([tooFar], WALL_LENGTH, WALL_HEIGHT)).toEqual([]);
  });

  it("drops one that starts before the wall", () => {
    expect(resolveOpenings([{ ...door, offset: -0.5 }], WALL_LENGTH, WALL_HEIGHT)).toEqual(
      [],
    );
  });

  it("drops one taller than the wall", () => {
    expect(resolveOpenings([{ ...door, height: 3 }], WALL_LENGTH, WALL_HEIGHT)).toEqual([]);
  });

  it("drops one whose sill lifts it through the top", () => {
    const high: WallOpening = { ...window, sillHeight: 2, height: 1 };
    expect(resolveOpenings([high], WALL_LENGTH, WALL_HEIGHT)).toEqual([]);
  });

  it("drops zero-sized openings", () => {
    expect(resolveOpenings([{ ...door, width: 0 }], WALL_LENGTH, WALL_HEIGHT)).toEqual([]);
    expect(resolveOpenings([{ ...door, height: 0 }], WALL_LENGTH, WALL_HEIGHT)).toEqual([]);
  });

  it("sorts by position along the wall", () => {
    const resolved = resolveOpenings([window, door], WALL_LENGTH, WALL_HEIGHT);
    expect(resolved.map((s) => s.u0)).toEqual([1, 2.5]);
  });

  it("keeps the first of an overlapping pair", () => {
    const clashing: WallOpening = { ...door, offset: 1.5 };
    const resolved = resolveOpenings([door, clashing], WALL_LENGTH, WALL_HEIGHT);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.u0).toBe(1);
  });

  it("allows openings that merely touch", () => {
    const abutting: WallOpening = { ...door, offset: 1.9 };
    expect(resolveOpenings([door, abutting], WALL_LENGTH, WALL_HEIGHT)).toHaveLength(2);
  });
});

describe("facePanels", () => {
  const areaOf = (panels: { u0: number; u1: number; v0: number; v1: number }[]) =>
    panels.reduce((sum, p) => sum + (p.u1 - p.u0) * (p.v1 - p.v0), 0);

  it("returns the whole face when there are no openings", () => {
    expect(facePanels([], WALL_LENGTH, WALL_HEIGHT)).toEqual([
      { u0: 0, u1: WALL_LENGTH, v0: 0, v1: WALL_HEIGHT },
    ]);
  });

  it("conserves area: solid face equals wall minus openings", () => {
    const spans = resolveOpenings([door, window], WALL_LENGTH, WALL_HEIGHT);
    const openingArea = spans.reduce(
      (sum, s) => sum + (s.u1 - s.u0) * (s.v1 - s.v0),
      0,
    );
    const panelArea = areaOf(facePanels(spans, WALL_LENGTH, WALL_HEIGHT));
    expect(panelArea).toBeCloseTo(WALL_LENGTH * WALL_HEIGHT - openingArea);
  });

  it("leaves no panel below a door", () => {
    const spans = resolveOpenings([door], WALL_LENGTH, WALL_HEIGHT);
    const panels = facePanels(spans, WALL_LENGTH, WALL_HEIGHT);
    const under = panels.filter((p) => p.u0 >= 1 && p.u1 <= 1.9 && p.v0 === 0);
    expect(under).toHaveLength(0);
  });

  it("leaves panels above and below a window", () => {
    const spans = resolveOpenings([window], WALL_LENGTH, WALL_HEIGHT);
    const panels = facePanels(spans, WALL_LENGTH, WALL_HEIGHT);
    const over = panels.filter((p) => p.u0 === 2.5 && p.v0 > 1.9);
    const under = panels.filter((p) => p.u0 === 2.5 && p.v1 === 0.9);
    expect(over).toHaveLength(1);
    expect(under).toHaveLength(1);
  });

  it("emits no zero-area panels", () => {
    const flush: WallOpening = { offset: 0, width: WALL_LENGTH, height: 2, sillHeight: 0 };
    const spans = resolveOpenings([flush], WALL_LENGTH, WALL_HEIGHT);
    for (const panel of facePanels(spans, WALL_LENGTH, WALL_HEIGHT)) {
      expect((panel.u1 - panel.u0) * (panel.v1 - panel.v0)).toBeGreaterThan(0);
    }
  });
});

describe("extrudeWalls with openings", () => {
  const square: Vec2[] = ensureCCW([
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 4 },
    { x: 0, z: 4 },
  ]);
  const options = { height: WALL_HEIGHT, thickness: 0.2 };

  function faceNormal(mesh: MeshData, t: number): [number, number, number] {
    const at = (v: number): [number, number, number] => [
      mesh.positions[v * 3]!,
      mesh.positions[v * 3 + 1]!,
      mesh.positions[v * 3 + 2]!,
    ];
    const a = at(mesh.indices[t * 3]!);
    const b = at(mesh.indices[t * 3 + 1]!);
    const c = at(mesh.indices[t * 3 + 2]!);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
    const nrm: [number, number, number] = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
    return [nrm[0] / len, nrm[1] / len, nrm[2] / len];
  }

  it("matches the plain extrusion when no openings are given", () => {
    const plain = extrudeWalls(square, options);
    const empty = extrudeWalls(square, { ...options, openings: [[], [], [], []] });
    expect(empty.positions).toEqual(plain.positions);
    expect(empty.indices).toEqual(plain.indices);
  });

  it("adds geometry for the reveals", () => {
    const plain = extrudeWalls(square, options);
    const cut = extrudeWalls(square, { ...options, openings: [[door]] });
    expect(cut.positions.length).toBeGreaterThan(plain.positions.length);
  });

  it("only affects the segment it is indexed to", () => {
    const first = extrudeWalls(square, { ...options, openings: [[door]] });
    const second = extrudeWalls(square, { ...options, openings: [[], [door]] });
    expect(first.positions.length).toBe(second.positions.length);
  });

  it("stays within the wall bounds", () => {
    const cut = extrudeWalls(square, { ...options, openings: [[door], [], [window], []] });
    const ys: number[] = [];
    for (let i = 1; i < cut.positions.length; i += 3) ys.push(cut.positions[i]!);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(WALL_HEIGHT);
  });

  it("produces no NaN and no out-of-range indices", () => {
    const cut = extrudeWalls(square, { ...options, openings: [[door, window]] });
    for (const value of cut.positions) expect(Number.isFinite(value)).toBe(true);
    for (const index of cut.indices) {
      expect(index).toBeLessThan(cut.positions.length / 3);
    }
  });

  it("winds every triangle to agree with its stored normal", () => {
    // Reveals are the easy place to get winding backwards, which renders the
    // inside of a doorway inside out.
    const cut = extrudeWalls(square, { ...options, openings: [[door], [window]] });
    for (let t = 0; t < cut.indices.length / 3; t++) {
      const geometric = faceNormal(cut, t);
      const first = cut.indices[t * 3]!;
      const alignment =
        geometric[0] * cut.normals[first * 3]! +
        geometric[1] * cut.normals[first * 3 + 1]! +
        geometric[2] * cut.normals[first * 3 + 2]!;
      expect(alignment).toBeGreaterThan(0.99);
    }
  });

  it("emits unit-length normals throughout", () => {
    const cut = extrudeWalls(square, { ...options, openings: [[door]] });
    for (let i = 0; i < cut.normals.length; i += 3) {
      expect(
        Math.hypot(cut.normals[i]!, cut.normals[i + 1]!, cut.normals[i + 2]!),
      ).toBeCloseTo(1);
    }
  });

  it("ignores an opening that does not fit", () => {
    const tooWide: WallOpening = { offset: 0, width: 99, height: 2, sillHeight: 0 };
    const plain = extrudeWalls(square, options);
    const cut = extrudeWalls(square, { ...options, openings: [[tooWide]] });
    expect(cut.positions.length).toBe(plain.positions.length);
  });
});

describe("nearestWallStation", () => {
  const square: Vec2[] = ensureCCW([
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 3 },
    { x: 0, z: 3 },
  ]);

  it("finds the wall a point sits nearest", () => {
    const station = nearestWallStation(square, { x: 1, z: 0.05 });
    expect(station?.distance).toBeCloseTo(0.05);
    expect(station?.offset).toBeCloseTo(1);
    expect(station?.wallLength).toBeCloseTo(4);
  });

  it("measures offset from the wall's own start", () => {
    // Opposite wall runs the other way, so the same x is a different offset.
    const near = nearestWallStation(square, { x: 1, z: 2.95 });
    expect(near?.offset).toBeCloseTo(3);
  });

  it("clamps a point past the end onto the corner", () => {
    const station = nearestWallStation(square, { x: -5, z: -0.1 });
    expect(station?.offset).toBe(0);
  });

  it("picks the closer of two candidate walls", () => {
    const station = nearestWallStation(square, { x: 0.1, z: 1.5 });
    expect(station?.wallLength).toBeCloseTo(3);
  });

  it("returns null without a room", () => {
    expect(nearestWallStation([], { x: 0, z: 0 })).toBeNull();
    expect(nearestWallStation([{ x: 0, z: 0 }], { x: 0, z: 0 })).toBeNull();
  });
});
