"use client";

import { useMemo } from "react";
import type { Vec2 } from "@layra/types";
import { triangulateFloor } from "@layra/geometry";
import { useMeshGeometry } from "./useMeshGeometry";

interface FloorProps {
  polygon: Vec2[];
  thickness: number;
}

export function Floor({ polygon, thickness }: FloorProps) {
  const data = useMemo(
    () => triangulateFloor(polygon, thickness),
    [polygon, thickness],
  );
  const geometry = useMeshGeometry(data);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#b8a68f" roughness={0.8} metalness={0} />
    </mesh>
  );
}
