import type {
  Opening,
  Placement,
  Room,
  Scene,
  Vec2,
  Vec3,
  Wall,
} from "@layra/types";
import { distance, ensureCCW } from "@layra/geometry";
import { clampOpening } from "./openings";

/**
 * Pure transform. Commands capture explicit before/after values at construction
 * rather than recomputing, so replaying a redo always lands on the same scene.
 */
export interface Command {
  label: string;
  do(scene: Scene): Scene;
  undo(scene: Scene): Scene;
  /**
   * Commands sharing a key collapse into one history entry when executed back
   * to back, so dragging a slider is one undo rather than fifty.
   */
  mergeKey?: string;
}

export interface WallSettings {
  height: number;
  thickness: number;
}

/** Wall ids are index-derived so they stay stable across replay. */
export function roomFromPolygon(
  polygon: readonly Vec2[],
  settings: WallSettings,
  base: Pick<Room, "id" | "name" | "floorMaterial">,
): Room {
  const normalized = ensureCCW(polygon);
  const walls: Wall[] = normalized.map((start, i) => ({
    id: `w${i}`,
    start,
    end: normalized[(i + 1) % normalized.length]!,
    height: settings.height,
    thickness: settings.thickness,
    openings: [],
  }));
  return { ...base, walls, polygon: normalized };
}

/** Height and thickness of the current room, or the fallback when there is none. */
export function wallSettingsOf(
  scene: Scene,
  index: number,
  fallback: WallSettings,
): WallSettings {
  const first = scene.rooms[index]?.walls[0];
  if (!first) return fallback;
  return { height: first.height, thickness: first.thickness };
}

function withRoom(scene: Scene, index: number, room: Room): Scene {
  return {
    ...scene,
    rooms: scene.rooms.map((existing, i) => (i === index ? room : existing)),
  };
}

function roomAt(scene: Scene, index: number): Room | undefined {
  return scene.rooms[index];
}

export function closeRoom(
  index: number,
  polygon: readonly Vec2[],
  settings: WallSettings,
  base: Pick<Room, "id" | "name" | "floorMaterial">,
): Command {
  const next = roomFromPolygon(polygon, settings, base);
  return {
    label: `Draw room (${next.walls.length} walls)`,
    do: (scene) => withRoom(scene, index, next),
    undo: (scene) => withRoom(scene, index, { ...base, walls: [], polygon: [] }),
  };
}

/** Rebuilds walls for a new polygon, carrying openings across by wall index. */
function roomWithOpenings(
  polygon: readonly Vec2[],
  settings: WallSettings,
  base: Pick<Room, "id" | "name" | "floorMaterial">,
  openings: readonly (readonly Opening[])[],
  clampToFit: boolean,
): Room {
  const room = roomFromPolygon(polygon, settings, base);
  return {
    ...room,
    walls: room.walls.map((wall, i) => {
      const carried = openings[i] ?? [];
      if (!clampToFit) return { ...wall, openings: [...carried] };
      const length = distance(wall.start, wall.end);
      return {
        ...wall,
        openings: carried.map((o) => clampOpening(o, length, wall.height)),
      };
    }),
  };
}

/**
 * Moving a vertex resizes two walls, so openings are carried across and pulled
 * back inside. The originals are captured here rather than recomputed, so undo
 * restores their exact positions instead of the clamped ones.
 */
export function moveVertex(
  roomIndex: number,
  index: number,
  from: Vec2,
  to: Vec2,
  fromOpenings: readonly (readonly Opening[])[],
): Command {
  const apply = (
    scene: Scene,
    position: Vec2,
    openings: readonly (readonly Opening[])[],
    clampToFit: boolean,
  ): Scene => {
    const room = roomAt(scene, roomIndex);
    if (!room) return scene;
    const polygon = room.polygon.map((p, i) => (i === index ? position : p));
    const settings = wallSettingsOf(scene, roomIndex, { height: 2.5, thickness: 0.2 });
    return withRoom(
      scene,
      roomIndex,
      roomWithOpenings(polygon, settings, room, openings, clampToFit),
    );
  };
  return {
    label: `Move vertex ${index + 1}`,
    do: (scene) => apply(scene, to, fromOpenings, true),
    undo: (scene) => apply(scene, from, fromOpenings, false),
  };
}

function rebuild(
  scene: Scene,
  roomIndex: number,
  polygon: readonly Vec2[],
  openings: readonly (readonly Opening[])[],
  clampToFit: boolean,
): Scene {
  const room = roomAt(scene, roomIndex);
  if (!room) return scene;
  return withRoom(
    scene,
    roomIndex,
    roomWithOpenings(
      polygon,
      wallSettingsOf(scene, roomIndex, { height: 2.5, thickness: 0.2 }),
      room,
      openings,
      clampToFit,
    ),
  );
}

