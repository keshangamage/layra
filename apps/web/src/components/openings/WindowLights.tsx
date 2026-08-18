"use client";

import { useEffect } from "react";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { LightingPreset } from "@layra/state";
import { useEditor } from "@/state/editor";

export interface WindowLight {
  key: string;
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
}

/**
 * Each rect area light adds to NUM_RECT_AREA_LIGHTS and so to every lit
 * shader. The largest few windows carry the look; the rest would cost more
 * than they show.
 */
const MAX_LIGHTS = 6;

const DAYLIGHT: Record<LightingPreset, { colour: string; intensity: number }> = {
  daylight: { colour: "#eaf2ff", intensity: 5 },
  warm: { colour: "#ffd0a0", intensity: 2.2 },
  studio: { colour: "#f2f6ff", intensity: 3.5 },
};

/**
 * Soft daylight pouring in at each window. Rect area lights cast no shadow, so
 * this is fill only - the directional key still draws the hard sun patch
 * through the same hole.
 */
export function WindowLights({ windows }: { windows: WindowLight[] }) {
  const preset = useEditor((state) => state.lightingPreset);
  const { colour, intensity } = DAYLIGHT[preset];

  useEffect(() => {
    // Rect area lights render black until their LTC lookup tables are loaded.
    RectAreaLightUniformsLib.init();
  }, []);

  const lit = [...windows]
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, MAX_LIGHTS);

  return (
    <group>
      {lit.map((window) => (
        <rectAreaLight
          key={window.key}
          position={window.position}
          // Emits along local +Z, which openingTransform already aims into the room.
          rotation={[0, window.rotationY, 0]}
          width={window.width * 0.95}
          height={window.height * 0.95}
          color={colour}
          intensity={intensity}
        />
      ))}
    </group>
  );
}
