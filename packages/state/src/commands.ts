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
  floorMaterial = "default",
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
  return { walls, polygon: normalized, floorMaterial };
}

/** Height and thickness of the current room, or the fallback when there is none. */
export function wallSettingsOf(scene: Scene, fallback: WallSettings): WallSettings {
  const first = scene.room.walls[0];
  if (!first) return fallback;
  return { height: first.height, thickness: first.thickness };
}

function withRoom(scene: Scene, room: Room): Scene {
  return { ...scene, room };
}

export function closeRoom(polygon: readonly Vec2[], settings: WallSettings): Command {
  const next = roomFromPolygon(polygon, settings);
  return {
    label: `Draw room (${next.walls.length} walls)`,
    do: (scene) => withRoom(scene, next),
    undo: (scene) =>
      withRoom(scene, { walls: [], polygon: [], floorMaterial: next.floorMaterial }),
  };
}

/** Rebuilds walls for a new polygon, carrying openings across by wall index. */
function roomWithOpenings(
  polygon: readonly Vec2[],
  settings: WallSettings,
  floorMaterial: string,
  openings: readonly (readonly Opening[])[],
  clampToFit: boolean,
): Room {
  const room = roomFromPolygon(polygon, settings, floorMaterial);
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
    const polygon = scene.room.polygon.map((p, i) => (i === index ? position : p));
    const settings = wallSettingsOf(scene, { height: 2.5, thickness: 0.2 });
    return withRoom(
      scene,
      roomWithOpenings(
        polygon,
        settings,
        scene.room.floorMaterial,
        openings,
        clampToFit,
      ),
    );
  };
  return {
    label: `Move vertex ${index + 1}`,
    do: (scene) => apply(scene, to, fromOpenings, true),
    undo: (scene) => apply(scene, from, fromOpenings, false),
  };
}

/**
 * Splits wall `index` at `splitAt` metres along it.
 *
 * Openings move to whichever half contains them. One straddling the split is
 * dropped rather than cut in two - half a door is not a door.
 */
export function addVertex(
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
    do: (scene) =>
      withRoom(
        scene,
        roomWithOpenings(
          nextPolygon,
          wallSettingsOf(scene, { height: 2.5, thickness: 0.2 }),
          scene.room.floorMaterial,
          nextOpenings,
          true,
        ),
      ),
    undo: (scene) =>
      withRoom(
        scene,
        roomWithOpenings(
          fromPolygon,
          wallSettingsOf(scene, { height: 2.5, thickness: 0.2 }),
          scene.room.floorMaterial,
          fromOpenings,
          false,
        ),
      ),
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
    do: (scene) =>
      withRoom(
        scene,
        roomWithOpenings(
          nextPolygon,
          wallSettingsOf(scene, { height: 2.5, thickness: 0.2 }),
          scene.room.floorMaterial,
          nextOpenings,
          true,
        ),
      ),
    undo: (scene) =>
      withRoom(
        scene,
        roomWithOpenings(
          fromPolygon,
          wallSettingsOf(scene, { height: 2.5, thickness: 0.2 }),
          scene.room.floorMaterial,
          fromOpenings,
          false,
        ),
      ),
  };
}

export function setWallSettings(prev: WallSettings, next: WallSettings): Command {
  const apply = (scene: Scene, settings: WallSettings): Scene =>
    withRoom(scene, {
      ...scene.room,
      walls: scene.room.walls.map((wall) => ({ ...wall, ...settings })),
    });
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

function mapWall(scene: Scene, index: number, fn: (wall: Wall) => Wall): Scene {
  return {
    ...scene,
    room: {
      ...scene.room,
      walls: scene.room.walls.map((wall, i) => (i === index ? fn(wall) : wall)),
    },
  };
}

export function addOpening(index: number, opening: Opening): Command {
  return {
    label: `Add ${opening.type}`,
    do: (scene) =>
      mapWall(scene, index, (wall) => ({
        ...wall,
        openings: [...wall.openings, opening],
      })),
    undo: (scene) =>
      mapWall(scene, index, (wall) => ({
        ...wall,
        openings: wall.openings.filter((o) => o.id !== opening.id),
      })),
  };
}

export function removeOpening(
  index: number,
  opening: Opening,
  position: number,
): Command {
  return {
    label: `Delete ${opening.type}`,
    do: (scene) =>
      mapWall(scene, index, (wall) => ({
        ...wall,
        openings: wall.openings.filter((o) => o.id !== opening.id),
      })),
    // Restores at its original position so undo does not reorder.
    undo: (scene) =>
      mapWall(scene, index, (wall) => {
        const next = [...wall.openings];
        next.splice(Math.min(position, next.length), 0, opening);
        return { ...wall, openings: next };
      }),
  };
}

export function updateOpening(
  index: number,
  from: Opening,
  to: Opening,
  field: string,
): Command {
  const apply = (scene: Scene, opening: Opening): Scene =>
    mapWall(scene, index, (wall) => ({
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
