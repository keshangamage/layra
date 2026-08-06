"use client";

import {
  findCatalogItem,
  findCollisions,
  isBlocked,
  type FurnitureAlignment,
  type FurnitureDistribution,
} from "@layra/state";
import { formatLength } from "@layra/geometry";
import { useMemo } from "react";
import { editor, useEditor } from "@/state/editor";

const ACTION =
  "rounded px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent";

/** Angles are stored in radians and shown in degrees. */
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const ALIGNMENTS: { id: FurnitureAlignment; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "center-x", label: "Center X" },
  { id: "right", label: "Right" },
  { id: "front", label: "Front" },
  { id: "center-z", label: "Center Z" },
  { id: "back", label: "Back" },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}

export function SelectionPanel() {
  const placements = useEditor((state) => state.scene.placements);
  const selectedId = useEditor((state) => state.selectedId);
  const selectedIds = useEditor((state) => state.selectedIds);
  const rooms = useEditor((state) => state.scene.rooms);

  const selected = placements.find((p) => p.id === selectedId);
  const item = selected ? findCatalogItem(selected.catalogItemId) : undefined;

  const status = useMemo(() => {
    if (!selected) return null;
    const report = findCollisions(rooms, placements);
    if (isBlocked(report, selected.id)) return { label: "Clashes", tone: "text-red-400" };
    if (report.crowded.has(selected.id)) {
      return { label: "Clearance blocked", tone: "text-amber-400" };
    }
    return { label: "Fits", tone: "text-zinc-500" };
  }, [selected, rooms, placements]);

  if (selectedIds.size > 1) {
    return (
      <section className="space-y-2 border-b border-zinc-800 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Selection
          </h2>
          <span className="text-[10px] text-zinc-500">{selectedIds.size} items</span>
        </div>
        <button
          type="button"
          className={ACTION}
          onClick={() => editor().deleteSelected()}
        >
          Delete selected
        </button>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">Align</p>
          <div className="grid grid-cols-3 gap-1">
            {ALIGNMENTS.map((alignment) => (
              <button
                key={alignment.id}
                type="button"
                className={ACTION}
                onClick={() => editor().alignSelected(alignment.id)}
              >
                {alignment.label}
              </button>
            ))}
          </div>
          <p className="mb-1 mt-2 text-[10px] uppercase tracking-wide text-zinc-600">
            Distribute
          </p>
          <div className="flex gap-1">
            {(["x", "z"] as FurnitureDistribution[]).map((axis) => (
              <button
                key={axis}
                type="button"
                className={ACTION}
                onClick={() => editor().distributeSelected(axis)}
              >
                {axis === "x" ? "Horizontally" : "Vertically"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-zinc-600">Shift-click furniture to add or remove it.</p>
      </section>
    );
  }

  if (!selected || !item) return null;

  // Normalised so the readout never shows 720 degrees after repeated turns.
  const degrees = ((toDegrees(selected.rotationY) % 360) + 360) % 360;

  return (
    <section className="space-y-2 border-b border-zinc-800 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Selected
        </h2>
        {status && <span className={`text-[10px] ${status.tone}`}>{status.label}</span>}
      </div>

      <p className="text-xs font-medium text-zinc-100">{item.name}</p>

      <Row label="Position X" value={formatLength(selected.position.x)} />
      <Row label="Position Z" value={formatLength(selected.position.z)} />
      {selected.position.y > 0 && (
        <Row label="Height" value={formatLength(selected.position.y)} />
      )}

      <label className="block pt-1">
        <span className="flex items-baseline justify-between text-xs text-zinc-400">
          Rotation
          <span className="font-mono text-zinc-200">{degrees.toFixed(0)}°</span>
        </span>
        <input
          type="range"
          min={0}
          max={360}
          step={5}
          value={Math.round(degrees)}
          disabled={selected.locked}
          onChange={(event) =>
            editor().setSelectedRotation(toRadians(Number(event.target.value)))
          }
          className="mt-1 w-full accent-sky-500 disabled:opacity-40"
        />
      </label>

      <div className="flex items-center gap-1 pt-1">
        <button
          type="button"
          className={ACTION}
          onClick={() => editor().toggleSelectedLock()}
        >
          {selected.locked ? "Unlock" : "Lock"}
        </button>
        <button
          type="button"
          className={ACTION}
          disabled={selected.locked}
          title="Duplicate (Cmd+D)"
          onClick={() => editor().duplicateSelected()}
        >
          Duplicate
        </button>
        <button
          type="button"
          className={ACTION}
          disabled={selected.locked}
          title="Delete"
          onClick={() => editor().deleteSelected()}
        >
          Delete
        </button>
      </div>

      {selected.locked && (
        <p className="text-[10px] text-zinc-600">
          Locked pieces cannot be moved, rotated or deleted.
        </p>
      )}
    </section>
  );
}
