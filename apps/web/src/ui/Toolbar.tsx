"use client";

import type { Mode } from "@layra/state";
import { editor, useEditor } from "@/state/editor";

export function Toolbar() {
  const mode = useEditor((state) => state.mode);
  const draftCount = useEditor((state) => state.draft.length);
  const hasRoom = useEditor((state) => state.scene.room.polygon.length >= 3);

  const hint =
    mode === "draw"
      ? draftCount === 0
        ? "Click to place the first corner"
        : draftCount < 3
          ? `${draftCount} placed · keep clicking`
          : "Enter or click the first corner to close · Esc to cancel"
      : "Drag a corner handle to reshape the room";

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-950 px-4">
      <span className="text-sm font-semibold tracking-tight text-zinc-100">Layra</span>

      <div className="flex items-center gap-1 rounded-md bg-zinc-900 p-0.5">
        {(["draw", "edit"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={value === "edit" && !hasRoom}
            onClick={() => editor().setMode(value as Mode)}
            className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-30 ${
              mode === value
                ? "bg-zinc-700 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <span className="ml-auto text-xs text-zinc-500">{hint}</span>
    </header>
  );
}
