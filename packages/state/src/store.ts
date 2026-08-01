import { createStore, type StoreApi } from "zustand/vanilla";
import { emptyScene, type Placement, type Scene, type Vec2 } from "@layra/types";
import { bounds, selfIntersects } from "@layra/geometry";
import { findCatalogItem } from "./catalog";
import {
  addPlacement,
  closeRoom,
  loadScene,
  moveVertex,
  removePlacement,
  rotatePlacement,
  setWallSettings,
  wallSettingsOf,
  type Command,
  type WallSettings,
} from "./commands";

export type Mode = "draw" | "edit";

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

  /** Currently selected furniture, or null. */
  selectedId: string | null;
  selectPlacement: (id: string | null) => void;
  placeFurniture: (catalogItemId: string) => void;
  deleteSelected: () => void;
  rotateSelected: (radians: number) => void;
}

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
      set((state) => ({
        scene: command.do(state.scene),
        past: [...state.past, command],
        future: [],
      })),

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

    setMode: (mode) => set({ mode, draft: [], cursor: null, dragging: null }),

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

    replaceScene: (next) => {
      const state = get();
      state.execute(loadScene(state.scene, next));
      // An in-progress draft or drag refers to the scene being replaced.
      set({
        draft: [],
        cursor: null,
        dragging: null,
        selectedId: null,
        mode: next.room.polygon.length >= 3 ? "edit" : "draw",
      });
    },

    ...initial,
  }));
}
