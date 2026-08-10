import { createStore, type StoreApi } from "zustand/vanilla";
import {
  emptyRoom,
  emptyScene,
  type Room,
  type Opening,
  type OpeningType,
  type Placement,
  type FurnitureFinish,
  type Scene,
  type Vec2,
  type Vec3,
} from "@layra/types";
import { bounds, distance, nearestWallStation, rectCorners, selfIntersects } from "@layra/geometry";
import { findCatalogItem } from "./catalog";
import {
  addOpening,
  addPlacement,
  addRoom,
  duplicateRoom,
  addVertex,
  closeRoom,
  closeWall,
  loadScene,
  moveVertex,
  moveRoom,
  rotateRoom,
  removeOpening,
  removePlacement,
  removePlacements,
  removeRoom,
  reorderRooms,
  removeVertex,
  renameRoom,
  rotatePlacement,
  setFloorMaterial,
  setPlacementLock,
  setPlacementFinish,
  setPlacementFinishes,
  setPlacementRotation,
  setRoomLock,
  setWallSettings,
  transformPlacement,
  transformPlacements,
  updateOpening,
  wallSettingsOf,
  type Command,
  type WallSettings,
} from "./commands";
import { snapPoint, snapToGrid } from "./snap";
import { clampOpening, sameOpening } from "./openings";
import { mountToWall, snapFloorToWall } from "./mounting";
import {
  placementFitsRoomAndFurniture,
  placementRect,
  placementsFitRoomAndFurniture,
  placementsInRoom,
} from "./collision";

export type { FurnitureFinish } from "@layra/types";

export type Mode = "draw" | "wall" | "edit" | "measure";

export type FurnitureAlignment =
  | "left"
  | "center-x"
  | "right"
  | "front"
  | "center-z"
  | "back";

export type FurnitureDistribution = "x" | "z";

export type LightingPreset = "daylight" | "warm" | "studio";

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
  walking: boolean;

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
  setWalking: (walking: boolean) => void;
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
  showOtherRooms: boolean;
  toggleOtherRooms: () => void;
  hiddenRoomIds: Set<string>;
  toggleRoomVisibility: (id: string) => void;
  addRoom: () => void;
  duplicateRoom: () => void;
  moveActiveRoom: (dx: number, dz: number) => void;
  rotateActiveRoom: (radians: number) => void;
  deleteRoom: (index: number) => void;
  toggleRoomLock: () => void;
  reorderRooms: (from: number, to: number) => void;
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
  lightingPreset: LightingPreset;
  setLightingPreset: (preset: LightingPreset) => void;

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
  selectedIds: Set<string>;
  selectPlacement: (id: string | null, additive?: boolean) => void;
  placeFurniture: (catalogItemId: string) => void;
  deleteSelected: () => void;
  rotateSelected: (radians: number) => void;
  setSelectedRotation: (radians: number) => void;
  setSelectedFinish: (finish: FurnitureFinish) => void;
  alignSelected: (alignment: FurnitureAlignment) => void;
  distributeSelected: (axis: FurnitureDistribution) => void;
  toggleSelectedLock: () => void;

  /** Transient, like `dragging`, so history gets one entry per gesture. */
  placementDrag: {
    id: string;
    offset: Vec2;
    position: Vec3;
    group: { id: string; position: Vec3; rotationY: number }[];
    /** Set while sliding a wall-mounted piece onto a differently angled wall. */
    rotationY?: number;
  } | null;
  roomDrag: { from: Vec2; delta: Vec2 } | null;
  beginRoomDrag: (pointer: Vec2) => void;
  updateRoomDrag: (pointer: Vec2) => void;
  endRoomDrag: () => void;
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
  const { polygon } = liveRoom(state);
  const drag = state.dragging;
  if (!drag) return polygon;
  return polygon.map((p, i) => (i === drag.index ? drag.position : p));
}

export function liveRoom(state: EditorState): Room {
  const room = activeRoom(state);
  const drag = state.roomDrag;
  if (!drag) return room;
  const move = (point: Vec2): Vec2 => ({
    x: point.x + drag.delta.x,
    z: point.z + drag.delta.z,
  });
  return {
    ...room,
    polygon: room.polygon.map(move),
    walls: room.walls.map((wall) => ({ ...wall, start: move(wall.start), end: move(wall.end) })),
  };
}

