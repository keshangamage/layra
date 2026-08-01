import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import { edgeLabels, formatArea, formatLength } from "./dimensions";
import { ensureCCW, pointInPolygon } from "./polygon";

const room: Vec2[] = ensureCCW([
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 3 },
  { x: 0, z: 3 },
]);

describe("edgeLabels", () => {
  it("emits one label per wall", () => {
    expect(edgeLabels(room)).toHaveLength(4);
  });

  it("measures each wall", () => {
    const lengths = edgeLabels(room).map((l) => l.length).sort();
    expect(lengths).toEqual([3, 3, 4, 4]);
  });

  it("places every label outside the room", () => {
    for (const label of edgeLabels(room, 0.35)) {
      expect(pointInPolygon(label.position, room)).toBe(false);
    }
  });

  it("offsets by the requested distance from the midpoint", () => {
    // Bottom edge midpoint is (2, 0); outward is -z.
    const label = edgeLabels(room, 0.5).find((l) => Math.abs(l.position.x - 2) < 1e-9);
    expect(label?.position.z).toBeCloseTo(-0.5);
  });

  it("keeps labels upright rather than mirrored", () => {
    for (const label of edgeLabels(room)) {
      expect(Math.abs(label.angle)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });

  it("gives the same result for either winding", () => {
    const forward = edgeLabels(room).map((l) => l.length).sort();
    const reversed = edgeLabels([...room].reverse()).map((l) => l.length).sort();
    expect(forward).toEqual(reversed);
  });

  it("handles a concave room", () => {
    const lShape = ensureCCW([
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 2 },
      { x: 2, z: 2 },
      { x: 2, z: 4 },
      { x: 0, z: 4 },
    ]);
    expect(edgeLabels(lShape)).toHaveLength(6);
    for (const label of edgeLabels(lShape)) {
      expect(Number.isFinite(label.position.x)).toBe(true);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("skips zero-length edges", () => {
    const duplicated: Vec2[] = [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 3 },
    ];
    for (const label of edgeLabels(duplicated)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for degenerate input", () => {
    expect(edgeLabels([])).toEqual([]);
    expect(edgeLabels([{ x: 0, z: 0 }])).toEqual([]);
  });
});

describe("formatting", () => {
  it("formats lengths in metres", () => {
    expect(formatLength(4)).toBe("4.00 m");
    expect(formatLength(0.125)).toBe("0.13 m");
  });

  it("formats areas in square metres", () => {
    expect(formatArea(12)).toBe("12.00 m²");
  });
});
