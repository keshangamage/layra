"use client";

import { useMemo } from "react";
import { CATALOG, findCollisions,
  activeRoom,
} from "@layra/state";
import { editor, useEditor } from "@/state/editor";

export function CatalogPanel() {
  const hasRoom = useEditor((state) => activeRoom(state).polygon.length >= 3);
  const room = useEditor((state) => activeRoom(state));
  const placements = useEditor((state) => state.scene.placements);

  const pending = useEditor((state) => state.pendingFurniture);

  const report = useMemo(
    () => findCollisions(room, placements),
    [room, placements],
  );
  const blocked = new Set([...report.overlapping, ...report.outOfRoom]).size;

  return (
    <section className="border-b border-zinc-800 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Furniture
        </h2>
        {blocked > 0 && (
          <span className="text-[10px] font-medium text-red-400">
            {blocked} clash{blocked === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {!hasRoom ? (
        <p className="mt-2 text-xs text-zinc-600">Draw a room first.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {CATALOG.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  editor().armFurniture(pending === item.id ? null : item.id)
                }
                className={`flex w-full items-baseline justify-between rounded px-2 py-1 text-left text-xs transition-colors ${
                  pending === item.id
                    ? "bg-sky-600 text-white"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <span>{item.name}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {item.footprint.w}×{item.footprint.d}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasRoom && (
        <p className="mt-2 text-[11px] text-zinc-600">
          {pending
            ? "Click to place - snaps to walls, hold Alt for any angle."
            : "Pick an item, then click where it goes."}
        </p>
      )}
    </section>
  );
}
