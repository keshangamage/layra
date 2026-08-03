"use client";

import type { Mode } from "@layra/state";
import { activeRoom } from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { FileActions } from "./FileActions";

export function Toolbar() {
  const mode = useEditor((state) => state.mode);
  const draftCount = useEditor((state) => state.draft.length);
  const hasRoom = useEditor((state) => activeRoom(state).polygon.length >= 3);

  const hint =
    mode === "draw"
      ? draftCount === 0
        ? "Click to place the first corner"
        : draftCount < 3
          ? `${draftCount} placed · keep clicking`
          : "Enter or click the first corner to close · Esc to cancel"
      : mode === "edit"
        ? "Drag a corner to reshape · double-click a wall to add one · Delete removes"
        : "Click two points to measure - Esc clears";

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-950 px-4">
      <span className="text-sm font-semibold tracking-tight text-zinc-100">Layra</span>

      <div className="flex items-center gap-1 rounded-md bg-zinc-900 p-0.5">
        {(["draw", "edit", "measure"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={value !== "draw" && !hasRoom}
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

      <div className="flex items-center gap-0.5">
        {(["top", "iso", "fit"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => editor().requestView(kind)}
            className="rounded px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
            title={
              kind === "top"
                ? "Look straight down"
                : kind === "iso"
                  ? "Angled view"
                  : "Frame the room"
            }
          >
            {kind === "iso" ? "3D" : kind === "top" ? "Plan" : "Fit"}
          </button>
        ))}
      </div>

      <FileActions />

      <span className="ml-auto text-xs text-zinc-500">{hint}</span>
    </header>
  );
}
