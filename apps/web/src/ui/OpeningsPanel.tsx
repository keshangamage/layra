"use client";

import type { Opening, OpeningType } from "@layra/types";
import { distance, formatLength } from "@layra/geometry";
import { MIN_OPENING, type OpeningShape } from "@layra/state";
import { editor, useEditor } from "@/state/editor";

interface SliderProps {
  label: string;
  value: number;
  max: number;
  field: keyof OpeningShape;
}

function Slider({ label, value, max, field }: SliderProps) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[11px] text-zinc-400">
        {label}
        <span className="font-mono text-zinc-200">{value.toFixed(2)} m</span>
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(max, 0)}
        step={0.05}
        value={value}
        onChange={(event) =>
          editor().updateSelectedOpening({ [field]: Number(event.target.value) })
        }
        className="mt-1 w-full accent-sky-500"
      />
    </label>
  );
}

function Shape({ opening, wallLength, wallHeight }: {
  opening: Opening;
  wallLength: number;
  wallHeight: number;
}) {
  return (
    <div className="mt-3 space-y-2 rounded bg-zinc-900 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Selected {opening.type}
      </p>
      <Slider label="Position" value={opening.offset} max={wallLength - opening.width} field="offset" />
      <Slider label="Width" value={opening.width} max={wallLength} field="width" />
      <Slider label="Height" value={opening.height} max={wallHeight - opening.sillHeight} field="height" />
      <Slider label="Sill" value={opening.sillHeight} max={wallHeight - opening.height} field="sillHeight" />
      <p className="text-[10px] text-zinc-600">Minimum {MIN_OPENING} m.</p>
    </div>
  );
}

const TYPES: OpeningType[] = ["door", "window"];

export function OpeningsPanel() {
  const walls = useEditor((state) => state.scene.room.walls);
  const pending = useEditor((state) => state.pendingOpening);
  const selectedRef = useEditor((state) => state.selectedOpening);

  const selectedWall = selectedRef ? walls[selectedRef.wallIndex] : undefined;
  const selected = selectedWall?.openings.find((o) => o.id === selectedRef?.id);

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
                    onClick={() =>
                      editor().selectOpening({ wallIndex: index, id: opening.id })
                    }
                    className={`flex cursor-pointer items-baseline justify-between rounded px-2 py-1 text-xs hover:bg-zinc-900 ${
                      selected?.id === opening.id
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-300"
                    }`}
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
                        onClick={(event) => {
                          event.stopPropagation();
                          editor().deleteOpening(index, opening.id);
                        }}
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

          {selected && selectedWall && (
            <Shape
              opening={selected}
              wallLength={distance(selectedWall.start, selectedWall.end)}
              wallHeight={selectedWall.height}
            />
          )}
        </>
      )}
    </section>
  );
}
