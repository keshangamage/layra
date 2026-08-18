"use client";

import { useMemo } from "react";
import { Vector2, type Side } from "three";
import { surfaceMaps, TILE_SIZE, type SurfaceKind } from "./textures";

interface SurfaceProps {
  kind: SurfaceKind;
  color: string;
  roughness?: number;
  metalness?: number;
  /** Largest world dimension of the surface, in metres. Sets the tiling density. */
  span?: number;
  /** Set when the mesh already carries UVs measured in metres. */
  worldUnits?: boolean;
  /** Multiplies the texture's own bump depth. */
  relief?: number;
  envMapIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: Side;
  flatShading?: boolean;
}

/**
 * A meshStandardMaterial carrying the procedural grain, weave, or bump for its
 * family. The albedo maps are near-white, so `color` still drives the hue.
 */
export function Surface({
  kind,
  color,
  roughness = 0.7,
  metalness = 0,
  span = 1,
  worldUnits = false,
  relief = 1,
  envMapIntensity = 1,
  transparent,
  opacity,
  emissive,
  emissiveIntensity,
  side,
  flatShading,
}: SurfaceProps) {
  const maps = useMemo(
    () => surfaceMaps(kind, (worldUnits ? 1 : Math.max(span, 0.05)) / TILE_SIZE[kind]),
    [kind, span, worldUnits],
  );
  const normalScale = useMemo(() => new Vector2(relief, relief), [relief]);

  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      map={maps?.map ?? null}
      normalMap={maps?.normalMap ?? null}
      normalScale={normalScale}
      roughnessMap={maps?.roughnessMap ?? null}
      envMapIntensity={envMapIntensity}
      transparent={transparent}
      opacity={opacity}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      side={side}
      flatShading={flatShading}
    />
  );
}
