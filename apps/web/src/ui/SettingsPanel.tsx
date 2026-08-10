"use client";

import { currentWallSettings } from "@layra/state";
import type { WallMaterial } from "@layra/state";
import { editor, useEditor } from "@/state/editor";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, disabled, onChange }: SliderProps) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs text-zinc-400">
        {label}
        <span className="font-mono text-zinc-200">{value.toFixed(2)} m</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-zinc-400 disabled:opacity-40"
      />
    </label>
  );
}

export function SettingsPanel() {
  // Selected as primitives; currentWallSettings returns a fresh object each call.
  const height = useEditor((state) => currentWallSettings(state).height);
  const thickness = useEditor((state) => currentWallSettings(state).thickness);
  const locked = useEditor((state) => state.scene.rooms[state.activeRoomIndex]?.locked === true);
  const lightingPreset = useEditor((state) => state.lightingPreset);
  const wallMaterial = useEditor((state) => state.scene.rooms[state.activeRoomIndex]?.wallMaterial ?? "plaster");

  return (
    <section className="space-y-4 border-b border-zinc-800 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Walls
      </h2>
      <Slider
        label="Height"
        value={height}
        min={1.8}
        max={4}
        step={0.05}
        onChange={(value) => editor().applyWallSettings({ height: value })}
        disabled={locked}
      />
      <label className="block">
        <span className="text-xs text-zinc-400">Wall finish</span>
        <select
          value={wallMaterial}
          disabled={locked}
          onChange={(event) => editor().applyWallMaterial(event.target.value as WallMaterial)}
          className="mt-1.5 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-40"
        >
          <option value="plaster">Plaster</option>
          <option value="warm-white">Warm white</option>
          <option value="concrete">Concrete</option>
          <option value="brick">Brick</option>
        </select>
      </label>
      <Slider
        label="Thickness"
        value={thickness}
        min={0.05}
        max={0.6}
        step={0.01}
        onChange={(value) => editor().applyWallSettings({ thickness: value })}
        disabled={locked}
      />
      <div className="border-t border-zinc-800 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Lighting
        </h2>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {(["daylight", "warm", "studio"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => editor().setLightingPreset(preset)}
              className={`rounded px-1 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                lightingPreset === preset
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          Choose the mood for the 3D preview.
        </p>
      </div>
    </section>
  );
}
