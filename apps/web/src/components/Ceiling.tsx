"use client";

import { useMemo } from "react";
import type { CeilingMaterial, Vec2 } from "@layra/types";
import { triangulatePolygon } from "@layra/geometry";
import { DoubleSide } from "three";
import { CEILING_FINISHES } from "./finishes";
import { Surface } from "./Surface";
import { useMeshGeometry } from "./useMeshGeometry";

interface CeilingProps {
  polygon: Vec2[];
  height: number;
  material?: CeilingMaterial;
}

export function Ceiling({ polygon, height, material = "painted" }: CeilingProps) {
  const data = useMemo(() => triangulatePolygon(polygon), [polygon]);
  const geometry = useMeshGeometry(data);
  const finish = CEILING_FINISHES[material];

  if (polygon.length < 3) return null;
  return (
    <mesh geometry={geometry} position={[0, height, 0]} receiveShadow>
      <Surface
        kind={finish.kind}
        color={finish.color}
        roughness={finish.roughness}
        worldUnits
        side={DoubleSide}
        weathering={0.07}
        envMapIntensity={0.7}
      />
    </mesh>
  );
}
