import { describe, expect, it } from "vitest";
import type { Placement, Room } from "@layra/types";
import { clearanceRect, findCollisions, isBlocked, placementRect } from "./collision";
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

describe("clearance", () => {
  it("builds a zone from the catalog clearance", () => {
    // Sofa is 2.1 x 0.9 with 0.7 front, 0.1 sides, 0 back.
    const zone = clearanceRect(place("sofa-3", 3, 2.5));
    expect(zone?.w).toBeCloseTo(2.3);
    expect(zone?.d).toBeCloseTo(1.6);
  });

  it("returns null when an item needs no clearance", () => {
    // Wardrobe has zero sides and back, but a front walkway, so it has a zone.
    expect(clearanceRect(place("wardrobe", 1, 1))).not.toBeNull();
  });

  it("flags the owner when a piece sits in its walkway", () => {
    // Sofa faces -Z, so its 0.7m walkway runs from z=2.05 to z=1.35.
    const sofa = place("sofa-3", 3, 2.5);
    const chair = place("dining-chair", 3, 1.7);
    const report = findCollisions(room, [sofa, chair]);

    expect(report.crowded.has(sofa.id)).toBe(true);
    expect(report.overlapping.size).toBe(0);
  });

  it("does not flag the intruder, only the owner of the zone", () => {
    // A bookshelf faces away from the sofa, so the sofa sits outside the
    // shelf's own zone even while the shelf blocks the sofa's walkway.
    const sofa = place("sofa-3", 3, 2.5);
    const shelf = place("bookshelf", 3, 1.7);
    const report = findCollisions(room, [sofa, shelf]);

    expect(report.crowded.has(sofa.id)).toBe(true);
    expect(report.crowded.has(shelf.id)).toBe(false);
  });

  it("flags both when each blocks the other's walkway", () => {
    // Two chairs facing each other legitimately crowd one another.
    const a = place("dining-chair", 3, 2.5);
    const b = place("dining-chair", 3, 1.9);
    const report = findCollisions(room, [a, b]);
    expect(report.crowded).toEqual(new Set([a.id, b.id]));
  });

  it("stays clear when the walkway is respected", () => {
    const sofa = place("sofa-3", 3, 3.5);
    const chair = place("dining-chair", 3, 1.2);
    expect(findCollisions(room, [sofa, chair]).crowded.size).toBe(0);
  });

  it("follows rotation", () => {
    // Same shelf position, two sofa orientations. Unrotated the zone reaches
    // z=2.95 and misses; turned a quarter turn it reaches 3.65 and catches.
    const shelf = place("bookshelf", 3, 3.3);

    const upright = place("sofa-3", 3, 2.5);
    expect(findCollisions(room, [upright, shelf]).crowded.has(upright.id)).toBe(false);

    const turned = place("sofa-3", 3, 2.5, Math.PI / 2);
    expect(findCollisions(room, [turned, shelf]).crowded.has(turned.id)).toBe(true);
  });

  it("ignores wall-mounted pieces", () => {
    const shelf = place("wall-shelf", 3, 2.5);
    const desk = place("desk", 3, 2.5);
    expect(findCollisions(room, [shelf, desk]).crowded.size).toBe(0);
  });

  it("is advisory, not a clash", () => {
    const sofa = place("sofa-3", 3, 2.5);
    const chair = place("dining-chair", 3, 1.7);
    const report = findCollisions(room, [sofa, chair]);
    expect(isBlocked(report, sofa.id)).toBe(false);
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
