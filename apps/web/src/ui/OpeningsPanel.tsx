"use client";

import type { OpeningType } from "@layra/types";
import { formatLength } from "@layra/geometry";
import { editor, useEditor } from "@/state/editor";

const TYPES: OpeningType[] = ["door", "window"];

export function OpeningsPanel() {
  const walls = useEditor((state) => state.scene.room.walls);
  const pending = useEditor((state) => state.pendingOpening);

  const total = walls.reduce((sum, wall) => sum + wall.openings.length, 0);

  return (
    <section className="border-b border-zinc-800 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Openings
      </h2>

      {walls.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">Draw a room first.</p>
      ) : (
        <>
          <div className="mt-2 flex gap-1">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => editor().armOpening(pending === type ? null : type)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
                  pending === type
                    ? "bg-sky-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-zinc-600">
            {pending ? `Click a wall to place the ${pending}.` : "Pick a type, then click a wall."}
          </p>

          {total > 0 && (
            <ul className="mt-2 space-y-0.5">
              {walls.flatMap((wall, index) =>
                wall.openings.map((opening) => (
                  <li
                    key={opening.id}
                    className="flex items-baseline justify-between rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                  >
                    <span className="capitalize">
                      {opening.type}
                      <span className="ml-1 text-zinc-600">wall {index + 1}</span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-zinc-500">
                        {formatLength(opening.offset)}
                      </span>
                      <button
                        type="button"
                        onClick={() => editor().deleteOpening(index, opening.id)}
                        className="text-zinc-500 hover:text-red-400"
                        aria-label={`Delete ${opening.type} on wall ${index + 1}`}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                )),
              )}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
