import { createStore, type StoreApi } from "zustand/vanilla";
import {
  emptyRoom,
  emptyScene,
  type Room,
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
  addRoom,
  addVertex,
  closeRoom,
  loadScene,
  moveVertex,
  removeOpening,
  removePlacement,
  removeRoom,
  removeVertex,
  renameRoom,
  rotatePlacement,
  setFloorMaterial,
  setPlacementLock,
  setPlacementRotation,
  setWallSettings,
  transformPlacement,
  updateOpening,
  wallSettingsOf,
  type Command,
  type WallSettings,
} from "./commands";
import { snapPoint, snapToGrid } from "./snap";
import { clampOpening, sameOpening } from "./openings";
import { mountToWall, snapFloorToWall } from "./mounting";

export type Mode = "draw" | "edit" | "measure";

export type ViewKind = "top" | "iso" | "fit";

/** The nonce lets the same view be requested twice in a row. */
export interface ViewRequest {
  kind: ViewKind;
  nonce: number;
}

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
  /** Every room edit targets this one. */
  activeRoomIndex: number;
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
  /** Plain UI preference, so it stays out of history. */
  setSnap: (next: Partial<SnapSettings>) => void;

  /** Moves the selected piece by whole grid steps. */
  nudgeSelected: (dx: number, dz: number, multiplier?: number) => void;

  execute: (command: Command) => void;
  undo: () => void;
  redo: () => void;

  setMode: (mode: Mode) => void;
  addDraftPoint: (point: Vec2) => void;
  setCursor: (point: Vec2 | null) => void;
  cancelDraft: () => void;
  closeDraft: () => boolean;

  /** Corner selected for deletion, or null. */
  selectedVertex: number | null;
  selectVertex: (index: number | null) => void;
  addVertexAt: (point: Vec2) => boolean;
  deleteSelectedVertex: () => boolean;

  beginDrag: (index: number) => void;
  updateDrag: (position: Vec2) => void;
  endDrag: () => void;

  applyWallSettings: (next: Partial<WallSettings>) => void;
  applyFloorMaterial: (id: string) => void;

  setActiveRoom: (index: number) => void;
  addRoom: () => void;
  deleteRoom: (index: number) => void;
  renameRoom: (index: number, name: string) => void;
  /** Clears to an empty scene. Undoable, so it needs no confirmation. */
  newScene: () => void;
  replaceScene: (next: Scene) => void;
  /** Restores a scene without touching history, for autosave on startup. */
  resetScene: (next: Scene) => void;

  /** Two-point ruler. Null entries mean that end is not placed yet. */
  measure: { from: Vec2 | null; to: Vec2 | null };
  addMeasurePoint: (point: Vec2) => void;
  setMeasureCursor: (point: Vec2 | null) => void;
  clearMeasure: () => void;

  /** Latest camera request, consumed by the renderer. */
  view: ViewRequest | null;
  requestView: (kind: ViewKind) => void;

  /** Wall length labels. */
  showDimensions: boolean;
  toggleDimensions: () => void;

  /** Armed opening type; the next wall click places one. */
  pendingOpening: OpeningType | null;
  armOpening: (type: OpeningType | null) => void;
  placeOpeningAt: (point: Vec2) => boolean;
  deleteOpening: (wallIndex: number, openingId: string) => void;

  /** Transient, like the other drags, so one gesture is one history entry. */
  openingDrag: { wallIndex: number; id: string; offset: number; grab: number } | null;
  beginOpeningDrag: (wallIndex: number, id: string, pointer: Vec2) => void;
  updateOpeningDrag: (pointer: Vec2) => void;
  endOpeningDrag: () => void;

  selectedOpening: { wallIndex: number; id: string } | null;
  selectOpening: (ref: { wallIndex: number; id: string } | null) => void;
  updateSelectedOpening: (patch: Partial<OpeningShape>) => void;

  /** Armed catalog item; the next click in the room places it. */
  pendingFurniture: string | null;
  /** Ground point the ghost preview follows while armed. */
  furnitureGhost: Vec2 | null;
  armFurniture: (catalogItemId: string | null) => void;
  setFurnitureGhost: (point: Vec2 | null, freeform?: boolean) => void;
  /** True while the snap-bypass modifier is held. */
  freeformPlacement: boolean;
  placeFurnitureAt: (point: Vec2, freeform?: boolean) => boolean;
  duplicateSelected: () => void;

  /** Currently selected furniture, or null. */
  selectedId: string | null;
  selectPlacement: (id: string | null) => void;
  placeFurniture: (catalogItemId: string) => void;
  deleteSelected: () => void;
  rotateSelected: (radians: number) => void;
  setSelectedRotation: (radians: number) => void;
  toggleSelectedLock: () => void;

  /** Transient, like `dragging`, so history gets one entry per gesture. */
  placementDrag: {
    id: string;
    offset: Vec2;
    position: Vec3;
    /** Set while sliding a wall-mounted piece onto a differently angled wall. */
    rotationY?: number;
  } | null;
  beginPlacementDrag: (id: string, pointer: Vec2) => void;
  updatePlacementDrag: (pointer: Vec2, freeform?: boolean) => void;
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
  const { polygon } = activeRoom(state);
  const drag = state.dragging;
  if (!drag) return polygon;
  return polygon.map((p, i) => (i === drag.index ? drag.position : p));
}

