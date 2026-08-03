import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_VERSION, emptyScene } from "@layra/types";
import {
  AUTOSAVE_KEY,
  attachAutosave,
  clearAutosave,
  readAutosave,
  writeAutosave,
  type SceneStorage,
} from "./autosave";
import { activeRoom, createEditorStore } from "./store";
import { serializeScene } from "./serialize";

function memoryStorage(): SceneStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Storage that always throws, like private mode or a full quota. */
const hostileStorage: SceneStorage = {
  getItem() {
    throw new Error("denied");
  },
  setItem() {
    throw new Error("quota");
  },
  removeItem() {
    throw new Error("denied");
  },
};

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

describe("read and write", () => {
  it("round-trips a scene", () => {
    const storage = memoryStorage();
    const scene = storeWithRoom().getState().scene;
    expect(writeAutosave(storage, scene)).toBe(true);
    expect(readAutosave(storage)).toEqual(scene);
  });

  it("returns null when nothing is stored", () => {
    expect(readAutosave(memoryStorage())).toBeNull();
  });

  it("returns null for corrupt data rather than throwing", () => {
    const storage = memoryStorage();
    storage.data.set(AUTOSAVE_KEY, "{ not json");
    expect(readAutosave(storage)).toBeNull();
  });

  it("returns null for a future scene version", () => {
    const storage = memoryStorage();
    storage.data.set(AUTOSAVE_KEY, JSON.stringify({ ...emptyScene(), version: 99 }));
    expect(readAutosave(storage)).toBeNull();
  });

  it("survives storage that throws", () => {
    expect(readAutosave(hostileStorage)).toBeNull();
    expect(writeAutosave(hostileStorage, emptyScene())).toBe(false);
    expect(() => clearAutosave(hostileStorage)).not.toThrow();
  });

  it("clears the entry", () => {
    const storage = memoryStorage();
    writeAutosave(storage, emptyScene());
    clearAutosave(storage);
    expect(readAutosave(storage)).toBeNull();
  });

  it("honours a custom key", () => {
    const storage = memoryStorage();
    writeAutosave(storage, emptyScene(), "other");
    expect(storage.data.has("other")).toBe(true);
    expect(readAutosave(storage)).toBeNull();
  });
});

describe("attachAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes after the scene settles", () => {
    const storage = memoryStorage();
    const store = createEditorStore();
    attachAutosave(store, storage);

    for (const point of square) store.getState().addDraftPoint(point);
    store.getState().closeDraft();
    expect(storage.data.size).toBe(0);

    vi.advanceTimersByTime(500);
    expect(readAutosave(storage)?.rooms[0]!.walls).toHaveLength(4);
  });

  it("debounces a burst into one write", () => {
    const storage = memoryStorage();
    const store = storeWithRoom();
    const setItem = vi.spyOn(storage, "setItem");
    attachAutosave(store, storage);

    for (const thickness of [0.25, 0.3, 0.35]) {
      store.getState().applyWallSettings({ thickness });
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(500);

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("saves the latest scene, not the one that started the burst", () => {
    const storage = memoryStorage();
    const store = storeWithRoom();
    attachAutosave(store, storage);

    store.getState().applyWallSettings({ thickness: 0.3 });
    store.getState().applyWallSettings({ thickness: 0.45 });
    vi.advanceTimersByTime(500);

    expect(readAutosave(storage)?.rooms[0]!.walls[0]?.thickness).toBeCloseTo(0.45);
  });

  it("ignores changes that do not touch the scene", () => {
    const storage = memoryStorage();
    const store = storeWithRoom();
    const setItem = vi.spyOn(storage, "setItem");
    attachAutosave(store, storage);

    store.getState().setMode("measure");
    store.getState().selectPlacement("anything");
    store.getState().armOpening("door");
    vi.advanceTimersByTime(500);

    expect(setItem).not.toHaveBeenCalled();
  });

  it("stops writing once detached", () => {
    const storage = memoryStorage();
    const store = storeWithRoom();
    const detach = attachAutosave(store, storage);
    detach();

    store.getState().applyWallSettings({ thickness: 0.4 });
    vi.advanceTimersByTime(500);
    expect(storage.data.size).toBe(0);
  });

  it("drops a pending write when detached mid-debounce", () => {
    const storage = memoryStorage();
    const store = storeWithRoom();
    const detach = attachAutosave(store, storage);

    store.getState().applyWallSettings({ thickness: 0.4 });
    vi.advanceTimersByTime(100);
    detach();
    vi.advanceTimersByTime(500);

    expect(storage.data.size).toBe(0);
  });

  it("keeps editing working when storage is full", () => {
    const store = storeWithRoom();
    attachAutosave(store, hostileStorage);
    store.getState().applyWallSettings({ thickness: 0.4 });
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
    expect(activeRoom(store.getState()).walls[0]?.thickness).toBeCloseTo(0.4);
  });
});

describe("resetScene", () => {
  it("restores without adding history", () => {
    const saved = storeWithRoom().getState().scene;
    const store = createEditorStore();
    store.getState().resetScene(saved);

    expect(activeRoom(store.getState()).walls).toHaveLength(4);
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().future).toHaveLength(0);
  });

  it("opens in edit mode when a room was restored", () => {
    const store = createEditorStore();
    store.getState().resetScene(storeWithRoom().getState().scene);
    expect(store.getState().mode).toBe("edit");
  });

  it("stays in draw mode for an empty scene", () => {
    const store = createEditorStore();
    store.getState().resetScene(emptyScene());
    expect(store.getState().mode).toBe("draw");
  });

  it("matches what was serialized", () => {
    const original = storeWithRoom().getState().scene;
    const store = createEditorStore();
    store.getState().resetScene(original);
    expect(serializeScene(store.getState().scene)).toBe(serializeScene(original));
    expect(store.getState().scene.version).toBe(SCENE_VERSION);
  });
});
