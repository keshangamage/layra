"use client";

import { currentWallSettings } from "@layra/state";
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
      <Slider
        label="Thickness"
        value={thickness}
        min={0.05}
        max={0.6}
        step={0.01}
        onChange={(value) => editor().applyWallSettings({ thickness: value })}
        disabled={locked}
      />
    </section>
  );
}
