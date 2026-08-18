"use client";

import { useMemo } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { Color } from "three";
import type { LightingPreset } from "@layra/state";

interface EnvConfig {
  sky: string;
  skyIntensity: number;
  ground: string;
  groundIntensity: number;
  window: string;
  windowIntensity: number;
  warmLamp: string;
  warmLampIntensity: number;
}

const ENVIRONMENTS: Record<LightingPreset, EnvConfig> = {
  daylight: {
    sky: "#e8f0fa",
    skyIntensity: 1.1,
    ground: "#8c8073",
    groundIntensity: 0.5,
    window: "#fffdf6",
    windowIntensity: 5,
    warmLamp: "#ffd9a8",
    warmLampIntensity: 0.35,
  },
  warm: {
    sky: "#3a2f2a",
    skyIntensity: 0.5,
    ground: "#6b5442",
    groundIntensity: 0.45,
    window: "#ffcf99",
    windowIntensity: 2.6,
    warmLamp: "#ffb063",
    warmLampIntensity: 2.4,
  },
  studio: {
    sky: "#eef2f8",
    skyIntensity: 1.4,
    ground: "#b9bcc2",
    groundIntensity: 0.8,
    window: "#ffffff",
    windowIntensity: 4,
    warmLamp: "#d8e4ff",
    warmLampIntensity: 1.6,
  },
};

/** Blends toward a finish without letting it take over the whole bounce. */
function tint(base: string, finish: string, amount: number): string {
  return `#${new Color(base).lerp(new Color(finish), amount).getHexString()}`;
}

/**
 * A room-shaped image-based light built from emissive panels, baked once into a
 * cube map. No HDR fetch, so it works offline - and it is what gives surfaces
 * real specular falloff instead of a flat shaded tint.
 *
 * The bounce panels take the room's own floor and wall colours, so a walnut
 * floor throws back dark warm light and brick walls throw back red, rather than
 * every room reflecting the same neutral box.
 */
export function RoomEnvironment({
  preset,
  floorColor,
  wallColor,
}: {
  preset: LightingPreset;
  floorColor: string;
  wallColor: string;
}) {
  const env = ENVIRONMENTS[preset];
  // Partial, not wholesale: at full weight a walnut floor turns every gloss
  // surface in the room bronze, mirrors worst of all.
  const ground = useMemo(() => tint(env.ground, floorColor, 0.6), [env.ground, floorColor]);
  const bounce = useMemo(() => tint(env.ground, wallColor, 0.5), [env.ground, wallColor]);

  return (
    <Environment key={`${preset}|${ground}|${bounce}`} resolution={128} frames={1}>
      <Lightformer
        form="rect"
        intensity={env.skyIntensity}
        color={env.sky}
        scale={[30, 30, 1]}
        position={[0, 10, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={env.groundIntensity}
        color={ground}
        scale={[30, 30, 1]}
        position={[0, -8, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      {/* The window wall. A tall bright rectangle is what makes gloss read as glass. */}
      <Lightformer
        form="rect"
        intensity={env.windowIntensity}
        color={env.window}
        scale={[5, 7, 1]}
        position={[-9, 3, 1]}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <Lightformer
        form="rect"
        intensity={env.windowIntensity * 0.35}
        color={env.window}
        scale={[7, 4, 1]}
        position={[3, 4, -9]}
        rotation={[0, 0, 0]}
      />
      <Lightformer
        form="ring"
        intensity={env.warmLampIntensity}
        color={env.warmLamp}
        scale={[4, 4, 1]}
        position={[6, 5, 5]}
        rotation={[0, Math.PI, 0]}
      />
      {/* Opposite wall bounce, so shadowed sides never go dead flat. */}
      <Lightformer
        form="rect"
        intensity={env.skyIntensity * 0.4}
        color={bounce}
        scale={[14, 8, 1]}
        position={[9, 3, 2]}
        rotation={[0, Math.PI / 2, 0]}
      />
    </Environment>
  );
}