/** The room currently being edited. Never undefined: a scene always has one. */
export function activeRoom(state: EditorState): Room {
  return state.scene.rooms[state.activeRoomIndex] ?? state.scene.rooms[0]!;
}

export function activeRoomLocked(state: EditorState): boolean {
  return activeRoom(state).locked === true;
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
  const roomDrag = state.roomDrag;
  if (!drag && !roomDrag) return state.scene.placements;
  const moved = roomDrag
    ? new Set(placementsInRoom(activeRoom(state), state.scene.placements).map((p) => p.id))
    : null;
  return state.scene.placements.map((p) => {
    const roomPosition = moved?.has(p.id)
      ? {
          ...p.position,
          x: p.position.x + roomDrag!.delta.x,
          z: p.position.z + roomDrag!.delta.z,
        }
      : p.position;
    const groupPosition = drag?.group.find((entry) => entry.id === p.id);
    if (groupPosition) {
      return {
        ...p,
        position: groupPosition.position,
        rotationY: groupPosition.rotationY,
      };
    }
    if (p.id !== drag?.id) return roomPosition === p.position ? p : { ...p, position: roomPosition };
    return {
      ...p,
      position: drag.position,
      rotationY: drag.rotationY ?? p.rotationY,
    };
  });
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
    walking: false,
    draft: [],
    cursor: null,
    dragging: null,
    roomDrag: null,
    wallDefaults: DEFAULT_WALLS,
    snap: DEFAULT_SNAP,

    setSnap: (next) => set((state) => ({ snap: { ...state.snap, ...next } })),

    showOtherRooms: true,
    toggleOtherRooms: () => set((state) => ({ showOtherRooms: !state.showOtherRooms })),
    hiddenRoomIds: new Set(),
    toggleRoomVisibility: (id) =>
      set((state) => {
        const hiddenRoomIds = new Set(state.hiddenRoomIds);
        if (hiddenRoomIds.has(id)) hiddenRoomIds.delete(id);
        else hiddenRoomIds.add(id);
        return { hiddenRoomIds };
      }),

    nudgeSelected: (dx, dz, multiplier = 1) => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const selected = state.scene.placements.filter((placement) =>
        (state.selectedIds.size > 0
          ? state.selectedIds.has(placement.id)
          : placement.id === state.selectedId) && !placement.locked,
      );
      if (selected.length === 0) return;

      const step = state.snap.grid * multiplier;
      const changes = selected.map((placement) => ({
        id: placement.id,
        from: { position: placement.position, rotationY: placement.rotationY },
        to: {
          position: {
            x: snapToGrid(placement.position.x + dx * step, state.snap.grid),
            y: placement.position.y,
            z: snapToGrid(placement.position.z + dz * step, state.snap.grid),
          },
          rotationY: placement.rotationY,
        },
      }));
      const nextPlacements = state.scene.placements.map((placement) => {
        const change = changes.find((entry) => entry.id === placement.id);
        return change ? { ...placement, ...change.to } : placement;
      });
      if (!placementsFitRoomAndFurniture(activeRoom(state), nextPlacements)) return;

      state.execute({
        ...transformPlacements(changes),
        label: "Nudge furniture",
        // Repeated taps collapse, so holding an arrow key is one undo.
        mergeKey: `nudge-${changes.map((change) => change.id).join("-")}`,
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
        walking: false,
        draft: [],
        cursor: null,
        dragging: null,
        roomDrag: null,
        measure: { from: null, to: null },
      }),

    setWalking: (walking) => set({ walking }),

    measure: { from: null, to: null },
    showDimensions: true,
    lightingPreset: "daylight",
    setLightingPreset: (lightingPreset) => set({ lightingPreset }),
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
      if (activeRoomLocked(state)) return false;
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
      if (activeRoomLocked(state)) return;
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
      if (activeRoomLocked(state)) return;
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
        if (activeRoomLocked(state)) return state;
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
      if (activeRoomLocked(state)) return;
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

    addDraftPoint: (point) =>
      set((state) => (activeRoomLocked(state) ? state : { draft: [...state.draft, point] })),

    setCursor: (cursor) => set({ cursor }),

    cancelDraft: () => set({ draft: [], cursor: null }),

    closeDraft: () => {
      const state = get();
      if (activeRoomLocked(state)) return false;
      if (state.mode === "wall") {
        if (state.draft.length !== 2 || distance(state.draft[0]!, state.draft[1]!) < state.snap.grid) {
          return false;
        }
        if (activeRoom(state).polygon.length >= 3) return false;
        state.execute(closeWall(
          state.activeRoomIndex,
          state.draft[0]!,
          state.draft[1]!,
          currentWallSettings(state),
          activeRoom(state),
        ));
        set({ draft: [], cursor: null, mode: "edit" });
        return true;
      }
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
      if (activeRoomLocked(state)) return false;
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
      if (activeRoomLocked(state)) return false;
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
      const state = get();
      if (state.pendingFurniture || activeRoomLocked(state)) return;
      const position = activeRoom(state).polygon[index];
      if (!position) return;
      set({ dragging: { index, position } });
    },

    beginRoomDrag: (pointer) => {
      const state = get();
      if (state.mode !== "edit" || state.pendingFurniture || state.pendingOpening) return;
      if (activeRoom(state).polygon.length < 3) return;
      set({ roomDrag: { from: pointer, delta: { x: 0, z: 0 } } });
    },

    updateRoomDrag: (pointer) => {
      const state = get();
      const drag = state.roomDrag;
      if (!drag) return;
      set({
        roomDrag: {
          ...drag,
          delta: {
            x: snapToGrid(pointer.x - drag.from.x, state.snap.grid),
            z: snapToGrid(pointer.z - drag.from.z, state.snap.grid),
          },
        },
      });
    },

    endRoomDrag: () => {
      const state = get();
      const drag = state.roomDrag;
      if (!drag) return;
      set({ roomDrag: null });
      if (drag.delta.x === 0 && drag.delta.z === 0) return;
      const room = activeRoom(state);
      const contents = placementsInRoom(room, state.scene.placements);
      state.execute(
        moveRoom(
          state.activeRoomIndex,
          room,
          contents,
          drag.delta.x,
          drag.delta.z,
        ),
      );
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
      const nextRoom = state.scene.rooms[index]!;
      set({
        activeRoomIndex: index,
        view: nextRoom.polygon.length >= 3
          ? { kind: "fit", nonce: (state.view?.nonce ?? 0) + 1 }
          : state.view,
        // Selections and drafts belong to the room being left.
        draft: [],
        cursor: null,
        dragging: null,
        roomDrag: null,
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
        roomDrag: null,
        selectedId: null,
        selectedIds: new Set(),
        selectedVertex: null,
        selectedOpening: null,
        pendingOpening: null,
        pendingFurniture: null,
        furnitureGhost: null,
      });
    },

    duplicateRoom: () => {
      const state = get();
      const room = activeRoom(state);
      const sourceIndex = state.activeRoomIndex;
      const offset = Math.max(bounds(room.polygon).size.x + 1.5, 3);
      const shift = (point: Vec2): Vec2 => ({ x: point.x + offset, z: point.z });
      const copy: Room = {
        ...room,
        id: crypto.randomUUID(),
        name: `${room.name} copy`,
        polygon: room.polygon.map(shift),
        walls: room.walls.map((wall) => ({
          ...wall,
          id: crypto.randomUUID(),
          start: shift(wall.start),
          end: shift(wall.end),
          openings: wall.openings.map((opening) => ({ ...opening, id: crypto.randomUUID() })),
        })),
      };
      const sourceContents = placementsInRoom(room, state.scene.placements);
      const copyContents = sourceContents.map((placement) => ({
        ...placement,
        id: crypto.randomUUID(),
        position: { ...placement.position, x: placement.position.x + offset },
      }));

      state.execute(duplicateRoom(sourceIndex, room, copy, copyContents));
      set({
        activeRoomIndex: sourceIndex + 1,
        mode: copy.polygon.length >= 3 ? "edit" : "draw",
        draft: [],
        cursor: null,
        selectedId: null,
        selectedIds: new Set(),
        selectedVertex: null,
        selectedOpening: null,
        pendingOpening: null,
        pendingFurniture: null,
        furnitureGhost: null,
      });
    },

    moveActiveRoom: (dx, dz) => {
      if (dx === 0 && dz === 0) return;
      const state = get();
      if (activeRoomLocked(state)) return;
      const room = activeRoom(state);
      const contents = placementsInRoom(room, state.scene.placements);
      state.execute(moveRoom(state.activeRoomIndex, room, contents, dx, dz));
    },

    rotateActiveRoom: (radians) => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const room = activeRoom(state);
      if (room.polygon.length < 3 || radians === 0) return;
      const contents = placementsInRoom(room, state.scene.placements);
      state.execute(
        rotateRoom(
          state.activeRoomIndex,
          room,
          contents,
          bounds(room.polygon).center,
          radians,
        ),
      );
    },

    deleteRoom: (index) => {
      const state = get();
      const room = state.scene.rooms[index];
      // A scene always keeps at least one room.
      if (!room || room.locked || state.scene.rooms.length <= 1) return;

      const contents = placementsInRoom(room, state.scene.placements);
      state.execute(removeRoom(index, room, contents));
      const nextIndex = Math.max(0, Math.min(state.activeRoomIndex, state.scene.rooms.length - 2));
      set({
        activeRoomIndex: nextIndex,
        selectedVertex: null,
        selectedOpening: null,
        selectedId: null,
        selectedIds: new Set(),
        roomDrag: null,
        draft: [],
        cursor: null,
      });
    },

    reorderRooms: (from, to) => {
      const state = get();
      if (
        from < 0 ||
        to < 0 ||
        from >= state.scene.rooms.length ||
        to >= state.scene.rooms.length ||
        from === to
      ) {
        return;
      }
      state.execute(reorderRooms(from, to, state.scene.rooms));
      let activeRoomIndex = state.activeRoomIndex;
      if (activeRoomIndex === from) activeRoomIndex = to;
      else if (from < activeRoomIndex && to >= activeRoomIndex) activeRoomIndex -= 1;
      else if (from > activeRoomIndex && to <= activeRoomIndex) activeRoomIndex += 1;
      set({ activeRoomIndex });
    },

    renameRoom: (index, name) => {
      const state = get();
      const room = state.scene.rooms[index];
      if (!room || room.locked || room.name === name) return;
      state.execute(renameRoom(index, room.name, name));
    },

    toggleRoomLock: () => {
      const state = get();
      const room = activeRoom(state);
      state.execute(
        setRoomLock(state.activeRoomIndex, room.locked === true, room.locked !== true),
      );
    },

    applyFloorMaterial: (id) => {
      const state = get();
      if (activeRoomLocked(state)) return;
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
      if (activeRoomLocked(state)) return;
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
    selectedIds: new Set(),
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
      if (activeRoomLocked(state)) return false;
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
      if (!placementFitsRoomAndFurniture(activeRoom(state), placement, state.scene.placements)) return false;
      state.execute(addPlacement(placement, item.name));
      set({
        pendingFurniture: null,
        furnitureGhost: null,
        selectedId: placement.id,
        selectedIds: new Set([placement.id]),
      });
      return true;
    },

    duplicateSelected: () => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const source = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!source) return;
      const item = findCatalogItem(source.catalogItemId);
      if (!item) return;

      const spacing = 0.2;
      const offsets = [
        { x: item.footprint.w + spacing, z: 0 },
        { x: -(item.footprint.w + spacing), z: 0 },
        { x: 0, z: item.footprint.d + spacing },
        { x: 0, z: -(item.footprint.d + spacing) },
      ];
      const copy = offsets
        .map((offset) => ({
          ...source,
          id: crypto.randomUUID(),
          locked: false,
          position: {
            x: source.position.x + offset.x,
            y: source.position.y,
            z: source.position.z + offset.z,
          },
        }))
        .find((candidate) =>
          placementFitsRoomAndFurniture(
            activeRoom(state),
            candidate,
            state.scene.placements,
          ),
        );
      if (!copy) return;
      state.execute(addPlacement(copy, item.name));
      set({ selectedId: copy.id, selectedIds: new Set([copy.id]) });
    },

    selectPlacement: (selectedId, additive = false) =>
      set((state) => {
        if (!selectedId) return { selectedId: null, selectedIds: new Set<string>() };
        if (!additive) return { selectedId, selectedIds: new Set([selectedId]) };
        const selectedIds = new Set(state.selectedIds);
        if (selectedIds.has(selectedId)) selectedIds.delete(selectedId);
        else selectedIds.add(selectedId);
        return {
          selectedId: [...selectedIds].at(-1) ?? null,
          selectedIds,
        };
      }),

    placeFurniture: (catalogItemId) => {
      const state = get();
      if (activeRoomLocked(state)) return;
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
      if (!placementFitsRoomAndFurniture(activeRoom(state), placement, state.scene.placements)) return;
      state.execute(addPlacement(placement, item.name));
      set({ selectedId: placement.id, selectedIds: new Set([placement.id]) });
    },

    deleteSelected: () => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const selected = state.scene.placements.filter((placement) =>
        state.selectedIds.has(placement.id),
      );
      if (selected.length > 1) {
        const entries = selected
          .map((placement) => ({
            placement,
            index: state.scene.placements.indexOf(placement),
          }))
          .filter(({ placement }) => !placement.locked);
        if (entries.length === 0) return;
        state.execute(removePlacements(entries));
        set({ selectedId: null, selectedIds: new Set() });
        return;
      }
      const index = state.scene.placements.findIndex((p) => p.id === state.selectedId);
      const placement = state.scene.placements[index];
      if (!placement || placement.locked) return;

      const item = findCatalogItem(placement.catalogItemId);
      state.execute(removePlacement(placement, index, item?.name ?? "furniture"));
      set({ selectedId: null, selectedIds: new Set() });
    },

    setSelectedRotation: (radians) => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const placement = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!placement || placement.locked) return;
      if (placement.rotationY === radians) return;
      const candidate: Placement = { ...placement, rotationY: radians };
      if (!placementFitsRoomAndFurniture(activeRoom(state), candidate, state.scene.placements)) return;
      state.execute(
        setPlacementRotation(placement.id, placement.rotationY, radians),
      );
    },

    setSelectedFinish: (finish) => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const selected = state.scene.placements.filter((placement) =>
        (state.selectedIds.size > 1
          ? state.selectedIds.has(placement.id)
          : placement.id === state.selectedId) && !placement.locked,
      );
      const changes = selected
        .filter((placement) => placement.finish !== finish)
        .map((placement) => ({
          id: placement.id,
          from: placement.finish,
          to: finish,
        }));
      if (changes.length === 0) return;
      if (changes.length === 1) {
        const change = changes[0]!;
        state.execute(setPlacementFinish(change.id, change.from, change.to));
        return;
      }
      state.execute(setPlacementFinishes(changes));
    },

    alignSelected: (alignment) => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const selected = state.scene.placements.filter((placement) =>
        state.selectedIds.has(placement.id) && !placement.locked,
      );
      if (selected.length < 2) return;

      const boxes = selected.map((placement) => {
        const rect = placementRect(placement);
        const corners = rect ? rectCorners(rect) : [];
        return {
          placement,
          minX: Math.min(...corners.map((corner) => corner.x)),
          maxX: Math.max(...corners.map((corner) => corner.x)),
          minZ: Math.min(...corners.map((corner) => corner.z)),
          maxZ: Math.max(...corners.map((corner) => corner.z)),
        };
      });
      if (boxes.some((box) => !Number.isFinite(box.minX))) return;

      const target =
        alignment === "left"
          ? Math.min(...boxes.map((box) => box.minX))
          : alignment === "right"
            ? Math.max(...boxes.map((box) => box.maxX))
            : alignment === "front"
              ? Math.min(...boxes.map((box) => box.minZ))
              : alignment === "back"
                ? Math.max(...boxes.map((box) => box.maxZ))
                : alignment === "center-x"
                  ? (Math.min(...boxes.map((box) => box.minX)) +
                      Math.max(...boxes.map((box) => box.maxX))) /
                    2
                  : (Math.min(...boxes.map((box) => box.minZ)) +
                      Math.max(...boxes.map((box) => box.maxZ))) /
                    2;

      const changes = boxes.map((box) => {
        const current =
          alignment === "left" || alignment === "right"
            ? (box.minX + box.maxX) / 2
            : (box.minZ + box.maxZ) / 2;
        const desired =
          alignment === "left"
            ? target + (box.maxX - box.minX) / 2
            : alignment === "right"
              ? target - (box.maxX - box.minX) / 2
              : alignment === "front"
                ? target + (box.maxZ - box.minZ) / 2
                : alignment === "back"
                  ? target - (box.maxZ - box.minZ) / 2
                  : target;
        const delta = desired - current;
        return {
          id: box.placement.id,
          from: { position: box.placement.position, rotationY: box.placement.rotationY },
          to: {
            position: {
              ...box.placement.position,
              x:
                alignment === "left" || alignment === "center-x" || alignment === "right"
                  ? box.placement.position.x + delta
                  : box.placement.position.x,
              z:
                alignment === "front" || alignment === "center-z" || alignment === "back"
                  ? box.placement.position.z + delta
                  : box.placement.position.z,
            },
            rotationY: box.placement.rotationY,
          },
        };
      });
      const nextPlacements = state.scene.placements.map((placement) => {
        const change = changes.find((entry) => entry.id === placement.id);
        return change ? { ...placement, ...change.to } : placement;
      });
      if (!placementsFitRoomAndFurniture(activeRoom(state), nextPlacements)) return;
      state.execute(transformPlacements(changes));
    },

    distributeSelected: (axis) => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const selected = state.scene.placements.filter((placement) =>
        state.selectedIds.has(placement.id) && !placement.locked,
      );
      if (selected.length < 3) return;

      const ordered = [...selected].sort((a, b) =>
        axis === "x"
          ? a.position.x - b.position.x
          : a.position.z - b.position.z,
      );
      const first = ordered[0]!;
      const last = ordered.at(-1)!;
      const start = axis === "x" ? first.position.x : first.position.z;
      const end = axis === "x" ? last.position.x : last.position.z;
      const step = (end - start) / (ordered.length - 1);
      const changes = ordered.map((placement, index) => ({
        id: placement.id,
        from: { position: placement.position, rotationY: placement.rotationY },
        to: {
          position: {
            ...placement.position,
            ...(axis === "x"
              ? { x: start + step * index }
              : { z: start + step * index }),
          },
          rotationY: placement.rotationY,
        },
      }));
      const nextPlacements = state.scene.placements.map((placement) => {
        const change = changes.find((entry) => entry.id === placement.id);
        return change ? { ...placement, ...change.to } : placement;
      });
      if (!placementsFitRoomAndFurniture(activeRoom(state), nextPlacements)) return;
      state.execute(transformPlacements(changes));
    },

    toggleSelectedLock: () => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const placement = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!placement) return;
      state.execute(setPlacementLock(placement.id, !placement.locked));
    },

    rotateSelected: (radians) => {
      const state = get();
      if (activeRoomLocked(state)) return;
      const placement = state.scene.placements.find((p) => p.id === state.selectedId);
      if (!placement || placement.locked) return;

      const selected = state.scene.placements.filter((candidate) =>
        state.selectedIds.size > 1 &&
        state.selectedIds.has(candidate.id) &&
        !candidate.locked,
      );
      if (selected.length > 1) {
        const centre = selected.reduce(
          (sum, candidate) => ({
            x: sum.x + candidate.position.x / selected.length,
            z: sum.z + candidate.position.z / selected.length,
          }),
          { x: 0, z: 0 },
        );
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        const changes = selected.map((candidate) => {
          const dx = candidate.position.x - centre.x;
          const dz = candidate.position.z - centre.z;
          return {
            id: candidate.id,
            from: { position: candidate.position, rotationY: candidate.rotationY },
            to: {
              position: {
                ...candidate.position,
                x: centre.x + dx * cosine - dz * sine,
                z: centre.z + dx * sine + dz * cosine,
              },
              rotationY: candidate.rotationY + radians,
            },
          };
        });
        const nextPlacements = state.scene.placements.map((candidate) => {
          const change = changes.find((entry) => entry.id === candidate.id);
          return change ? { ...candidate, ...change.to } : candidate;
        });
        if (!placementsFitRoomAndFurniture(activeRoom(state), nextPlacements)) return;
        state.execute(transformPlacements(changes));
        return;
      }

      const nextRotation = placement.rotationY + radians;
      const candidate: Placement = { ...placement, rotationY: nextRotation };
      if (!placementFitsRoomAndFurniture(activeRoom(state), candidate, state.scene.placements)) return;
      state.execute(
        rotatePlacement(placement.id, placement.rotationY, nextRotation),
      );
    },

    placementDrag: null,

    beginPlacementDrag: (id, pointer) => {
      const state = get();
      if (state.pendingFurniture || activeRoomLocked(state)) return;
      const placement = state.scene.placements.find((p) => p.id === id);
      if (!placement || placement.locked) return;
      const group = state.scene.placements
        .filter((candidate) =>
          (state.selectedIds.has(id)
            ? state.selectedIds.has(candidate.id)
            : candidate.id === id) &&
          !candidate.locked,
        )
        .map((candidate) => ({
          id: candidate.id,
          position: candidate.position,
          rotationY: candidate.rotationY,
        }));
      // Grab offset, so the piece doesn't jump its centre to the pointer.
      set({
        placementDrag: {
          id,
          offset: {
            x: placement.position.x - pointer.x,
            z: placement.position.z - pointer.z,
          },
          position: placement.position,
          group,
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
        if (!placement) return state;
        if (drag.group.length > 1) {
          const delta = {
            x: snapped.x - drag.group.find((entry) => entry.id === drag.id)!.position.x,
            z: snapped.z - drag.group.find((entry) => entry.id === drag.id)!.position.z,
          };
          const group = drag.group.map((entry) => ({
            ...entry,
            position: {
              ...entry.position,
              x: entry.position.x + delta.x,
              z: entry.position.z + delta.z,
            },
          }));
          const nextPlacements = state.scene.placements.map((candidate) => {
            const moved = group.find((entry) => entry.id === candidate.id);
            return moved ? { ...candidate, position: moved.position } : candidate;
          });
          if (!placementsFitRoomAndFurniture(activeRoom(state), nextPlacements)) return state;
          return {
            placementDrag: {
              ...drag,
              position: group.find((entry) => entry.id === drag.id)!.position,
              group,
            },
          };
        }
        if (item) {
          // Wall pieces always ride a wall; floor pieces only snap when near one.
          const mounted = item.wallMounted
            ? mountToWall(activeRoom(state), snapped, item)
            : freeform
              ? null
              : snapFloorToWall(activeRoom(state), snapped, item);
          if (mounted) {
            const candidate = {
              ...placement,
              position: mounted.position,
              rotationY: mounted.rotationY,
            };
            if (!placementFitsRoomAndFurniture(activeRoom(state), candidate, state.scene.placements)) return state;
            return {
              placementDrag: {
                ...drag,
                position: mounted.position,
                rotationY: mounted.rotationY,
                group: drag.group.map((entry) =>
                  entry.id === placement.id
                    ? { ...entry, position: mounted.position, rotationY: mounted.rotationY }
                    : entry,
                ),
              },
            };
          }
        }

        // Out in the room, or bypassed: keep whatever rotation it has.
        if (!placement) return state;
        const candidate: Placement = {
          ...placement,
          position: { x: snapped.x, y: 0, z: snapped.z },
          rotationY: placement.rotationY,
        };
        if (!placementFitsRoomAndFurniture(activeRoom(state), candidate, state.scene.placements)) return state;
        return {
          placementDrag: {
            ...drag,
            position: { x: snapped.x, y: 0, z: snapped.z },
            rotationY: placement?.rotationY,
            group: drag.group.map((entry) =>
              entry.id === placement.id
                ? { ...entry, position: { x: snapped.x, y: 0, z: snapped.z } }
                : entry,
            ),
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

      if (drag.group.length > 1) {
        const changes = drag.group.flatMap((entry) => {
          const current = state.scene.placements.find((p) => p.id === entry.id);
          if (!current) return [];
          const to = { position: entry.position, rotationY: entry.rotationY };
          if (
            current.position.x === to.position.x &&
            current.position.z === to.position.z &&
            current.rotationY === to.rotationY
          ) {
            return [];
          }
          return [{
            id: entry.id,
            from: { position: current.position, rotationY: current.rotationY },
            to,
          }];
        });
        if (changes.length > 0) state.execute(transformPlacements(changes));
        return;
      }

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
        roomDrag: null,
        placementDrag: null,
        openingDrag: null,
        selectedId: null,
        selectedIds: new Set(),
        selectedOpening: null,
        pendingOpening: null,
        measure: { from: null, to: null },
        activeRoomIndex: 0,
        hiddenRoomIds: new Set(),
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
        roomDrag: null,
        placementDrag: null,
        openingDrag: null,
        selectedId: null,
        selectedIds: new Set(),
        selectedVertex: null,
        pendingOpening: null,
        pendingFurniture: null,
        furnitureGhost: null,
        selectedOpening: null,
        activeRoomIndex: 0,
        hiddenRoomIds: new Set(),
        mode: (next.rooms[0]?.polygon.length ?? 0) >= 3 ? "edit" : "draw",
      });
    },

    ...initial,
  }));
}