/**
 * Splits wall `index` at `splitAt` metres along it.
 *
 * Openings move to whichever half contains them. One straddling the split is
 * dropped rather than cut in two - half a door is not a door.
 */
export function addVertex(
  roomIndex: number,
  index: number,
  point: Vec2,
  splitAt: number,
  fromPolygon: readonly Vec2[],
  fromOpenings: readonly (readonly Opening[])[],
): Command {
  const nextPolygon = [...fromPolygon];
  nextPolygon.splice(index + 1, 0, point);

  const carried = fromOpenings[index] ?? [];
  const nextOpenings: Opening[][] = [];
  for (let w = 0; w < fromPolygon.length; w++) {
    if (w !== index) {
      nextOpenings.push([...(fromOpenings[w] ?? [])]);
      continue;
    }
    nextOpenings.push(carried.filter((o) => o.offset + o.width <= splitAt));
    nextOpenings.push(
      carried
        .filter((o) => o.offset >= splitAt)
        .map((o) => ({ ...o, offset: o.offset - splitAt })),
    );
  }

  return {
    label: "Add corner",
    do: (scene) => rebuild(scene, roomIndex, nextPolygon, nextOpenings, true),
    undo: (scene) => rebuild(scene, roomIndex, fromPolygon, fromOpenings, false),
  };
}

/**
 * Removes a corner, merging the two walls that met there.
 *
 * Their openings are dropped: both sat on geometry that no longer exists, and
 * re-projecting them onto a wall at a different angle would move them somewhere
 * the user never chose. Undo restores them exactly.
 */
export function removeVertex(
  roomIndex: number,
  index: number,
  fromPolygon: readonly Vec2[],
  fromOpenings: readonly (readonly Opening[])[],
): Command {
  const n = fromPolygon.length;
  const nextPolygon = fromPolygon.filter((_, i) => i !== index);

  const previous = (index - 1 + n) % n;
  const nextOpenings: Opening[][] = [];
  for (let w = 0; w < n; w++) {
    if (w === index) continue;
    // The merged wall keeps no openings, and is emitted once in the pair's place.
    nextOpenings.push(w === previous ? [] : [...(fromOpenings[w] ?? [])]);
  }

  return {
    label: "Remove corner",
    do: (scene) => rebuild(scene, roomIndex, nextPolygon, nextOpenings, true),
    undo: (scene) => rebuild(scene, roomIndex, fromPolygon, fromOpenings, false),
  };
}

export function addRoom(room: Room): Command {
  return {
    label: `Add ${room.name}`,
    do: (scene) => ({ ...scene, rooms: [...scene.rooms, room] }),
    undo: (scene) => ({
      ...scene,
      rooms: scene.rooms.filter((existing) => existing.id !== room.id),
    }),
  };
}

export function reorderRooms(
  from: number,
  to: number,
  before: readonly Room[],
): Command {
  const after = [...before];
  const [room] = after.splice(from, 1);
  if (!room) return { label: "Reorder rooms", do: (scene) => scene, undo: (scene) => scene };
  after.splice(to, 0, room);
  return {
    label: "Reorder rooms",
    do: (scene) => ({ ...scene, rooms: after }),
    undo: (scene) => ({ ...scene, rooms: [...before] }),
  };
}

export function duplicateRoom(
  index: number,
  room: Room,
  copy: Room,
  copyContents: readonly Placement[],
): Command {
  return {
    label: `Duplicate ${room.name}`,
    do: (scene) => {
      const rooms = [...scene.rooms];
      rooms.splice(Math.min(index + 1, rooms.length), 0, copy);
      return { ...scene, rooms, placements: [...scene.placements, ...copyContents] };
    },
    undo: (scene) => ({
      ...scene,
      rooms: scene.rooms.filter((existing) => existing.id !== copy.id),
      placements: scene.placements.filter(
        (placement) => !copyContents.some((copyPlacement) => copyPlacement.id === placement.id),
      ),
    }),
  };
}

function translatedRoom(room: Room, dx: number, dz: number): Room {
  const move = (point: Vec2): Vec2 => ({ x: point.x + dx, z: point.z + dz });
  return {
    ...room,
    polygon: room.polygon.map(move),
    walls: room.walls.map((wall) => ({ ...wall, start: move(wall.start), end: move(wall.end) })),
  };
}

export function moveRoom(
  index: number,
  room: Room,
  contents: readonly Placement[],
  dx: number,
  dz: number,
): Command {
  const ids = new Set(contents.map((placement) => placement.id));
  const apply = (scene: Scene, x: number, z: number): Scene => ({
    ...scene,
    rooms: scene.rooms.map((existing, i) =>
      i === index ? translatedRoom(existing, x, z) : existing,
    ),
    placements: scene.placements.map((placement) =>
      ids.has(placement.id)
        ? { ...placement, position: { ...placement.position, x: placement.position.x + x, z: placement.position.z + z } }
        : placement,
    ),
  });

  return {
    label: `Move ${room.name}`,
    do: (scene) => apply(scene, dx, dz),
    undo: (scene) => apply(scene, -dx, -dz),
  };
}

