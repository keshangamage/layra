import { createStore, type StoreApi } from "zustand/vanilla";
import {
  emptyScene,
  type Opening,
  type OpeningType,
  type Placement,
  type Scene,
  type Vec2,
  type Vec3,
} from "@layra/types";
import { bounds, distance, nearestWallStation, selfIntersects } from "@layra/geometry";
import { findCatalogItem } from "./catalog";
import {
  addOpening,
  addPlacement,
  closeRoom,
  loadScene,
  movePlacement,
  moveVertex,
  removeOpening,
  removePlacement,
  rotatePlacement,
  setWallSettings,
  updateOpening,
  wallSettingsOf,
  type Command,
  type WallSettings,
} from "./commands";
import { snapPoint } from "./snap";
import { clampOpening, sameOpening } from "./openings";

export type Mode = "draw" | "edit" | "measure";

/** The editable dimensions of an opening. */
export type OpeningShape = Pick<
  Opening,
  "offset" | "width" | "height" | "sillHeight"
>;

export interface SnapSettings {
  /** Metres. */
  grid: number;
  /** Radians. */
  angle: number;
}

export interface EditorState {
  scene: Scene;
  past: Command[];
  future: Command[];
  mode: Mode;

  /** Vertices placed so far in draw mode. */
  draft: Vec2[];
  /** Live preview point following the pointer. */
  cursor: Vec2 | null;
  /** Set only mid-drag, so re-extrusion is live but history stays clean. */
  dragging: { index: number; position: Vec2 } | null;

  /** Applied to new rooms; existing rooms carry their own per-wall values. */
  wallDefaults: WallSettings;
  snap: SnapSettings;

  execute: (command: Command) => void;
  undo: () => void;
  redo: () => void;

  setMode: (mode: Mode) => void;
  addDraftPoint: (point: Vec2) => void;
  setCursor: (point: Vec2 | null) => void;
  cancelDraft: () => void;
  closeDraft: () => boolean;

  beginDrag: (index: number) => void;
  updateDrag: (position: Vec2) => void;
  endDrag: () => void;

  applyWallSettings: (next: Partial<WallSettings>) => void;
  replaceScene: (next: Scene) => void;

  /** Two-point ruler. Null entries mean that end is not placed yet. */
  measure: { from: Vec2 | null; to: Vec2 | null };
  addMeasurePoint: (point: Vec2) => void;
  setMeasureCursor: (point: Vec2 | null) => void;
  clearMeasure: () => void;

  /** Wall length labels. */
  showDimensions: boolean;
  toggleDimensions: () => void;

  /** Armed opening type; the next wall click places one. */
  pendingOpening: OpeningType | null;
  armOpening: (type: OpeningType | null) => void;
  placeOpeningAt: (point: Vec2) => boolean;
  deleteOpening: (wallIndex: number, openingId: string) => void;

  selectedOpening: { wallIndex: number; id: string } | null;
  selectOpening: (ref: { wallIndex: number; id: string } | null) => void;
  updateSelectedOpening: (patch: Partial<OpeningShape>) => void;

  /** Currently selected furniture, or null. */
  selectedId: string | null;
  selectPlacement: (id: string | null) => void;
  placeFurniture: (catalogItemId: string) => void;
  deleteSelected: () => void;
  rotateSelected: (radians: number) => void;

  /** Transient, like `dragging`, so history gets one entry per gesture. */
  placementDrag: { id: string; offset: Vec2; position: Vec3 } | null;
  beginPlacementDrag: (id: string, pointer: Vec2) => void;
  updatePlacementDrag: (pointer: Vec2) => void;
  endPlacementDrag: () => void;
}

/** Standard sizes, in metres. */
export const OPENING_DEFAULTS: Record<
  OpeningType,
  { width: number; height: number; sillHeight: number }
> = {
  door: { width: 0.9, height: 2.05, sillHeight: 0 },
  window: { width: 1.2, height: 1.1, sillHeight: 0.9 },
};

export const DEFAULT_SNAP: SnapSettings = { grid: 0.1, angle: Math.PI / 12 };
export const DEFAULT_WALLS: WallSettings = { height: 2.5, thickness: 0.2 };

/** The polygon as currently displayed, including an in-progress drag. */
export function livePolygon(state: EditorState): Vec2[] {
  const { polygon } = state.scene.room;
  const drag = state.dragging;
  if (!drag) return polygon;
  return polygon.map((p, i) => (i === drag.index ? drag.position : p));
}

export function currentWallSettings(state: EditorState): WallSettings {
  return wallSettingsOf(state.scene, state.wallDefaults);
}

/**
 * Placements as currently displayed, including an in-progress drag.
 * Builds a fresh object mid-drag, so memoize it rather than passing it
 * straight to a store subscription.
 */
