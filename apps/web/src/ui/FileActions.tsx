"use client";

import { useRef, useState } from "react";
import {
  activeRoom,
  parseScene,
  placementsInRoom,
  sceneToSvg,
  serializeScene,
} from "@layra/state";
import { editor } from "@/state/editor";

const BUTTON =
  "rounded px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200";

export function FileActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const download = (contents: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const save = () =>
    download(serializeScene(editor().scene), "layra-scene.json", "application/json");

  const exportSvg = () =>
    download(sceneToSvg(editor().scene), "layra-plan.svg", "image/svg+xml");

  const exportActiveRoom = () => {
    const state = editor();
    const room = activeRoom(state);
    const scene = {
      ...state.scene,
      rooms: [room],
      placements: placementsInRoom(room, state.scene.placements),
    };
    download(sceneToSvg(scene), "layra-room.svg", "image/svg+xml");
  };

  const load = async (file: File) => {
    const result = parseScene(await file.text());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    // Goes through a command, so a bad import is undoable.
    editor().replaceScene(result.scene);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={BUTTON}
        title="Start an empty scene (undoable)"
        onClick={() => {
          setError(null);
          editor().newScene();
        }}
      >
        New
      </button>
      <button type="button" className={BUTTON} onClick={save}>
        Save
      </button>
      <button type="button" className={BUTTON} onClick={() => inputRef.current?.click()}>
        Load
      </button>
      <button type="button" className={BUTTON} onClick={exportSvg}>
        Export SVG
      </button>
      <button type="button" className={BUTTON} onClick={exportActiveRoom}>
        Export room
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Load scene file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so picking the same file twice still fires a change.
          event.target.value = "";
          if (file) void load(file);
        }}
      />

      {error && (
        <span className="max-w-64 truncate text-xs text-red-400" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