function rotatedPoint(point: Vec2, pivot: Vec2, radians: number): Vec2 {
  const x = point.x - pivot.x;
  const z = point.z - pivot.z;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const clean = (value: number) => (Math.abs(value) < 1e-10 ? 0 : value);
  return {
    x: clean(pivot.x + x * cos - z * sin),
    z: clean(pivot.z + x * sin + z * cos),
  };
}

function rotatedRoom(room: Room, pivot: Vec2, radians: number): Room {
  const rotate = (point: Vec2) => rotatedPoint(point, pivot, radians);
  return {
    ...room,
    polygon: room.polygon.map(rotate),
    walls: room.walls.map((wall) => ({
      ...wall,
      start: rotate(wall.start),
      end: rotate(wall.end),
    })),
  };
}

export function rotateRoom(
  index: number,
  room: Room,
  contents: readonly Placement[],
  pivot: Vec2,
  radians: number,
): Command {
  const ids = new Set(contents.map((placement) => placement.id));
  const apply = (scene: Scene, angle: number): Scene => ({
    ...scene,
    rooms: scene.rooms.map((existing, i) =>
      i === index ? rotatedRoom(existing, pivot, angle) : existing,
    ),
    placements: scene.placements.map((placement) => {
      if (!ids.has(placement.id)) return placement;
      const position = rotatedPoint(
        { x: placement.position.x, z: placement.position.z },
        pivot,
        angle,
      );
      return {
        ...placement,
        position: { ...placement.position, x: position.x, z: position.z },
        rotationY: placement.rotationY + angle,
      };
    }),
  });

  return {
    label: `Rotate ${room.name}`,
    do: (scene) => apply(scene, radians),
    undo: (scene) => apply(scene, -radians),
  };
}

/**
 * Removes a room and the furniture standing in it.
 *
 * Leaving the contents behind would strand them outside every room, where
 * collision immediately flags them. Undo restores both.
 */
export function removeRoom(
  index: number,
  room: Room,
  contents: readonly Placement[] = [],
): Command {
  const removed = new Set(contents.map((p) => p.id));
  const label =
    contents.length > 0
      ? `Delete ${room.name} and ${contents.length} item${contents.length === 1 ? "" : "s"}`
      : `Delete ${room.name}`;

  return {
    label,
    do: (scene) => ({
      ...scene,
      rooms: scene.rooms.filter((_, i) => i !== index),
      placements: scene.placements.filter((p) => !removed.has(p.id)),
    }),
    // Restores at its original position so undo does not reorder the list.
    undo: (scene) => {
      const rooms = [...scene.rooms];
      rooms.splice(Math.min(index, rooms.length), 0, room);
      return { ...scene, rooms, placements: [...scene.placements, ...contents] };
    },
  };
}

export function renameRoom(index: number, from: string, to: string): Command {
  const apply = (scene: Scene, name: string): Scene => {
    const room = roomAt(scene, index);
    return room ? withRoom(scene, index, { ...room, name }) : scene;
  };
  return {
    label: "Rename room",
    mergeKey: `rename-${index}`,
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
  };
}

export function setFloorMaterial(
  roomIndex: number,
  from: string,
  to: string,
): Command {
  const apply = (scene: Scene, floorMaterial: string): Scene => {
    const room = roomAt(scene, roomIndex);
    return room ? withRoom(scene, roomIndex, { ...room, floorMaterial }) : scene;
  };
  return {
    label: "Change floor",
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
  };
}

export function setWallSettings(
  roomIndex: number,
  prev: WallSettings,
  next: WallSettings,
): Command {
  const apply = (scene: Scene, settings: WallSettings): Scene => {
    const room = roomAt(scene, roomIndex);
    if (!room) return scene;
    return withRoom(scene, roomIndex, {
      ...room,
      walls: room.walls.map((wall) => ({ ...wall, ...settings })),
    });
  };
  const changed = prev.height !== next.height ? "height" : "thickness";
  return {
    label: `Set wall ${changed}`,
    mergeKey: `wall-${changed}`,
    do: (scene) => apply(scene, next),
    undo: (scene) => apply(scene, prev),
  };
}

export function addPlacement(placement: Placement, label: string): Command {
  return {
    label: `Add ${label}`,
    do: (scene) => ({ ...scene, placements: [...scene.placements, placement] }),
    undo: (scene) => ({
      ...scene,
      placements: scene.placements.filter((p) => p.id !== placement.id),
    }),
  };
}

