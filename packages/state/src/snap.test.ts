import { describe, expect, it } from "vitest";
import { snapFrom, snapPoint, snapToGrid } from "./snap";

const GRID = 0.1;
const ANGLE = Math.PI / 12;

describe("snapToGrid", () => {
  it("rounds to the nearest step", () => {
    expect(snapToGrid(1.24, 0.1)).toBeCloseTo(1.2);
    expect(snapToGrid(1.26, 0.1)).toBeCloseTo(1.3);
    expect(snapToGrid(-1.26, 0.1)).toBeCloseTo(-1.3);
  });

  it("passes values through at a non-positive step", () => {
    expect(snapToGrid(1.234, 0)).toBe(1.234);
  });
});

describe("snapPoint", () => {
  it("snaps both axes", () => {
    const p = snapPoint({ x: 1.23, z: -4.57 }, GRID);
    expect(p.x).toBeCloseTo(1.2);
    expect(p.z).toBeCloseTo(-4.6);
  });
});

describe("snapFrom", () => {
  const origin = { x: 0, z: 0 };

  it("snaps direction to 15 degree increments", () => {
    // 20 degrees should land on 15.
    const target = {
      x: Math.cos((20 * Math.PI) / 180) * 2,
      z: Math.sin((20 * Math.PI) / 180) * 2,
    };
    const snapped = snapFrom(origin, target, GRID, ANGLE);
    const degrees = (Math.atan2(snapped.z, snapped.x) * 180) / Math.PI;
    expect(degrees).toBeCloseTo(15);
  });

  it("holds the angle exactly on the increment after length snapping", () => {
    // The regression this guards: snapping x/z to the grid afterwards would
    // pull the direction back off its increment.
    for (const degrees of [15, 30, 45, 75, 120, 195]) {
      const radians = (degrees * Math.PI) / 180;
      const target = { x: Math.cos(radians) * 3.37, z: Math.sin(radians) * 3.37 };
      const snapped = snapFrom(origin, target, GRID, ANGLE);
      const result = (Math.atan2(snapped.z, snapped.x) * 180) / Math.PI;
      // Distance to the nearest multiple; modulo would wrap a value a hair
      // under a multiple round to ~15 and read as a failure.
      const multiples = result / 15;
      expect(multiples - Math.round(multiples)).toBeCloseTo(0, 6);
    }
  });

  it("snaps length to the grid", () => {
    const snapped = snapFrom(origin, { x: 2.03, z: 0 }, GRID, ANGLE);
    expect(Math.hypot(snapped.x, snapped.z)).toBeCloseTo(2.0);
  });

  it("never collapses to a zero-length segment", () => {
    const snapped = snapFrom(origin, { x: 0.02, z: 0 }, GRID, ANGLE);
    expect(Math.hypot(snapped.x, snapped.z)).toBeCloseTo(GRID);
  });

  it("returns the origin when the target coincides with it", () => {
    expect(snapFrom(origin, { x: 0, z: 0 }, GRID, ANGLE)).toEqual(origin);
  });

  it("works away from the origin", () => {
    const from = { x: 5, z: -3 };
    const snapped = snapFrom(from, { x: 8.03, z: -3.01 }, GRID, ANGLE);
    expect(snapped.z).toBeCloseTo(-3);
    expect(snapped.x).toBeCloseTo(8);
  });
});

describe("float cleanliness", () => {
  it("returns exact decimals rather than binary noise", () => {
    // 12 * 0.1 is 1.2000000000000002 without the extra rounding.
    expect(snapToGrid(1.23, 0.1)).toBe(1.2);
    expect(snapToGrid(0.7, 0.1)).toBe(0.7);
    expect(snapToGrid(2.85, 0.05)).toBe(2.85);
    expect(snapPoint({ x: 1.23, z: 4.57 }, 0.1)).toEqual({ x: 1.2, z: 4.6 });
  });
});
