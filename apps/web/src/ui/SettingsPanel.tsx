"use client";

interface SettingsPanelProps {
  wallHeight: number;
  wallThickness: number;
  onWallHeightChange: (value: number) => void;
  onWallThicknessChange: (value: number) => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
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
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-zinc-400"
      />
    </label>
  );
}

export function SettingsPanel({
  wallHeight,
  wallThickness,
  onWallHeightChange,
  onWallThicknessChange,
}: SettingsPanelProps) {
  return (
    <section className="space-y-4 border-b border-zinc-800 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Walls
      </h2>
      <Slider
        label="Height"
        value={wallHeight}
        min={1.8}
        max={4}
        step={0.05}
        onChange={onWallHeightChange}
      />
      <Slider
        label="Thickness"
        value={wallThickness}
        min={0.05}
        max={0.6}
        step={0.01}
        onChange={onWallThicknessChange}
      />
    </section>
  );
}
