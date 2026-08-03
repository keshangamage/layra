"use client";

import { useMemo } from "react";
import { formatArea, formatLength, perimeter, polygonArea, wallLoops } from "@layra/geometry";
import { FLOOR_MATERIALS, currentWallSettings,
  activeRoom,
} from "@layra/state";
import { editor, useEditor } from "@/state/editor";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}

export function RoomStats() {
  const polygon = useEditor((state) => activeRoom(state).polygon);
  const thickness = useEditor((state) => currentWallSettings(state).thickness);
  const showDimensions = useEditor((state) => state.showDimensions);
  const floorMaterial = useEditor((state) => activeRoom(state).floorMaterial);

  // Floor area uses the inner wall face, which is the usable space.
  const stats = useMemo(() => {
    if (polygon.length < 3) return null;
    const { inner } = wallLoops(polygon, thickness);
    return {
      area: polygonArea(inner),
      perimeter: perimeter(polygon),
      walls: polygon.length,
    };
  }, [polygon, thickness]);

  return (
    <section className="space-y-2 border-b border-zinc-800 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Room
      </h2>

      {!stats ? (
        <p className="text-xs text-zinc-600">Draw a room to see measurements.</p>
      ) : (
        <>
          <Row label="Floor area" value={formatArea(stats.area)} />
          <Row label="Perimeter" value={formatLength(stats.perimeter)} />
          <Row label="Walls" value={String(stats.walls)} />
        </>
      )}

      {stats && (
        <div className="pt-1">
          <span className="text-xs text-zinc-400">Floor</span>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {FLOOR_MATERIALS.map((finish) => (
              <button
                key={finish.id}
                type="button"
                aria-label={finish.name}
                onClick={() => editor().applyFloorMaterial(finish.id)}
                className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] transition-colors ${
                  floorMaterial === finish.id
                    ? "bg-zinc-700 text-zinc-50"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: finish.color }}
                />
                {finish.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 pt-1 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={showDimensions}
          onChange={() => editor().toggleDimensions()}
          className="accent-zinc-400"
        />
        Show wall lengths
      </label>
    </section>
  );
}
