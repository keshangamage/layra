"use client";

import { useEditor } from "@/state/editor";

export function HistoryList() {
  // The command arrays are stable refs; mapping to labels here avoids a
  // selector that returns a new object on every call.
  const past = useEditor((state) => state.past).map((c) => c.label);
  const future = useEditor((state) => state.future).map((c) => c.label);

  return (
    <section className="p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        History
      </h2>

      {past.length === 0 && future.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">Nothing yet.</p>
      ) : (
        <ol className="mt-2 space-y-0.5">
          {past.map((label, i) => (
            <li
              key={`past-${i}`}
              className={`rounded px-2 py-1 text-xs ${
                i === past.length - 1
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400"
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
