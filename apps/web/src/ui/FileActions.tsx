"use client";

import { useRef, useState } from "react";
import { parseScene, serializeScene } from "@layra/state";
import { editor } from "@/state/editor";

const BUTTON =
  "rounded px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200";

export function FileActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const blob = new Blob([serializeScene(editor().scene)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "layra-scene.json";
    link.click();
    URL.revokeObjectURL(url);
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
      <button type="button" className={BUTTON} onClick={save}>
        Save
      </button>
      <button type="button" className={BUTTON} onClick={() => inputRef.current?.click()}>
        Load
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
