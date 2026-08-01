import { describe, expect, it } from "vitest";
import type { Placement, Room } from "@layra/types";
import { findCollisions, isBlocked, placementRect } from "./collision";
import { roomFromPolygon } from "./commands";

const room: Room = roomFromPolygon(
  [
    { x: 0, z: 0 },
    { x: 6, z: 0 },
    { x: 6, z: 5 },
    { x: 0, z: 5 },
  ],
  { height: 2.5, thickness: 0.2 },
);

let counter = 0;
function place(catalogItemId: string, x: number, z: number, rotationY = 0): Placement {
  return {
    id: `p${counter++}`,
    catalogItemId,
    position: { x, y: 0, z },
    rotationY,
    locked: false,
  };
}

describe("placementRect", () => {
  it("reads dimensions from the catalog", () => {
    const rect = placementRect(place("sofa-3", 1, 1));
    expect(rect?.w).toBeCloseTo(2.1);
    expect(rect?.d).toBeCloseTo(0.9);
  });

  it("returns null for an unknown item", () => {
    expect(placementRect(place("nope", 0, 0))).toBeNull();
  });
});

describe("overlap detection", () => {
  it("flags both pieces of a clash", () => {
    const a = place("dining-table", 3, 2.5);
    const b = place("desk", 3, 2.5);
    const report = findCollisions(room, [a, b]);

    expect(report.overlapping).toEqual(new Set([a.id, b.id]));
    expect(isBlocked(report, a.id)).toBe(true);
  });

  it("leaves well-separated pieces clear", () => {
    const a = place("desk", 1.5, 1);
    const b = place("desk", 4.5, 4);
    expect(findCollisions(room, [a, b]).overlapping.size).toBe(0);
  });

  it("allows pieces pushed flush together", () => {
    // Two 1.4m desks exactly touching along X.
    const a = place("desk", 2, 2.5);
    const b = place("desk", 3.4, 2.5);
    expect(findCollisions(room, [a, b]).overlapping.size).toBe(0);
  });

  it("accounts for rotation", () => {
    const a = place("sofa-3", 3, 2.5);
    const clear = place("sofa-3", 3, 1.4);
    expect(findCollisions(room, [a, clear]).overlapping.size).toBe(0);

    // Turned across, the same gap is no longer enough.
    const turned = place("sofa-3", 3, 1.4, Math.PI / 2);
    expect(findCollisions(room, [a, turned]).overlapping.size).toBe(2);
  });

  it("ignores wall-mounted pieces, which hang above the floor", () => {
    const shelf = place("wall-shelf", 3, 2.5);
    const desk = place("desk", 3, 2.5);
    expect(findCollisions(room, [shelf, desk]).overlapping.size).toBe(0);
  });

  it("handles an empty scene", () => {
    const report = findCollisions(room, []);
    expect(report.overlapping.size).toBe(0);
    expect(report.outOfRoom.size).toBe(0);
  });
});

describe("room containment", () => {
  it("accepts a piece inside the room", () => {
    expect(findCollisions(room, [place("desk", 3, 2.5)]).outOfRoom.size).toBe(0);
  });

  it("flags a piece poking through a wall", () => {
    const desk = place("desk", 5.9, 2.5);
    expect(findCollisions(room, [desk]).outOfRoom).toEqual(new Set([desk.id]));
  });

  it("measures against the inner wall face, not the centreline", () => {
    // Centreline runs at x=6, so with 0.2m walls the inner face is 5.9. A 1.4m
    // desk centred at 5.15 reaches 5.85 and fits; at 5.3 it reaches 6.0 and
    // would be inside the centreline but through the wall itself.
    expect(findCollisions(room, [place("desk", 5.15, 2.5)]).outOfRoom.size).toBe(0);
    expect(findCollisions(room, [place("desk", 5.3, 2.5)]).outOfRoom.size).toBe(1);
  });

  it("exempts wall-mounted pieces", () => {
    const shelf = place("wall-shelf", 5.95, 2.5);
    expect(findCollisions(room, [shelf]).outOfRoom.size).toBe(0);
  });

  it("skips containment when no room exists", () => {
    const empty: Room = { walls: [], polygon: [], floorMaterial: "default" };
    expect(findCollisions(empty, [place("desk", 0, 0)]).outOfRoom.size).toBe(0);
  });

  it("ignores unknown catalog items", () => {
    expect(findCollisions(room, [place("nope", 99, 99)]).outOfRoom.size).toBe(0);
  });
});
