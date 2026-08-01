import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import {
  createEditorStore,
  currentWallSettings,
  historyLabels,
  livePolygon,
} from "./store";

const square: Vec2[] = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 3 },
  { x: 0, z: 3 },
];

function storeWithRoom() {
  const store = createEditorStore();
  for (const point of square) store.getState().addDraftPoint(point);
  store.getState().closeDraft();
  return store;
}

describe("draft lifecycle", () => {
  it("closes a valid draft into a room and switches to edit", () => {
    const store = storeWithRoom();
    const state = store.getState();
    expect(state.scene.room.walls).toHaveLength(4);
    expect(state.scene.room.polygon).toHaveLength(4);
    expect(state.draft).toEqual([]);
    expect(state.mode).toBe("edit");
  });

  it("refuses to close below three points", () => {
    const store = createEditorStore();
    store.getState().addDraftPoint({ x: 0, z: 0 });
    store.getState().addDraftPoint({ x: 1, z: 0 });
    expect(store.getState().closeDraft()).toBe(false);
    expect(store.getState().scene.room.walls).toHaveLength(0);
    expect(store.getState().past).toHaveLength(0);
  });

  it("refuses to close a self-intersecting draft", () => {
    const store = createEditorStore();
    for (const point of [
      { x: 0, z: 0 },
      { x: 2, z: 2 },
      { x: 2, z: 0 },
      { x: 0, z: 2 },
    ]) {
      store.getState().addDraftPoint(point);
    }
    expect(store.getState().closeDraft()).toBe(false);
    expect(store.getState().scene.room.walls).toHaveLength(0);
  });

  it("clears the draft on cancel", () => {
    const store = createEditorStore();
    store.getState().addDraftPoint({ x: 1, z: 1 });
    store.getState().setCursor({ x: 2, z: 2 });
    store.getState().cancelDraft();
    expect(store.getState().draft).toEqual([]);
    expect(store.getState().cursor).toBeNull();
  });

  it("clears the draft when switching mode", () => {
    const store = createEditorStore();
    store.getState().addDraftPoint({ x: 1, z: 1 });
    store.getState().setMode("edit");
    expect(store.getState().draft).toEqual([]);
  });
});

describe("undo / redo", () => {
  it("round-trips to the identical scene", () => {
    const store = storeWithRoom();
    const afterDraw = store.getState().scene;

    store.getState().undo();
    expect(store.getState().scene.room.walls).toHaveLength(0);

    store.getState().redo();
    expect(store.getState().scene).toEqual(afterDraw);
  });

  it("moves commands between the stacks", () => {
    const store = storeWithRoom();
    expect(historyLabels(store.getState())).toEqual({
      past: ["Draw room (4 walls)"],
      future: [],
    });

    store.getState().undo();
    expect(historyLabels(store.getState())).toEqual({
      past: [],
      future: ["Draw room (4 walls)"],
    });
  });

  it("clears the redo stack when a new command is executed", () => {
    const store = storeWithRoom();
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);

    for (const point of square) store.getState().addDraftPoint(point);
    store.getState().closeDraft();
    expect(store.getState().future).toHaveLength(0);
  });

  it("is a no-op on empty stacks", () => {
    const store = createEditorStore();
    const before = store.getState().scene;
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().scene).toBe(before);
  });

  it("survives repeated undo/redo cycles", () => {
    const store = storeWithRoom();
    const afterDraw = store.getState().scene;
    for (let i = 0; i < 5; i++) {
      store.getState().undo();
      store.getState().redo();
    }
    expect(store.getState().scene).toEqual(afterDraw);
  });
});

