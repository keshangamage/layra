import type { Room, Scene, Vec2, Wall } from "@layra/types";
import { ensureCCW } from "@layra/geometry";

/**
 * Pure transform. Commands capture explicit before/after values at construction
 * rather than recomputing, so replaying a redo always lands on the same scene.
 */
export interface Command {
  label: string;
  do(scene: Scene): Scene;
  undo(scene: Scene): Scene;
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

export function moveVertex(index: number, from: Vec2, to: Vec2): Command {
  const apply = (scene: Scene, position: Vec2): Scene => {
    const polygon = scene.room.polygon.map((p, i) => (i === index ? position : p));
    const settings = wallSettingsOf(scene, { height: 2.5, thickness: 0.2 });
    return withRoom(
      scene,
      roomFromPolygon(polygon, settings, scene.room.floorMaterial),
    );
  };
  return {
    label: `Move vertex ${index + 1}`,
    do: (scene) => apply(scene, to),
    undo: (scene) => apply(scene, from),
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
    do: (scene) => apply(scene, next),
    undo: (scene) => apply(scene, prev),
  };
}

export function loadScene(prev: Scene, next: Scene): Command {
  return {
    label: "Load scene",
    do: () => next,
    undo: () => prev,
  };
}
