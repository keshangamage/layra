import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SNAP, DEFAULT_WALLS, serializeScene } from "@layra/state";
import { emptyScene } from "@layra/types";
import { editorStore } from "@/state/editor";
import { Toolbar } from "./Toolbar";
import { SettingsPanel } from "./SettingsPanel";
import { HistoryList } from "./HistoryList";

const square = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 3 },
  { x: 0, z: 3 },
];

/** Store mutations must run inside act() or React won't re-render. */
function run(fn: () => void) {
  act(fn);
}

function drawRoom() {
  run(() => {
    for (const point of square) editorStore.getState().addDraftPoint(point);
    editorStore.getState().closeDraft();
  });
}

function Panels() {
  return (
    <>
      <Toolbar />
      <SettingsPanel />
      <HistoryList />
    </>
  );
}

afterEach(() => {
  cleanup();
  // Merge data fields only. Replacing wholesale would swap in actions bound to
  // a different store instance.
  editorStore.setState({
    scene: emptyScene(),
    past: [],
    future: [],
    mode: "draw",
    draft: [],
    cursor: null,
    dragging: null,
    wallDefaults: DEFAULT_WALLS,
    snap: DEFAULT_SNAP,
  });
});

describe("store-driven UI renders without looping", () => {
  // These selectors previously returned a fresh object per call, which makes
  // useSyncExternalStore re-render forever. React logs rather than throws.
  it("renders every panel with no React error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Panels />);

    expect(screen.getByText("Layra")).toBeDefined();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("re-renders cleanly after the store changes", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Panels />);

    drawRoom();
    run(() => editorStore.getState().applyWallSettings({ thickness: 0.4 }));

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("Toolbar", () => {
  it("guides the user through drawing", () => {
    render(<Toolbar />);
    expect(screen.getByText("Click to place the first corner")).toBeDefined();

    run(() => editorStore.getState().addDraftPoint({ x: 0, z: 0 }));
    expect(screen.getByText("1 placed · keep clicking")).toBeDefined();
  });

  it("disables edit mode until a room exists", () => {
    render(<Toolbar />);
    const edit = screen.getByRole("button", { name: "edit" });
    expect(edit.hasAttribute("disabled")).toBe(true);

    drawRoom();
    expect(edit.hasAttribute("disabled")).toBe(false);
  });
});

describe("SettingsPanel", () => {
  it("shows the scene's wall settings and writes changes back", () => {
    drawRoom();
    render(<SettingsPanel />);

    const thickness = screen.getByLabelText(/Thickness/) as HTMLInputElement;
    expect(thickness.value).toBe("0.2");

    fireEvent.change(thickness, { target: { value: "0.35" } });
    expect(editorStore.getState().scene.room.walls[0]?.thickness).toBeCloseTo(0.35);
  });

  it("follows the scene back on undo", () => {
    drawRoom();
    render(<SettingsPanel />);

    const thickness = screen.getByLabelText(/Thickness/) as HTMLInputElement;
    fireEvent.change(thickness, { target: { value: "0.35" } });
    expect(thickness.value).toBe("0.35");

    run(() => editorStore.getState().undo());
    expect(thickness.value).toBe("0.2");
  });
});

describe("FileActions", () => {
  async function pick(contents: string) {
    render(<Toolbar />);
    const input = screen.getByLabelText("Load scene file") as HTMLInputElement;
    const file = new File([contents], "scene.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
  }

  it("loads a valid scene and makes it undoable", async () => {
    drawRoom();
    const saved = serializeScene(editorStore.getState().scene);
    run(() => editorStore.getState().undo());
    expect(editorStore.getState().scene.room.walls).toHaveLength(0);

    await pick(saved);
    expect(editorStore.getState().scene.room.walls).toHaveLength(4);

    run(() => editorStore.getState().undo());
    expect(editorStore.getState().scene.room.walls).toHaveLength(0);
  });

  it("shows an error and keeps the scene on a bad file", async () => {
    drawRoom();
    const before = editorStore.getState().scene;

    await pick("{ not json");
    expect(screen.getByText("Not valid JSON.")).toBeDefined();
    expect(editorStore.getState().scene).toBe(before);
  });

  it("reports a version mismatch", async () => {
    await pick(JSON.stringify({ version: 99, room: {}, placements: [] }));
    expect(screen.getByText(/Unsupported scene version 99/)).toBeDefined();
  });
});

describe("HistoryList", () => {
  it("lists commands and keeps undone ones visible", () => {
    render(<HistoryList />);
    expect(screen.getByText("Nothing yet.")).toBeDefined();

    drawRoom();
    expect(screen.getByText("Draw room (4 walls)")).toBeDefined();

    run(() => editorStore.getState().undo());
    expect(screen.getByText("Draw room (4 walls)")).toBeDefined();
    expect(editorStore.getState().future).toHaveLength(1);
  });
});
