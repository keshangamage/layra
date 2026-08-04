import { describe, expect, it } from "vitest";
import { placementsInRoom } from "./collision";
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
  it("toggles the visibility of other rooms without history", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    const before = s.getState().past.length;

    s.getState().toggleOtherRooms();

    expect(s.getState().showOtherRooms).toBe(false);
    expect(s.getState().past).toHaveLength(before);
  });

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

describe("duplicating a room", () => {
  it("copies the active room to the right and selects it", () => {
    const s = storeWithRoom();
    s.getState().duplicateRoom();

    expect(rooms(s)).toHaveLength(2);
    expect(rooms(s)[1]?.name).toBe("Room 1 copy");
    expect(rooms(s)[1]?.polygon[0]?.x).toBeCloseTo(5.5);
    expect(s.getState().activeRoomIndex).toBe(1);
    expect(s.getState().mode).toBe("edit");
  });

  it("copies furniture with fresh ids and undoes as one action", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);
    const sourceId = s.getState().scene.placements[0]?.id;

    s.getState().duplicateRoom();
    const copies = s.getState().scene.placements;
    expect(copies).toHaveLength(2);
    expect(copies[1]?.id).not.toBe(sourceId);
    expect(copies[1]?.position.x).toBeCloseTo(7.5);

    s.getState().undo();
    expect(rooms(s)).toHaveLength(1);
    expect(s.getState().scene.placements).toHaveLength(1);
  });
});

describe("moving a room", () => {
  it("moves the room and its furniture together", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);
    const before = s.getState().scene.placements[0]!.position;

    s.getState().moveActiveRoom(1, -0.5);

    expect(rooms(s)[0]?.polygon[0]).toEqual({ x: 1, z: -0.5 });
    expect(s.getState().scene.placements[0]?.position).toEqual({
      x: before.x + 1,
      y: before.y,
      z: before.z - 0.5,
    });
    expect(s.getState().past.at(-1)?.label).toBe("Move Room 1");
  });

  it("undoes and redoes the complete translation", () => {
    const s = storeWithRoom();
    const before = s.getState().scene.rooms[0]?.polygon;

    s.getState().moveActiveRoom(1, 0);
    s.getState().undo();
    expect(s.getState().scene.rooms[0]?.polygon).toEqual(before);

    s.getState().redo();
    expect(s.getState().scene.rooms[0]?.polygon[0]).toEqual({ x: 1, z: 0 });
  });
});

describe("rotating a room", () => {
  it("rotates the room and its furniture around the room centre", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);

    s.getState().rotateActiveRoom(Math.PI / 2);

    expect(rooms(s)[0]?.polygon[0]?.x).toBeCloseTo(3.5);
    expect(rooms(s)[0]?.polygon[0]?.z).toBeCloseTo(-0.5);
    expect(s.getState().scene.placements[0]?.position.x).toBeCloseTo(2);
    expect(s.getState().scene.placements[0]?.position.z).toBeCloseTo(1.5);
  });

  it("restores the exact scene through undo and redo", () => {
    const s = storeWithRoom();
    const before = structuredClone(s.getState().scene);

    s.getState().rotateActiveRoom(Math.PI / 2);
    s.getState().undo();
    expect(s.getState().scene).toEqual(before);

    s.getState().redo();
    expect(s.getState().past.at(-1)?.label).toBe("Rotate Room 1");
  });
});

describe("a room owns the furniture standing in it", () => {
  /** Two rooms side by side, each with a desk in it. */
  function twoRoomsWithDesks() {
    const s = storeWithRoom();

    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);

    s.getState().addRoom();
    for (const point of [
      { x: 6, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 3 },
      { x: 6, z: 3 },
    ]) {
      s.getState().addDraftPoint(point);
    }
    s.getState().closeDraft();

    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 8, z: 1.5 }, true);
    return s;
  }

  const placements = (s: Store) => s.getState().scene.placements;

  it("finds only the pieces inside a given room", () => {
    const s = twoRoomsWithDesks();
    expect(placementsInRoom(rooms(s)[0]!, placements(s))).toHaveLength(1);
    expect(placementsInRoom(rooms(s)[1]!, placements(s))).toHaveLength(1);
  });

  it("takes the contents with it when the room goes", () => {
    const s = twoRoomsWithDesks();
    expect(placements(s)).toHaveLength(2);

    s.getState().deleteRoom(1);
    expect(rooms(s)).toHaveLength(1);
    expect(placements(s)).toHaveLength(1);
    // The surviving desk is the one in the first room.
    expect(placements(s)[0]?.position.x).toBeCloseTo(2);
  });

  it("says how many items went with it", () => {
    const s = twoRoomsWithDesks();
    s.getState().deleteRoom(1);
    expect(s.getState().past.at(-1)?.label).toBe("Delete Room 2 and 1 item");
  });

  it("restores the room and its contents together", () => {
    const s = twoRoomsWithDesks();
    const before = placements(s).map((p) => p.id).sort();

    s.getState().deleteRoom(1);
    s.getState().undo();

    expect(rooms(s)).toHaveLength(2);
    expect(placements(s).map((p) => p.id).sort()).toEqual(before);
  });

  it("leaves furniture in other rooms alone", () => {
    const s = twoRoomsWithDesks();
    s.getState().deleteRoom(0);
    expect(placements(s)).toHaveLength(1);
    expect(placements(s)[0]?.position.x).toBeCloseTo(8);
  });

  it("clears a selection that pointed at deleted furniture", () => {
    const s = twoRoomsWithDesks();
    s.getState().deleteRoom(1);
    expect(s.getState().selectedId).toBeNull();
  });

  it("says nothing about items when the room was empty", () => {
    const s = storeWithRoom();
    s.getState().addRoom();
    s.getState().deleteRoom(1);
    expect(s.getState().past.at(-1)?.label).toBe("Delete Room 2");
  });
});
