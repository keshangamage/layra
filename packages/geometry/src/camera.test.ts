import { describe, expect, it } from "vitest";
import { fitDistance } from "./camera";

describe("fitDistance", () => {
  it("grows with the room", () => {
    const small = fitDistance({ x: 4, z: 3 }, 45, 1.5);
    const large = fitDistance({ x: 12, z: 9 }, 45, 1.5);
    expect(large).toBeGreaterThan(small);
    // Three times the room, three times the distance.
    expect(large / small).toBeCloseTo(3);
  });

  it("pulls back for a narrower field of view", () => {
    expect(fitDistance({ x: 6, z: 4 }, 25, 1.5)).toBeGreaterThan(
      fitDistance({ x: 6, z: 4 }, 60, 1.5),
    );
  });

  it("is limited by the horizontal axis on a tall viewport", () => {
    // A portrait viewport has to pull back further than a landscape one.
    expect(fitDistance({ x: 6, z: 4 }, 45, 0.5)).toBeGreaterThan(
      fitDistance({ x: 6, z: 4 }, 45, 2),
    );
  });

  it("stops widening once vertical becomes the tighter axis", () => {
    // Beyond aspect 1 the vertical fov binds, so the answer settles.
    expect(fitDistance({ x: 6, z: 4 }, 45, 4)).toBeCloseTo(
      fitDistance({ x: 6, z: 4 }, 45, 10),
    );
  });

  it("respects padding", () => {
    const tight = fitDistance({ x: 6, z: 4 }, 45, 1.5, 1);
    expect(fitDistance({ x: 6, z: 4 }, 45, 1.5, 2)).toBeCloseTo(tight * 2);
  });

  it("returns a usable distance for a degenerate room", () => {
    expect(fitDistance({ x: 0, z: 0 }, 45, 1.5)).toBe(1);
    expect(Number.isFinite(fitDistance({ x: 5, z: 5 }, 45, 0))).toBe(true);
  });
});
