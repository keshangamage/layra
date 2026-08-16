import {
  SCENE_VERSION,
  type Opening,
  type Placement,
  type Room,
  type Scene,
  type Vec2,
  type Vec3,
  type Wall,
  type FurnitureFinish,
  type WallMaterial,
  type CeilingMaterial,
} from "@layra/types";

export type ParseResult =
  | { ok: true; scene: Scene }
  | { ok: false; error: string };

export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function vec2(value: unknown): Vec2 | null {
  if (!isRecord(value) || !num(value.x) || !num(value.z)) return null;
  return { x: value.x, z: value.z };
}

function vec3(value: unknown): Vec3 | null {
  if (!isRecord(value) || !num(value.x) || !num(value.y) || !num(value.z)) return null;
  return { x: value.x, y: value.y, z: value.z };
}

function opening(value: unknown): Opening | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (value.type !== "door" && value.type !== "window") return null;
  if (!num(value.offset) || !num(value.width) || !num(value.height)) return null;
  if (!num(value.sillHeight)) return null;
  const open = value.open === undefined ? undefined : value.open;
  if (open !== undefined && typeof open !== "boolean") return null;
  const curtainsOpen = value.curtainsOpen === undefined ? undefined : value.curtainsOpen;
  if (curtainsOpen !== undefined && typeof curtainsOpen !== "boolean") return null;
  return {
    id: value.id,
    type: value.type,
    offset: value.offset,
    width: value.width,
    height: value.height,
    sillHeight: value.sillHeight,
    open,
    curtainsOpen,
  };
}

function wall(value: unknown): Wall | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const start = vec2(value.start);
  const end = vec2(value.end);
  if (!start || !end || !num(value.height) || !num(value.thickness)) return null;
  if (!Array.isArray(value.openings)) return null;

  const openings: Opening[] = [];
  for (const raw of value.openings) {
    const parsed = opening(raw);
    if (!parsed) return null;
    openings.push(parsed);
  }
  return {
    id: value.id,
    start,
    end,
    height: value.height,
    thickness: value.thickness,
    openings,
  };
}

function placement(value: unknown): Placement | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.catalogItemId !== "string") return null;
  const position = vec3(value.position);
  if (!position || !num(value.rotationY) || typeof value.locked !== "boolean") return null;
  const finish = value.finish === undefined ? undefined : value.finish;
  if (
    finish !== undefined &&
    finish !== "natural" &&
    finish !== "painted" &&
    finish !== "fabric" &&
    finish !== "leather" &&
    finish !== "metal"
  ) return null;
  return {
    id: value.id,
    catalogItemId: value.catalogItemId,
    position,
    rotationY: value.rotationY,
    locked: value.locked,
    finish: finish as FurnitureFinish | undefined,
  };
}

function room(value: unknown, fallbackIndex: number): Room | null {
  if (!isRecord(value)) return null;
  if (typeof value.floorMaterial !== "string") return null;
  if (!Array.isArray(value.walls) || !Array.isArray(value.polygon)) return null;
  const wallMaterial = value.wallMaterial === undefined ? undefined : value.wallMaterial;
  if (
    wallMaterial !== undefined &&
    wallMaterial !== "plaster" &&
    wallMaterial !== "warm-white" &&
    wallMaterial !== "concrete" &&
    wallMaterial !== "brick"
  ) return null;
  const ceilingMaterial = value.ceilingMaterial === undefined ? undefined : value.ceilingMaterial;
  if (
    ceilingMaterial !== undefined &&
    ceilingMaterial !== "painted" &&
    ceilingMaterial !== "wood" &&
    ceilingMaterial !== "concrete"
  ) return null;
  const ceilingVisible = value.ceilingVisible === undefined ? undefined : value.ceilingVisible;
  if (ceilingVisible !== undefined && typeof ceilingVisible !== "boolean") return null;

  const walls: Wall[] = [];
  for (const raw of value.walls) {
    const parsed = wall(raw);
    if (!parsed) return null;
    walls.push(parsed);
  }

  const polygon: Vec2[] = [];
  for (const raw of value.polygon) {
    const parsed = vec2(raw);
    if (!parsed) return null;
    polygon.push(parsed);
  }

  return {
    // v1 rooms had neither, so synthesise stable ones on the way in.
    id: typeof value.id === "string" ? value.id : `r${fallbackIndex}`,
    name: typeof value.name === "string" ? value.name : `Room ${fallbackIndex + 1}`,
    locked: value.locked === true,
    walls,
    polygon,
    floorMaterial: value.floorMaterial,
    wallMaterial: wallMaterial as WallMaterial | undefined,
    ceilingMaterial: ceilingMaterial as CeilingMaterial | undefined,
    ceilingVisible,
  };
}

/** Validates untrusted JSON rather than trusting its shape. */
export function parseScene(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }

  if (!isRecord(raw)) return { ok: false, error: "Expected a scene object." };

  if (!num(raw.version)) return { ok: false, error: "Missing scene version." };
  if (raw.version > SCENE_VERSION) {
    return {
      ok: false,
      error: `Scene version ${raw.version} is newer than this app supports (${SCENE_VERSION}).`,
    };
  }

  // v1 held a single `room`; v2 holds `rooms`. Read either.
  const rawRooms = Array.isArray(raw.rooms)
    ? raw.rooms
    : raw.room !== undefined
      ? [raw.room]
      : null;
  if (!rawRooms) return { ok: false, error: "Room data is missing." };

  const rooms: Room[] = [];
  for (const [index, entry] of rawRooms.entries()) {
    const parsed = room(entry, index);
    if (!parsed) return { ok: false, error: "Room data is malformed." };
    rooms.push(parsed);
  }
  if (rooms.length === 0) return { ok: false, error: "A scene needs at least one room." };

  if (!Array.isArray(raw.placements)) {
    return { ok: false, error: "Placements must be a list." };
  }
  const placements: Placement[] = [];
  for (const item of raw.placements) {
    const parsed = placement(item);
    if (!parsed) return { ok: false, error: "Placement data is malformed." };
    placements.push(parsed);
  }

  return {
    ok: true,
    scene: { version: SCENE_VERSION, rooms, placements },
  };
}
