"use client";

import { useMemo } from "react";
import type { Vec2 } from "@layra/types";
import { extrudeWalls } from "@layra/geometry";
import { useMeshGeometry } from "./useMeshGeometry";

interface WallsProps {
  polygon: Vec2[];
  height: number;
  thickness: number;
}

export function Walls({ polygon, height, thickness }: WallsProps) {
  const data = useMemo(
    () => extrudeWalls(polygon, { height, thickness }),
    [polygon, height, thickness],
  );
  const geometry = useMeshGeometry(data);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#e7e5e4" roughness={0.9} metalness={0} />
    </mesh>
  );
}
