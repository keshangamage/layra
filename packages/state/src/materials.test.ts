import { describe, expect, it } from "vitest";
import { FLOOR_MATERIALS, findFloorMaterial } from "./materials";
import { activeRoom, createEditorStore } from "./store";
import { sceneToSvg } from "./svg";

function storeWithRoom() {
  const store = createEditorStore();
  for (const point of [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 3 },
    { x: 0, z: 3 },
  ]) {
    store.getState().addDraftPoint(point);
  }
  store.getState().closeDraft();
  return store;
}

describe("floor materials", () => {
  it("uses unique ids", () => {
    expect(new Set(FLOOR_MATERIALS.map((m) => m.id)).size).toBe(FLOOR_MATERIALS.length);
  });

  it("falls back rather than throwing on an unknown id", () => {
    // An old file naming a finish we dropped must still open.
    expect(findFloorMaterial("nope").id).toBe("default");
  });

  it("changes the room's floor and is undoable", () => {
    const s = storeWithRoom();
    s.getState().applyFloorMaterial("oak");
    expect(activeRoom(s.getState()).floorMaterial).toBe("oak");
    expect(s.getState().past.at(-1)?.label).toBe("Change floor");

    s.getState().undo();
    expect(activeRoom(s.getState()).floorMaterial).toBe("default");
  });

  it("records nothing when the finish is unchanged", () => {
    const s = storeWithRoom();
    const before = s.getState().past.length;
    s.getState().applyFloorMaterial("default");
    expect(s.getState().past).toHaveLength(before);
  });

  it("reaches the exported plan", () => {
    const s = storeWithRoom();
    s.getState().applyFloorMaterial("walnut");
    expect(sceneToSvg(s.getState().scene)).toContain(findFloorMaterial("walnut").color);
  });

  it("survives save and load", () => {
    const s = storeWithRoom();
    s.getState().applyFloorMaterial("tile");
    s.getState().replaceScene(s.getState().scene);
    expect(activeRoom(s.getState()).floorMaterial).toBe("tile");
  });
});

describe("new scene", () => {
  it("clears the room and furniture", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);

    s.getState().newScene();
    expect(activeRoom(s.getState()).polygon).toHaveLength(0);
    expect(s.getState().scene.placements).toHaveLength(0);
  });

  it("is undoable, so it needs no confirmation", () => {
    const s = storeWithRoom();
    s.getState().newScene();
    s.getState().undo();
    expect(activeRoom(s.getState()).polygon).toHaveLength(4);
  });

  it("returns to draw mode", () => {
    const s = storeWithRoom();
    s.getState().newScene();
    expect(s.getState().mode).toBe("draw");
  });

  it("clears the selection and any armed tool", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().newScene();
    expect(s.getState().pendingFurniture).toBeNull();
    expect(s.getState().selectedId).toBeNull();
  });

  it("does nothing on an already empty scene", () => {
    const s = createEditorStore();
    s.getState().newScene();
    expect(s.getState().past).toHaveLength(0);
  });
});
