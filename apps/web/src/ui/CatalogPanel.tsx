"use client";

import { CATALOG } from "@layra/state";
import { editor, useEditor } from "@/state/editor";

export function CatalogPanel() {
  const hasRoom = useEditor((state) => state.scene.room.polygon.length >= 3);

  return (
    <section className="border-b border-zinc-800 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Furniture
      </h2>

      {!hasRoom ? (
        <p className="mt-2 text-xs text-zinc-600">Draw a room first.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {CATALOG.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => editor().placeFurniture(item.id)}
                className="flex w-full items-baseline justify-between rounded px-2 py-1 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
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
    </section>
  );
}
