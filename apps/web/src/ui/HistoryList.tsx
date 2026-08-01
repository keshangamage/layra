"use client";

import { editor, useEditor } from "@/state/editor";

const BUTTON =
  "rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent";

export function HistoryList() {
  // The command arrays are stable refs; mapping to labels here avoids a
  // selector that returns a new object on every call.
  const past = useEditor((state) => state.past).map((c) => c.label);
  const future = useEditor((state) => state.future).map((c) => c.label);

  return (
    <section className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          History
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={BUTTON}
            disabled={past.length === 0}
            title="Undo (Cmd+Z)"
            onClick={() => editor().undo()}
          >
            Undo
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={future.length === 0}
            title="Redo (Cmd+Shift+Z)"
            onClick={() => editor().redo()}
          >
            Redo
          </button>
        </div>
      </div>

      {past.length === 0 && future.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">Nothing yet.</p>
      ) : (
        <ol className="mt-2 space-y-0.5">
          {past.map((label, i) => (
            <li
              key={`past-${i}`}
              className={`rounded px-2 py-1 text-xs ${
                i === past.length - 1 ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
              }`}
            >
              {label}
            </li>
          ))}
          {future.map((label, i) => (
            <li key={`future-${i}`} className="px-2 py-1 text-xs text-zinc-600">
              {label}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