export function livePlacements(state: EditorState): Placement[] {
  const drag = state.placementDrag;
  if (!drag) return state.scene.placements;
  return state.scene.placements.map((p) =>
    p.id === drag.id ? { ...p, position: drag.position } : p,
  );
}

export function historyLabels(state: EditorState): {
  past: string[];
  future: string[];
} {
  return {
    past: state.past.map((c) => c.label),
    future: state.future.map((c) => c.label),
  };
}

export type EditorStore = StoreApi<EditorState>;

export function createEditorStore(initial?: Partial<EditorState>): EditorStore {
  return createStore<EditorState>()((set, get) => ({
    scene: emptyScene(),
    past: [],
    future: [],
    mode: "draw",
    draft: [],
    cursor: null,
    dragging: null,
    wallDefaults: DEFAULT_WALLS,
    snap: DEFAULT_SNAP,

    execute: (command) =>
      set((state) => {
        const previous = state.past.at(-1);
        if (command.mergeKey && previous?.mergeKey === command.mergeKey) {
          // Keep the earlier undo so the whole run reverts in one step. Safe
          // because commands capture absolute before/after values.
          const merged: Command = {
            label: command.label,
            mergeKey: command.mergeKey,
            do: command.do,
            undo: previous.undo,
          };
          return {
            scene: command.do(state.scene),
            past: [...state.past.slice(0, -1), merged],
            future: [],
          };
        }
        return {
          scene: command.do(state.scene),
          past: [...state.past, command],
          future: [],
        };
      }),

    undo: () =>
      set((state) => {
        const command = state.past.at(-1);
        if (!command) return state;
        return {
          scene: command.undo(state.scene),
          past: state.past.slice(0, -1),
          future: [command, ...state.future],
        };
      }),

    redo: () =>
      set((state) => {
        const command = state.future[0];
        if (!command) return state;
        return {
          scene: command.do(state.scene),
          past: [...state.past, command],
          future: state.future.slice(1),
        };
      }),

    setMode: (mode) =>
      set({
        mode,
        draft: [],
        cursor: null,
        dragging: null,
        measure: { from: null, to: null },
      }),

    measure: { from: null, to: null },
    showDimensions: true,

    toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),

    addMeasurePoint: (point) =>
      set((state) => {
        // Third click starts a fresh measurement.
        if (state.measure.from && state.measure.to) {
          return { measure: { from: point, to: null } };
        }
        if (!state.measure.from) return { measure: { from: point, to: null } };
        return { measure: { from: state.measure.from, to: point } };
      }),

    setMeasureCursor: (point) =>
      set((state) =>
        state.measure.from && !state.measure.to ? { cursor: point } : state,
      ),

    clearMeasure: () => set({ measure: { from: null, to: null }, cursor: null }),

    pendingOpening: null,

    armOpening: (pendingOpening) => set({ pendingOpening }),

    placeOpeningAt: (point) => {
      const state = get();
      const type = state.pendingOpening;
      if (!type) return false;

      const station = nearestWallStation(state.scene.room.polygon, point);
      const wall = station ? state.scene.room.walls[station.index] : undefined;
      if (!station || !wall) return false;

      const size = OPENING_DEFAULTS[type];
      if (size.width > station.wallLength) return false;
      if (size.sillHeight + size.height > wall.height) return false;

      // Centre it on the click, then pull it back inside the wall.
      const offset = Math.min(
        Math.max(station.offset - size.width / 2, 0),
        station.wallLength - size.width,
      );

      const opening: Opening = { id: crypto.randomUUID(), type, offset, ...size };
      state.execute(addOpening(station.index, opening));
      // Select it so the sliders act on what was just placed.
      set({
        pendingOpening: null,
        selectedOpening: { wallIndex: station.index, id: opening.id },
      });
      return true;
    },

    deleteOpening: (wallIndex, openingId) => {
      const state = get();
      const wall = state.scene.room.walls[wallIndex];
      if (!wall) return;
      const position = wall.openings.findIndex((o) => o.id === openingId);
      const opening = wall.openings[position];
      if (!opening) return;
      state.execute(removeOpening(wallIndex, opening, position));
      if (state.selectedOpening?.id === openingId) set({ selectedOpening: null });
    },

    selectedOpening: null,

    selectOpening: (selectedOpening) => set({ selectedOpening }),

    updateSelectedOpening: (patch) => {
      const state = get();
      const reference = state.selectedOpening;
      if (!reference) return;

      const wall = state.scene.room.walls[reference.wallIndex];
      const opening = wall?.openings.find((o) => o.id === reference.id);
      if (!wall || !opening) return;

      const next = clampOpening(
        { ...opening, ...patch },
        distance(wall.start, wall.end),
        wall.height,
      );
      if (sameOpening(opening, next)) return;

      // Key by field so dragging one slider merges but switching does not.
      const field = Object.keys(patch)[0] ?? "size";
      state.execute(updateOpening(reference.wallIndex, opening, next, field));
    },

    addDraftPoint: (point) => set((state) => ({ draft: [...state.draft, point] })),

    setCursor: (cursor) => set({ cursor }),

    cancelDraft: () => set({ draft: [], cursor: null }),

    closeDraft: () => {
      const state = get();
      if (state.draft.length < 3 || selfIntersects(state.draft)) return false;
      state.execute(closeRoom(state.draft, currentWallSettings(state)));
      set({ draft: [], cursor: null, mode: "edit" });
      return true;
    },

    beginDrag: (index) => {
      const position = get().scene.room.polygon[index];
      if (!position) return;
      set({ dragging: { index, position } });
    },

    updateDrag: (position) =>
      set((state) =>
        state.dragging ? { dragging: { ...state.dragging, position } } : state,
      ),

    endDrag: () => {
      const state = get();
      const drag = state.dragging;
      if (!drag) return;
      const from = state.scene.room.polygon[drag.index];
      set({ dragging: null });
      // One history entry per gesture, and nothing at all if it didn't move.
      if (!from || (from.x === drag.position.x && from.z === drag.position.z)) return;
      state.execute(moveVertex(drag.index, from, drag.position));
    },

    applyWallSettings: (partial) => {
      const state = get();
      const prev = currentWallSettings(state);
      const next = { ...prev, ...partial };
      if (prev.height === next.height && prev.thickness === next.thickness) return;
      if (state.scene.room.walls.length === 0) {
        set({ wallDefaults: next });
        return;
      }
      state.execute(setWallSettings(prev, next));
    },

    selectedId: null,

    selectPlacement: (selectedId) => set({ selectedId }),

    placeFurniture: (catalogItemId) => {
      const state = get();
      const item = findCatalogItem(catalogItemId);
      if (!item) return;

      // Drop it at the room's centre; there is no pointer position yet.
      const centre = bounds(state.scene.room.polygon).center;
      const placement: Placement = {
        id: crypto.randomUUID(),
        catalogItemId,
        position: { x: centre.x, y: 0, z: centre.z },
        rotationY: 0,
        locked: false,
      };
      state.execute(addPlacement(placement, item.name));
      set({ selectedId: placement.id });
    },

    deleteSelected: () => {
      const state = get();
      const index = state.scene.placements.findIndex((p) => p.id === state.selectedId);
      const placement = state.scene.placements[index];
      if (!placement || placement.locked) return;

      const item = findCatalogItem(placement.catalogItemId);
      state.execute(removePlacement(placement, index, item?.name ?? "furniture"));
      set({ selectedId: null });
    },

    rotateSelected: (radians) => {
      const state = get();
      const placement = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!placement || placement.locked) return;
      state.execute(
        rotatePlacement(placement.id, placement.rotationY, placement.rotationY + radians),
      );
    },

    placementDrag: null,

    beginPlacementDrag: (id, pointer) => {
      const placement = get().scene.placements.find((p) => p.id === id);
      if (!placement || placement.locked) return;
      // Grab offset, so the piece doesn't jump its centre to the pointer.
      set({
        placementDrag: {
          id,
          offset: {
            x: placement.position.x - pointer.x,
            z: placement.position.z - pointer.z,
          },
          position: placement.position,
        },
      });
    },

    updatePlacementDrag: (pointer) =>
      set((state) => {
        const drag = state.placementDrag;
        if (!drag) return state;
        const snapped = snapPoint(
          { x: pointer.x + drag.offset.x, z: pointer.z + drag.offset.z },
          state.snap.grid,
        );
        return {
          placementDrag: {
            ...drag,
            position: { x: snapped.x, y: 0, z: snapped.z },
          },
        };
      }),

    endPlacementDrag: () => {
      const state = get();
      const drag = state.placementDrag;
      if (!drag) return;
      const from = state.scene.placements.find((p) => p.id === drag.id)?.position;
      set({ placementDrag: null });
      // One entry per gesture, and nothing at all if it didn't move.
      if (!from || (from.x === drag.position.x && from.z === drag.position.z)) return;
      state.execute(movePlacement(drag.id, from, drag.position));
    },

    replaceScene: (next) => {
      const state = get();
      state.execute(loadScene(state.scene, next));
      // An in-progress draft or drag refers to the scene being replaced.
      set({
        draft: [],
        cursor: null,
        dragging: null,
        placementDrag: null,
        selectedId: null,
        pendingOpening: null,
        selectedOpening: null,
        mode: next.room.polygon.length >= 3 ? "edit" : "draw",
      });
    },

    ...initial,
  }));
}
