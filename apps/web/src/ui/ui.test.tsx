import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_SNAP,
  DEFAULT_WALLS,
  activeRoom,
  serializeScene,
} from "@layra/state";
import { emptyScene } from "@layra/types";
import { editorStore } from "@/state/editor";
import { Toolbar } from "./Toolbar";
import { SettingsPanel } from "./SettingsPanel";
import { HistoryList } from "./HistoryList";
import { SelectionPanel } from "./SelectionPanel";
import { KeyboardShortcuts } from "./KeyboardShortcuts";

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
    walking: false,
    draft: [],
    cursor: null,
    dragging: null,
    wallDefaults: DEFAULT_WALLS,
    snap: DEFAULT_SNAP,
    lightingPreset: "daylight",
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

  it("offers wall drawing before a room exists", () => {
    render(<Toolbar />);
    const wall = screen.getByRole("button", { name: "wall" });

    expect(wall.hasAttribute("disabled")).toBe(false);
    fireEvent.click(wall);
    expect(editorStore.getState().mode).toBe("wall");
    expect(screen.getByText("Click two points to draw a wall · Esc to cancel")).toBeDefined();
  });

  it("toggles walkthrough mode when a room exists", () => {
    drawRoom();
    render(<Toolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Walk" }));
    expect(editorStore.getState().walking).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Walk" }));
    expect(editorStore.getState().walking).toBe(false);
  });
});

describe("SettingsPanel", () => {
  it("shows the scene's wall settings and writes changes back", () => {
    drawRoom();
    render(<SettingsPanel />);

    const thickness = screen.getByLabelText(/Thickness/) as HTMLInputElement;
    expect(thickness.value).toBe("0.2");

    fireEvent.change(thickness, { target: { value: "0.35" } });
    expect(activeRoom(editorStore.getState()).walls[0]?.thickness).toBeCloseTo(0.35);
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

  it("switches the preview lighting mood without adding history", () => {
    render(<SettingsPanel />);
    const before = editorStore.getState().past.length;

    fireEvent.click(screen.getByRole("button", { name: "warm" }));

    expect(editorStore.getState().lightingPreset).toBe("warm");
    expect(editorStore.getState().past).toHaveLength(before);
  });
});

describe("KeyboardShortcuts", () => {
  function press(key: string, init: Partial<KeyboardEventInit> = {}) {
    act(() => {
      fireEvent.keyDown(document.activeElement ?? window, {
        key,
        metaKey: true,
        bubbles: true,
        ...init,
      });
    });
  }

  it("undoes and redoes with Cmd+Z and Cmd+Shift+Z", () => {
    render(<KeyboardShortcuts />);
    drawRoom();

    press("z");
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(0);

    press("z", { shiftKey: true });
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(4);
  });

  it("redoes with Ctrl+Y", () => {
    render(<KeyboardShortcuts />);
    drawRoom();
    press("z");

    press("y", { metaKey: false, ctrlKey: true });
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(4);
  });

  it("ignores plain Z with no modifier", () => {
    render(<KeyboardShortcuts />);
    drawRoom();

    press("z", { metaKey: false });
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(4);
  });

  it("still undoes while a range slider holds focus", () => {
    // A slider keeps focus after dragging; treating every input as text entry
    // would silently swallow Cmd+Z right when the user reaches for it.
    drawRoom();
    render(
      <>
        <KeyboardShortcuts />
        <SettingsPanel />
      </>,
    );

    const thickness = screen.getByLabelText(/Thickness/) as HTMLInputElement;
    fireEvent.change(thickness, { target: { value: "0.35" } });
    thickness.focus();

    press("z");
    expect(activeRoom(editorStore.getState()).walls[0]?.thickness).toBeCloseTo(0.2);
  });

  it("leaves text entry alone", () => {
    render(
      <>
        <KeyboardShortcuts />
        <input type="text" aria-label="note" />
      </>,
    );
    drawRoom();

    const text = screen.getByLabelText("note");
    text.focus();
    press("z");

    expect(activeRoom(editorStore.getState()).walls).toHaveLength(4);
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
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(0);

    await pick(saved);
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(4);

    run(() => editorStore.getState().undo());
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(0);
  });

  it("shows an error and keeps the scene on a bad file", async () => {
    drawRoom();
    const before = editorStore.getState().scene;

    await pick("{ not json");
    expect(screen.getByText("Not valid JSON.")).toBeDefined();
    expect(editorStore.getState().scene).toBe(before);
  });

  it("refuses a file from a newer version", async () => {
    await pick(JSON.stringify({ version: 99, rooms: [], placements: [] }));
    expect(screen.getByText(/Scene version 99 is newer/)).toBeDefined();
  });

  it("opens a version 1 file", async () => {
    // v1 held a single `room` with no id or name.
    drawRoom();
    const current = editorStore.getState().scene;
    const legacy = JSON.stringify({
      version: 1,
      room: { ...current.rooms[0]!, id: undefined, name: undefined },
      placements: [],
    });
    run(() => editorStore.getState().newScene());

    await pick(legacy);
    expect(activeRoom(editorStore.getState()).walls).toHaveLength(4);
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

describe("SelectionPanel", () => {
  function withDesk() {
    drawRoom();
    run(() => {
      editorStore.getState().armFurniture("desk");
      editorStore.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);
    });
  }

  it("shows nothing without a selection", () => {
    drawRoom();
    const { container } = render(<SelectionPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the rotation in degrees, not radians", () => {
    withDesk();
    run(() => editorStore.getState().setSelectedRotation(Math.PI / 2));
    render(<SelectionPanel />);
    expect(screen.getByText("90°")).toBeDefined();
  });

  it("normalises past a full turn", () => {
    withDesk();
    run(() => editorStore.getState().setSelectedRotation(Math.PI * 2.5));
    render(<SelectionPanel />);
    expect(screen.getByText("90°")).toBeDefined();
  });

  it("writes rotation changes back to the scene", () => {
    withDesk();
    render(<SelectionPanel />);
    const slider = screen.getByLabelText(/Rotation/) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "180" } });
    expect(editorStore.getState().scene.placements[0]?.rotationY).toBeCloseTo(Math.PI);
  });

  it("locks and unlocks the selection", () => {
    withDesk();
    render(<SelectionPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    expect(editorStore.getState().scene.placements[0]?.locked).toBe(true);
    expect(screen.getByRole("button", { name: "Unlock" })).toBeDefined();
  });

  it("disables editing while locked", () => {
    withDesk();
    render(<SelectionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Lock" }));

    expect(
      (screen.getByLabelText(/Rotation/) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Delete" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("reports whether the piece fits", () => {
    withDesk();
    render(<SelectionPanel />);
    expect(screen.getByText("Fits")).toBeDefined();
  });
});
