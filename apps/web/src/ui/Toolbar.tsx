"use client";

export type Mode = "draw" | "edit";

interface ToolbarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function Toolbar({ mode, onModeChange }: ToolbarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-950 px-4">
      <span className="text-sm font-semibold tracking-tight text-zinc-100">Layra</span>

      <div className="flex items-center gap-1 rounded-md bg-zinc-900 p-0.5">
        {(["draw", "edit"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
              mode === value
                ? "bg-zinc-700 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <span className="ml-auto text-xs text-zinc-500">
        Drag to orbit · scroll to zoom
      </span>
    </header>
  );
}
