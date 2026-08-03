import { describe, expect, it } from "vitest";
import { activeRoom, createEditorStore } from "./store";

const square = [
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

type Store = ReturnType<typeof storeWithRoom>;
const rooms = (s: Store) => s.getState().scene.rooms;

describe("adding a room", () => {
  it("appends and makes it active", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    expect(rooms(s)).toHaveLength(2);
    expect(s.getState().activeRoomIndex).toBe(1);
  });

  it("drops into draw mode, since a new room has no walls", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    expect(s.getState().mode).toBe("draw");
  });

  it("names rooms in sequence and gives each a distinct id", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    s.getState().addRoom();
    expect(rooms(s).map((r) => r.name)).toEqual(["Room 1", "Room 2", "Room 3"]);
    expect(new Set(rooms(s).map((r) => r.id)).size).toBe(3);
  });

  it("is undoable", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    s.getState().undo();
    expect(rooms(s)).toHaveLength(1);
  });

  it("leaves the first room's geometry alone", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    expect(rooms(s)[0]?.walls).toHaveLength(4);
    expect(rooms(s)[1]?.walls).toHaveLength(0);
  });
});

describe("editing targets the active room", () => {
  it("draws the second room without touching the first", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    for (const point of [
      { x: 6, z: 0 },
      { x: 9, z: 0 },
      { x: 9, z: 3 },
    ]) {
      s.getState().addDraftPoint(point);
    }
    s.getState().closeDraft();

    expect(rooms(s)[0]?.polygon).toHaveLength(4);
    expect(rooms(s)[1]?.polygon).toHaveLength(3);
  });

  it("applies wall settings only to the active room", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    for (const point of [
      { x: 6, z: 0 },
      { x: 9, z: 0 },
      { x: 9, z: 3 },
    ]) {
      s.getState().addDraftPoint(point);
    }
    s.getState().closeDraft();
    s.getState().applyWallSettings({ thickness: 0.5 });

    expect(rooms(s)[1]?.walls[0]?.thickness).toBeCloseTo(0.5);
    expect(rooms(s)[0]?.walls[0]?.thickness).toBeCloseTo(0.2);
  });

  it("applies the floor finish only to the active room", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    s.getState().applyFloorMaterial("oak");
    expect(rooms(s)[1]?.floorMaterial).toBe("oak");
    expect(rooms(s)[0]?.floorMaterial).toBe("default");
  });

  it("reports the active room through activeRoom", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    expect(activeRoom(s.getState()).name).toBe("Room 2");
    s.getState().setActiveRoom(0);
    expect(activeRoom(s.getState()).name).toBe("Room 1");
  });
});

describe("switching rooms", () => {
  it("clears selections that belonged to the room being left", () => {
    const s = storeWithRoom();
    s.getState().selectVertex(1);
    s.getState().armOpening("door");
    s.getState().addRoom();

    expect(s.getState().selectedVertex).toBeNull();
    expect(s.getState().pendingOpening).toBeNull();
  });

  it("ignores an index outside the list", () => {
    const s = storeWithRoom();
    s.getState().setActiveRoom(5);
    s.getState().setActiveRoom(-1);
    expect(s.getState().activeRoomIndex).toBe(0);
  });

  it("opens a drawn room in edit mode", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    s.getState().setActiveRoom(0);
    expect(s.getState().mode).toBe("edit");
  });
});

describe("deleting and renaming", () => {
  it("removes a room and keeps the active index in range", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    s.getState().deleteRoom(1);
    expect(rooms(s)).toHaveLength(1);
    expect(s.getState().activeRoomIndex).toBe(0);
  });

  it("never removes the last room", () => {
    const s = storeWithRoom();
    s.getState().deleteRoom(0);
    expect(rooms(s)).toHaveLength(1);
  });

  it("restores a deleted room in place", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    s.getState().addRoom();
    const middle = rooms(s)[1]!;

    s.getState().deleteRoom(1);
    s.getState().undo();
    expect(rooms(s)[1]?.id).toBe(middle.id);
  });

  it("renames and merges repeated edits into one entry", () => {
    const s = storeWithRoom();
    const before = s.getState().past.length;
    for (const name of ["K", "Ki", "Kitchen"]) s.getState().renameRoom(0, name);

    expect(rooms(s)[0]?.name).toBe("Kitchen");
    expect(s.getState().past).toHaveLength(before + 1);

    s.getState().undo();
    expect(rooms(s)[0]?.name).toBe("Room 1");
  });

  it("ignores a rename to the same name", () => {
    const s = storeWithRoom();
    const before = s.getState().past.length;
    s.getState().renameRoom(0, "Room 1");
    expect(s.getState().past).toHaveLength(before);
  });
});