describe("vertex dragging", () => {
  it("re-extrudes live without touching history", () => {
    const store = storeWithRoom();
    store.getState().beginDrag(1);
    store.getState().updateDrag({ x: 6, z: 0 });

    expect(livePolygon(store.getState())[1]).toEqual({ x: 6, z: 0 });
    // Scene is untouched until the gesture ends.
    expect(store.getState().scene.room.polygon[1]).toEqual({ x: 4, z: 0 });
    expect(store.getState().past).toHaveLength(1);
  });

  it("records exactly one history entry per gesture", () => {
    const store = storeWithRoom();
    store.getState().beginDrag(1);
    for (const x of [4.5, 5, 5.5, 6]) store.getState().updateDrag({ x, z: 0 });
    store.getState().endDrag();

    expect(store.getState().past).toHaveLength(2);
    expect(store.getState().past.at(-1)?.label).toBe("Move vertex 2");
    expect(store.getState().scene.room.polygon[1]).toEqual({ x: 6, z: 0 });
    expect(store.getState().dragging).toBeNull();
  });

  it("records nothing when the vertex did not move", () => {
    const store = storeWithRoom();
    store.getState().beginDrag(1);
    store.getState().endDrag();
    expect(store.getState().past).toHaveLength(1);
  });

  it("undoes a drag back to the original vertex", () => {
    const store = storeWithRoom();
    store.getState().beginDrag(1);
    store.getState().updateDrag({ x: 6, z: 0 });
    store.getState().endDrag();
    store.getState().undo();
    expect(store.getState().scene.room.polygon[1]).toEqual({ x: 4, z: 0 });
  });

  it("ignores drags on a missing vertex", () => {
    const store = createEditorStore();
    store.getState().beginDrag(0);
    expect(store.getState().dragging).toBeNull();
  });
});

describe("wall settings", () => {
  it("updates defaults without history when there is no room", () => {
    const store = createEditorStore();
    store.getState().applyWallSettings({ thickness: 0.4 });
    expect(currentWallSettings(store.getState()).thickness).toBeCloseTo(0.4);
    expect(store.getState().past).toHaveLength(0);
  });

  it("applies to every wall and is undoable once a room exists", () => {
    const store = storeWithRoom();
    store.getState().applyWallSettings({ thickness: 0.4 });

    for (const wall of store.getState().scene.room.walls) {
      expect(wall.thickness).toBeCloseTo(0.4);
    }
    expect(store.getState().past.at(-1)?.label).toBe("Set wall thickness");

    store.getState().undo();
    for (const wall of store.getState().scene.room.walls) {
      expect(wall.thickness).toBeCloseTo(0.2);
    }
  });

  it("ignores a no-op change", () => {
    const store = storeWithRoom();
    store.getState().applyWallSettings({ thickness: 0.2 });
    expect(store.getState().past).toHaveLength(1);
  });

  it("carries settings into a newly drawn room", () => {
    const store = createEditorStore();
    store.getState().applyWallSettings({ height: 3 });
    for (const point of square) store.getState().addDraftPoint(point);
    store.getState().closeDraft();
    expect(store.getState().scene.room.walls[0]?.height).toBeCloseTo(3);
  });
});

describe("replaceScene", () => {
  it("is undoable", () => {
    const store = storeWithRoom();
    const original = store.getState().scene;
    const loaded = { ...original, room: { ...original.room, floorMaterial: "oak" } };

    store.getState().replaceScene(loaded);
    expect(store.getState().scene.room.floorMaterial).toBe("oak");

    store.getState().undo();
    expect(store.getState().scene).toEqual(original);
  });
});

describe("command merging", () => {
  it("collapses a slider drag into one history entry", () => {
    const store = storeWithRoom();
    for (const thickness of [0.25, 0.3, 0.35, 0.4]) {
      store.getState().applyWallSettings({ thickness });
    }
    // Draw room, plus one merged thickness entry.
    expect(store.getState().past).toHaveLength(2);
    expect(store.getState().scene.room.walls[0]?.thickness).toBeCloseTo(0.4);
  });

  it("undoes the whole run at once", () => {
    const store = storeWithRoom();
    for (const thickness of [0.25, 0.3, 0.4]) {
      store.getState().applyWallSettings({ thickness });
    }
    store.getState().undo();
    expect(store.getState().scene.room.walls[0]?.thickness).toBeCloseTo(0.2);
  });

  it("does not merge across different properties", () => {
    const store = storeWithRoom();
    store.getState().applyWallSettings({ thickness: 0.3 });
    store.getState().applyWallSettings({ height: 3 });
    expect(store.getState().past).toHaveLength(3);
  });

  it("does not merge when another command intervenes", () => {
    const store = storeWithRoom();
    store.getState().applyWallSettings({ thickness: 0.3 });
    store.getState().placeFurniture("desk");
    store.getState().applyWallSettings({ thickness: 0.4 });
    expect(store.getState().past).toHaveLength(4);
  });

  it("leaves unkeyed commands alone", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().placeFurniture("desk");
    expect(store.getState().past).toHaveLength(3);
  });
});