/** The room currently being edited. Never undefined: a scene always has one. */
export function activeRoom(state: EditorState): Room {
  return state.scene.rooms[state.activeRoomIndex] ?? state.scene.rooms[0]!;
}

export function currentWallSettings(state: EditorState): WallSettings {
  return wallSettingsOf(state.scene, state.activeRoomIndex, state.wallDefaults);
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
    p.id === drag.id
      ? { ...p, position: drag.position, rotationY: drag.rotationY ?? p.rotationY }
      : p,
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
    activeRoomIndex: 0,
    past: [],
    future: [],
    mode: "draw",
    draft: [],
    cursor: null,
    dragging: null,
    wallDefaults: DEFAULT_WALLS,
    snap: DEFAULT_SNAP,

    setSnap: (next) => set((state) => ({ snap: { ...state.snap, ...next } })),

    nudgeSelected: (dx, dz, multiplier = 1) => {
      const state = get();
      const placement = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!placement || placement.locked) return;

      const step = state.snap.grid * multiplier;
      const to = {
        position: {
          x: snapToGrid(placement.position.x + dx * step, state.snap.grid),
          y: placement.position.y,
          z: snapToGrid(placement.position.z + dz * step, state.snap.grid),
        },
        rotationY: placement.rotationY,
      };

      state.execute({
        ...transformPlacement(
          placement.id,
          { position: placement.position, rotationY: placement.rotationY },
          to,
        ),
        label: "Nudge furniture",
        // Repeated taps collapse, so holding an arrow key is one undo.
        mergeKey: `nudge-${placement.id}`,
      });
    },

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
    view: null,

    requestView: (kind) =>
      set((state) => ({ view: { kind, nonce: (state.view?.nonce ?? 0) + 1 } })),

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

    armOpening: (pendingOpening) =>
      set({ pendingOpening, pendingFurniture: null, furnitureGhost: null }),

    placeOpeningAt: (point) => {
      const state = get();
      const type = state.pendingOpening;
      if (!type) return false;

      const station = nearestWallStation(activeRoom(state).polygon, point);
      const wall = station ? activeRoom(state).walls[station.index] : undefined;
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
      state.execute(addOpening(state.activeRoomIndex, station.index, opening));
      // Select it so the sliders act on what was just placed.
      set({
        pendingOpening: null,
        selectedOpening: { wallIndex: station.index, id: opening.id },
      });
      return true;
    },

    deleteOpening: (wallIndex, openingId) => {
      const state = get();
      const wall = activeRoom(state).walls[wallIndex];
      if (!wall) return;
      const position = wall.openings.findIndex((o) => o.id === openingId);
      const opening = wall.openings[position];
      if (!opening) return;
      state.execute(removeOpening(state.activeRoomIndex, wallIndex, opening, position));
      if (state.selectedOpening?.id === openingId) set({ selectedOpening: null });
    },

    selectedOpening: null,
    openingDrag: null,

    beginOpeningDrag: (wallIndex, id, pointer) => {
      const state = get();
      const wall = activeRoom(state).walls[wallIndex];
      const opening = wall?.openings.find((o) => o.id === id);
      if (!wall || !opening) return;

      const station = nearestWallStation(activeRoom(state).polygon, pointer);
      if (!station || station.index !== wallIndex) return;

      set({
        selectedOpening: { wallIndex, id },
        // Grab offset, so the opening does not jump its centre to the pointer.
        openingDrag: {
          wallIndex,
          id,
          offset: opening.offset,
          grab: opening.offset - station.offset,
        },
      });
    },

    updateOpeningDrag: (pointer) =>
      set((state) => {
        const drag = state.openingDrag;
        if (!drag) return state;

        const wall = activeRoom(state).walls[drag.wallIndex];
        const opening = wall?.openings.find((o) => o.id === drag.id);
        const station = nearestWallStation(activeRoom(state).polygon, pointer);
        if (!wall || !opening || !station) return state;

        // Project onto the opening's own wall, so it never jumps to another.
        const length = distance(wall.start, wall.end);
        const raw =
          station.index === drag.wallIndex
            ? station.offset + drag.grab
            : drag.offset;
        const snapped = snapToGrid(raw, state.snap.grid);

        return {
          openingDrag: {
            ...drag,
            offset: Math.min(Math.max(snapped, 0), Math.max(length - opening.width, 0)),
          },
        };
      }),

    endOpeningDrag: () => {
      const state = get();
      const drag = state.openingDrag;
      set({ openingDrag: null });
      if (!drag) return;

      const wall = activeRoom(state).walls[drag.wallIndex];
      const opening = wall?.openings.find((o) => o.id === drag.id);
      if (!opening || opening.offset === drag.offset) return;

      state.execute(
        updateOpening(
          state.activeRoomIndex,
          drag.wallIndex,
          opening,
          { ...opening, offset: drag.offset },
          "offset",
        ),
      );
    },

    selectOpening: (selectedOpening) => set({ selectedOpening }),

    updateSelectedOpening: (patch) => {
      const state = get();
      const reference = state.selectedOpening;
      if (!reference) return;

      const wall = activeRoom(state).walls[reference.wallIndex];
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
      state.execute(updateOpening(state.activeRoomIndex, reference.wallIndex, opening, next, field));
    },

    addDraftPoint: (point) => set((state) => ({ draft: [...state.draft, point] })),

    setCursor: (cursor) => set({ cursor }),

    cancelDraft: () => set({ draft: [], cursor: null }),

    closeDraft: () => {
      const state = get();
      if (state.draft.length < 3 || selfIntersects(state.draft)) return false;
      state.execute(closeRoom(
          state.activeRoomIndex,
          state.draft,
          currentWallSettings(state),
          activeRoom(state),
        ));
      set({ draft: [], cursor: null, mode: "edit" });
      return true;
    },

    selectedVertex: null,

    selectVertex: (selectedVertex) => set({ selectedVertex }),

    addVertexAt: (point) => {
      const state = get();
      const { polygon, walls } = activeRoom(state);
      const station = nearestWallStation(polygon, point);
      if (!station) return false;

      const snapped = snapPoint(point, state.snap.grid);
      // Refuse a corner on top of an existing one; it would make a zero-length
      // wall, which offsetting cannot mitre.
      const tooClose = Math.min(station.offset, station.wallLength - station.offset);
      if (tooClose < state.snap.grid) return false;

      state.execute(
        addVertex(
          state.activeRoomIndex,
          station.index,
          snapped,
          station.offset,
          polygon,
          walls.map((wall) => wall.openings),
        ),
      );
      return true;
    },

    deleteSelectedVertex: () => {
      const state = get();
      const index = state.selectedVertex;
      const { polygon, walls } = activeRoom(state);
      if (index === null || index < 0 || index >= polygon.length) return false;
      // A room needs three corners.
      if (polygon.length <= 3) return false;

      state.execute(
        removeVertex(
          state.activeRoomIndex,
          index,
          polygon,
          walls.map((wall) => wall.openings),
        ),
      );
      set({ selectedVertex: null });
      return true;
    },

    beginDrag: (index) => {
      if (get().pendingFurniture) return;
      const position = activeRoom(get()).polygon[index];
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
      const from = activeRoom(state).polygon[drag.index];
      set({ dragging: null });
      // One history entry per gesture, and nothing at all if it didn't move.
      if (!from || (from.x === drag.position.x && from.z === drag.position.z)) return;
      state.execute(
        moveVertex(
          state.activeRoomIndex,
          drag.index,
          from,
          drag.position,
          activeRoom(state).walls.map((wall) => wall.openings),
        ),
      );
    },

    setActiveRoom: (index) => {
      const state = get();
      if (index < 0 || index >= state.scene.rooms.length) return;
      set({
        activeRoomIndex: index,
        // Selections and drafts belong to the room being left.
        draft: [],
        cursor: null,
        dragging: null,
        selectedVertex: null,
        selectedOpening: null,
        pendingOpening: null,
        pendingFurniture: null,
        furnitureGhost: null,
        mode: state.scene.rooms[index]!.polygon.length >= 3 ? "edit" : "draw",
      });
    },

    addRoom: () => {
      const state = get();
      const room = emptyRoom(
        crypto.randomUUID(),
        `Room ${state.scene.rooms.length + 1}`,
      );
      state.execute(addRoom(room));
      // A new room has no walls yet, so drop straight into drawing it. Armed
      // tools belong to the room being left, so clear them too.
      set({
        activeRoomIndex: state.scene.rooms.length,
        mode: "draw",
        draft: [],
        cursor: null,
        selectedId: null,
        selectedVertex: null,
        selectedOpening: null,
        pendingOpening: null,
        pendingFurniture: null,
        furnitureGhost: null,
      });
    },

    deleteRoom: (index) => {
      const state = get();
      const room = state.scene.rooms[index];
      // A scene always keeps at least one room.
      if (!room || state.scene.rooms.length <= 1) return;

      state.execute(removeRoom(index, room));
      const nextIndex = Math.max(0, Math.min(state.activeRoomIndex, state.scene.rooms.length - 2));
      set({
        activeRoomIndex: nextIndex,
        selectedVertex: null,
        selectedOpening: null,
        draft: [],
        cursor: null,
      });
    },

    renameRoom: (index, name) => {
      const state = get();
      const room = state.scene.rooms[index];
      if (!room || room.name === name) return;
      state.execute(renameRoom(index, room.name, name));
    },

    applyFloorMaterial: (id) => {
      const state = get();
      const current = activeRoom(state).floorMaterial;
      if (current === id) return;
      state.execute(setFloorMaterial(state.activeRoomIndex, current, id));
    },

    newScene: () => {
      const state = get();
      if (
        activeRoom(state).polygon.length === 0 &&
        state.scene.placements.length === 0
      ) {
        return;
      }
      state.replaceScene(emptyScene());
    },

    applyWallSettings: (partial) => {
      const state = get();
      const prev = currentWallSettings(state);
      const next = { ...prev, ...partial };
      if (prev.height === next.height && prev.thickness === next.thickness) return;
      if (activeRoom(state).walls.length === 0) {
        set({ wallDefaults: next });
        return;
      }
      state.execute(setWallSettings(state.activeRoomIndex, prev, next));
    },

    selectedId: null,
    pendingFurniture: null,
    furnitureGhost: null,

    // Arming one tool disarms the other, so a click is never ambiguous.
    armFurniture: (pendingFurniture) =>
      set({ pendingFurniture, pendingOpening: null, furnitureGhost: null }),

    freeformPlacement: false,

    setFurnitureGhost: (furnitureGhost, freeform = false) =>
      set({ furnitureGhost, freeformPlacement: freeform }),

    placeFurnitureAt: (point, freeform = false) => {
      const state = get();
      const catalogItemId = state.pendingFurniture;
      const item = catalogItemId ? findCatalogItem(catalogItemId) : undefined;
      if (!catalogItemId || !item) return false;

      const snapped = snapPoint(point, state.snap.grid);
      const mounted = item.wallMounted
        ? mountToWall(activeRoom(state), snapped, item)
        : freeform
          ? null
          : snapFloorToWall(activeRoom(state), snapped, item);
      const placement: Placement = {
        id: crypto.randomUUID(),
        catalogItemId,
        position: mounted?.position ?? { x: snapped.x, y: 0, z: snapped.z },
        rotationY: mounted?.rotationY ?? 0,
        locked: false,
      };
      state.execute(addPlacement(placement, item.name));
      set({
        pendingFurniture: null,
        furnitureGhost: null,
        selectedId: placement.id,
      });
      return true;
    },

    duplicateSelected: () => {
      const state = get();
      const source = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!source) return;
      const item = findCatalogItem(source.catalogItemId);
      if (!item) return;

      // Offset by half a footprint so the copy is visible, not hidden underneath.
      const copy: Placement = {
        ...source,
        id: crypto.randomUUID(),
        locked: false,
        position: {
          x: source.position.x + item.footprint.w / 2 + 0.2,
          y: 0,
          z: source.position.z,
        },
      };
      state.execute(addPlacement(copy, item.name));
      set({ selectedId: copy.id });
    },

    selectPlacement: (selectedId) => set({ selectedId }),

    placeFurniture: (catalogItemId) => {
      const state = get();
      const item = findCatalogItem(catalogItemId);
      if (!item) return;

      // Drop it at the room's centre; there is no pointer position yet.
      const centre = bounds(activeRoom(state).polygon).center;
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

    setSelectedRotation: (radians) => {
      const state = get();
      const placement = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!placement || placement.locked) return;
      if (placement.rotationY === radians) return;
      state.execute(
        setPlacementRotation(placement.id, placement.rotationY, radians),
      );
    },

    toggleSelectedLock: () => {
      const state = get();
      const placement = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!placement) return;
      state.execute(setPlacementLock(placement.id, !placement.locked));
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
      if (get().pendingFurniture) return;
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

    updatePlacementDrag: (pointer, freeform = false) =>
      set((state) => {
        const drag = state.placementDrag;
        if (!drag) return state;
        const snapped = snapPoint(
          { x: pointer.x + drag.offset.x, z: pointer.z + drag.offset.z },
          state.snap.grid,
        );

        const placement = state.scene.placements.find((p) => p.id === drag.id);
        const item = placement ? findCatalogItem(placement.catalogItemId) : undefined;
        if (item) {
          // Wall pieces always ride a wall; floor pieces only snap when near one.
          const mounted = item.wallMounted
            ? mountToWall(activeRoom(state), snapped, item)
            : freeform
              ? null
              : snapFloorToWall(activeRoom(state), snapped, item);
          if (mounted) {
            return {
              placementDrag: {
                ...drag,
                position: mounted.position,
                rotationY: mounted.rotationY,
              },
            };
          }
        }

        // Out in the room, or bypassed: keep whatever rotation it has.
        return {
          placementDrag: {
            ...drag,
            position: { x: snapped.x, y: 0, z: snapped.z },
            rotationY: placement?.rotationY,
          },
        };
      }),

    endPlacementDrag: () => {
      const state = get();
      const drag = state.placementDrag;
      if (!drag) return;
      const placement = state.scene.placements.find((p) => p.id === drag.id);
      set({ placementDrag: null });
      if (!placement) return;

      const to = {
        position: drag.position,
        rotationY: drag.rotationY ?? placement.rotationY,
      };
      // One entry per gesture, and nothing at all if it didn't move.
      if (
        placement.position.x === to.position.x &&
        placement.position.z === to.position.z &&
        placement.rotationY === to.rotationY
      ) {
        return;
      }
      state.execute(
        transformPlacement(
          drag.id,
          { position: placement.position, rotationY: placement.rotationY },
          to,
        ),
      );
    },

    resetScene: (next) =>
      set((state) => ({
        // Loading a scene should frame it, not leave it off screen.
        view: { kind: "fit", nonce: (state.view?.nonce ?? 0) + 1 },
        scene: next,
        past: [],
        future: [],
        draft: [],
        cursor: null,
        dragging: null,
        placementDrag: null,
        openingDrag: null,
        selectedId: null,
        selectedOpening: null,
        pendingOpening: null,
        measure: { from: null, to: null },
        activeRoomIndex: 0,
        mode: (next.rooms[0]?.polygon.length ?? 0) >= 3 ? "edit" : "draw",
      })),

    replaceScene: (next) => {
      const state = get();
      state.execute(loadScene(state.scene, next));
      // An in-progress draft or drag refers to the scene being replaced.
      set({
        draft: [],
        cursor: null,
        dragging: null,
        placementDrag: null,
        openingDrag: null,
        selectedId: null,
        selectedVertex: null,
        pendingOpening: null,
        pendingFurniture: null,
        furnitureGhost: null,
        selectedOpening: null,
        activeRoomIndex: 0,
        mode: (next.rooms[0]?.polygon.length ?? 0) >= 3 ? "edit" : "draw",
      });
    },

    ...initial,
  }));
}
