import { describe, expect, it } from "vitest";
import { SCENE_VERSION, emptyScene, type Scene } from "@layra/types";
import { parseScene, serializeScene } from "./serialize";
import { roomFromPolygon } from "./commands";

function sceneWithRoom(): Scene {
  return {
    version: SCENE_VERSION,
    rooms: [roomFromPolygon(
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 3 },
        { x: 0, z: 3 },
      ],
      { height: 2.5, thickness: 0.2 },
      { id: "r0", name: "Room 1", floorMaterial: "default" },
    )],
    placements: [],
  };
}

function parsedOrThrow(text: string): Scene {
  const result = parseScene(text);
  if (!result.ok) throw new Error(result.error);
  return result.scene;
}

describe("round trip", () => {
  it("preserves an empty scene", () => {
    const scene = emptyScene();
    expect(parsedOrThrow(serializeScene(scene))).toEqual(scene);
  });

  it("preserves a drawn room", () => {
    const scene = sceneWithRoom();
    expect(parsedOrThrow(serializeScene(scene))).toEqual(scene);
  });

  it("preserves openings", () => {
    const scene = sceneWithRoom();
    scene.rooms[0]!.walls[0]!.openings.push({
      id: "o1",
      type: "door",
      offset: 1.2,
      width: 0.9,
      height: 2.05,
      sillHeight: 0,
    });
    expect(parsedOrThrow(serializeScene(scene))).toEqual(scene);
  });

  it("preserves placements", () => {
    const scene = sceneWithRoom();
    scene.placements.push({
      id: "p1",
      catalogItemId: "sofa",
      position: { x: 1, y: 0, z: 2 },
      rotationY: Math.PI / 2,
      locked: false,
      finish: "leather",
    });
    expect(parsedOrThrow(serializeScene(scene))).toEqual(scene);
  });

  it("emits human-readable JSON", () => {
    expect(serializeScene(emptyScene())).toContain("\n");
  });
});

describe("rejects bad input", () => {
  it("rejects non-JSON", () => {
    const result = parseScene("not json {");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Not valid JSON.");
  });

  it("rejects a JSON array or primitive", () => {
    expect(parseScene("[]").ok).toBe(false);
    expect(parseScene("42").ok).toBe(false);
    expect(parseScene("null").ok).toBe(false);
  });

  it("rejects a missing version", () => {
    expect(parseScene(JSON.stringify({ room: {}, placements: [] })).ok).toBe(false);
  });

  it("names the version mismatch", () => {
    const scene = { ...emptyScene(), version: 99 };
    const result = parseScene(JSON.stringify(scene));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("99");
  });

  it("rejects a malformed room", () => {
    const result = parseScene(
      JSON.stringify({ version: SCENE_VERSION, room: { walls: [] }, placements: [] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a polygon point missing a coordinate", () => {
    const scene = sceneWithRoom();
    const broken = JSON.parse(serializeScene(scene)) as Record<string, unknown>;
    (broken.rooms as Record<string, unknown>[])[0]!.polygon = [{ x: 1 }];
    expect(parseScene(JSON.stringify(broken)).ok).toBe(false);
  });

  it("rejects NaN and Infinity coordinates", () => {
    // JSON.stringify turns these into null, which must not slip through.
    const scene = sceneWithRoom();
    scene.rooms[0]!.polygon[0] = { x: NaN, z: Infinity };
    expect(parseScene(serializeScene(scene)).ok).toBe(false);
  });

  it("rejects an unknown opening type", () => {
    const scene = sceneWithRoom();
    const broken = JSON.parse(serializeScene(scene)) as Record<string, unknown>;
    const walls = (broken.rooms as Record<string, unknown>[])[0]!.walls as Record<
      string,
      unknown
    >[];
    walls[0]!.openings = [
      { id: "o", type: "hatch", offset: 0, width: 1, height: 1, sillHeight: 0 },
    ];
    expect(parseScene(JSON.stringify(broken)).ok).toBe(false);
  });

  it("rejects placements that are not a list", () => {
    const scene = { ...emptyScene(), placements: {} };
    expect(parseScene(JSON.stringify(scene)).ok).toBe(false);
  });

  it("rejects a placement with a non-boolean lock", () => {
    const scene = sceneWithRoom();
    const broken = JSON.parse(serializeScene(scene)) as Record<string, unknown>;
    broken.placements = [
      {
        id: "p",
        catalogItemId: "c",
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        locked: "yes",
      },
    ] as never;
    expect(parseScene(JSON.stringify(broken)).ok).toBe(false);
  });
});

describe("migrating a version 1 file", () => {
  /** v1 held a single `room` and no ids or names. */
  function version1(): string {
    const scene = sceneWithRoom();
    const raw = JSON.parse(serializeScene(scene)) as Record<string, unknown>;
    const rooms = raw.rooms as Record<string, unknown>[];
    const room = { ...rooms[0]! };
    delete room.id;
    delete room.name;
    return JSON.stringify({ version: 1, room, placements: raw.placements });
  }

  it("reads a v1 file", () => {
    const result = parseScene(version1());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene.rooms).toHaveLength(1);
  });

  it("keeps the geometry intact", () => {
    const parsed = parsedOrThrow(version1());
    expect(parsed.rooms[0]?.walls).toHaveLength(4);
    expect(parsed.rooms[0]?.polygon).toHaveLength(4);
  });

  it("synthesises an id and name", () => {
    const parsed = parsedOrThrow(version1());
    expect(parsed.rooms[0]?.id).toBe("r0");
    expect(parsed.rooms[0]?.name).toBe("Room 1");
  });

  it("stamps the current version on the way out", () => {
    expect(parsedOrThrow(version1()).version).toBe(SCENE_VERSION);
  });

  it("still rejects a version from the future", () => {
    const result = parseScene(JSON.stringify({ ...emptyScene(), version: 99 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("99");
  });

  it("rejects a scene with no rooms at all", () => {
    expect(parseScene(JSON.stringify({ version: 2, rooms: [], placements: [] })).ok).toBe(
      false,
    );
  });

  it("round-trips several rooms", () => {
    const scene = sceneWithRoom();
    scene.rooms.push({ ...scene.rooms[0]!, id: "r1", name: "Room 2" });
    expect(parsedOrThrow(serializeScene(scene)).rooms).toHaveLength(2);
  });
});
