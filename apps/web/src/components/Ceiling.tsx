"use client";

import { useMemo } from "react";
import type { CeilingMaterial, Vec2 } from "@layra/types";
import { triangulatePolygon } from "@layra/geometry";
import { DoubleSide } from "three";
import { Surface } from "./Surface";
import type { SurfaceKind } from "./textures";
import { useMeshGeometry } from "./useMeshGeometry";

interface CeilingProps {
  polygon: Vec2[];
  height: number;
  material?: CeilingMaterial;
}

export function Ceiling({ polygon, height, material = "painted" }: CeilingProps) {
  const data = useMemo(() => triangulatePolygon(polygon), [polygon]);
  const geometry = useMeshGeometry(data);
  const finishes: Record<CeilingMaterial, { color: string; roughness: number; kind: SurfaceKind }> = {
    painted: { color: "#f3eee4", roughness: 0.88, kind: "plaster" },
    wood: { color: "#8b684b", roughness: 0.62, kind: "floorboard" },
    concrete: { color: "#92918c", roughness: 0.96, kind: "concrete" },
  };
  const finish = finishes[material];

  if (polygon.length < 3) return null;
  return (
    <mesh geometry={geometry} position={[0, height, 0]} receiveShadow>
      <Surface
        kind={finish.kind}
        color={finish.color}
        roughness={finish.roughness}
        worldUnits
        side={DoubleSide}
        envMapIntensity={0.7}
      />
    </mesh>
  );
}