export function removePlacement(
  placement: Placement,
  index: number,
  label: string,
): Command {
  return {
    label: `Delete ${label}`,
    do: (scene) => ({
      ...scene,
      placements: scene.placements.filter((p) => p.id !== placement.id),
    }),
    // Restores at the original index so undo doesn't reorder the list.
    undo: (scene) => {
      const next = [...scene.placements];
      next.splice(Math.min(index, next.length), 0, placement);
      return { ...scene, placements: next };
    },
  };
}

export function movePlacement(id: string, from: Vec3, to: Vec3): Command {
  const apply = (scene: Scene, position: Vec3): Scene => ({
    ...scene,
    placements: scene.placements.map((p) => (p.id === id ? { ...p, position } : p)),
  });
  return {
    label: "Move furniture",
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
  };
}

export interface Transform {
  position: Vec3;
  rotationY: number;
}

/** Moves and rotates together, so sliding a wall piece is one history entry. */
export function transformPlacement(
  id: string,
  from: Transform,
  to: Transform,
): Command {
  const apply = (scene: Scene, next: Transform): Scene => ({
    ...scene,
    placements: scene.placements.map((p) =>
      p.id === id ? { ...p, position: next.position, rotationY: next.rotationY } : p,
    ),
  });
  return {
    label: "Move furniture",
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
  };
}

export function setPlacementLock(id: string, locked: boolean): Command {
  const apply = (scene: Scene, value: boolean): Scene => ({
    ...scene,
    placements: scene.placements.map((p) => (p.id === id ? { ...p, locked: value } : p)),
  });
  return {
    label: locked ? "Lock furniture" : "Unlock furniture",
    do: (scene) => apply(scene, locked),
    undo: (scene) => apply(scene, !locked),
  };
}

/** Absolute angle, unlike rotatePlacement's delta, so a slider can merge. */
export function setPlacementRotation(
  id: string,
  from: number,
  to: number,
): Command {
  const apply = (scene: Scene, rotationY: number): Scene => ({
    ...scene,
    placements: scene.placements.map((p) => (p.id === id ? { ...p, rotationY } : p)),
  });
  return {
    label: "Rotate furniture",
    mergeKey: `rotate-${id}`,
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
  };
}

export function rotatePlacement(id: string, from: number, to: number): Command {
  const apply = (scene: Scene, rotationY: number): Scene => ({
    ...scene,
    placements: scene.placements.map((p) => (p.id === id ? { ...p, rotationY } : p)),
  });
  return {
    label: "Rotate furniture",
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
  };
}

function mapWall(
  scene: Scene,
  roomIndex: number,
  index: number,
  fn: (wall: Wall) => Wall,
): Scene {
  const room = roomAt(scene, roomIndex);
  if (!room) return scene;
  return withRoom(scene, roomIndex, {
    ...room,
    walls: room.walls.map((wall, i) => (i === index ? fn(wall) : wall)),
  });
}

export function addOpening(
  roomIndex: number,
  index: number,
  opening: Opening,
): Command {
  return {
    label: `Add ${opening.type}`,
    do: (scene) =>
      mapWall(scene, roomIndex, index, (wall) => ({
        ...wall,
        openings: [...wall.openings, opening],
      })),
    undo: (scene) =>
      mapWall(scene, roomIndex, index, (wall) => ({
        ...wall,
        openings: wall.openings.filter((o) => o.id !== opening.id),
      })),
  };
}

export function removeOpening(
  roomIndex: number,
  index: number,
  opening: Opening,
  position: number,
): Command {
  return {
    label: `Delete ${opening.type}`,
    do: (scene) =>
      mapWall(scene, roomIndex, index, (wall) => ({
        ...wall,
        openings: wall.openings.filter((o) => o.id !== opening.id),
      })),
    // Restores at its original position so undo does not reorder.
    undo: (scene) =>
      mapWall(scene, roomIndex, index, (wall) => {
        const next = [...wall.openings];
        next.splice(Math.min(position, next.length), 0, opening);
        return { ...wall, openings: next };
      }),
  };
}

export function updateOpening(
  roomIndex: number,
  index: number,
  from: Opening,
  to: Opening,
  field: string,
): Command {
  const apply = (scene: Scene, opening: Opening): Scene =>
    mapWall(scene, roomIndex, index, (wall) => ({
      ...wall,
      openings: wall.openings.map((o) => (o.id === opening.id ? opening : o)),
    }));
  return {
    label: `Adjust ${to.type} ${field}`,
    mergeKey: `opening-${to.id}-${field}`,
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
  };
}

export function loadScene(prev: Scene, next: Scene): Command {
  return {
    label: "Load scene",
    do: () => next,
    undo: () => prev,
  };
}
