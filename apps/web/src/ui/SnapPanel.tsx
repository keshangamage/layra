"use client";

import { editor, useEditor } from "@/state/editor";

const GRID_STEPS = [0.05, 0.1, 0.25, 0.5];
const ANGLE_STEPS = [5, 15, 30, 45];

const BUTTON =
  "flex-1 rounded px-1 py-1 text-[11px] font-medium transition-colors";

export function SnapPanel() {
  const grid = useEditor((state) => state.snap.grid);
  const angle = useEditor((state) => state.snap.angle);
  const angleDegrees = Math.round((angle * 180) / Math.PI);

  return (
    <section className="space-y-3 border-b border-zinc-800 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Snapping
      </h2>

      <div>
        <span className="text-xs text-zinc-400">Grid</span>
        <div className="mt-1 flex gap-1">
          {GRID_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => editor().setSnap({ grid: step })}
              className={`${BUTTON} ${
                grid === step
                  ? "bg-zinc-700 text-zinc-50"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {step < 1 ? `${step * 100}cm` : `${step}m`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs text-zinc-400">Angle</span>
        <div className="mt-1 flex gap-1">
          {ANGLE_STEPS.map((degrees) => (
            <button
              key={degrees}
              type="button"
              onClick={() => editor().setSnap({ angle: (degrees * Math.PI) / 180 })}
              className={`${BUTTON} ${
                angleDegrees === degrees
                  ? "bg-zinc-700 text-zinc-50"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {degrees}°
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-zinc-600">
        Arrow keys nudge the selection by one grid step, Shift for ten.
      </p>
    </section>
  );
}
