"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2 } from "@layra/types";
import { triangulateFloor } from "@layra/geometry";
import { findFloorMaterial } from "@layra/state";
import { useMeshGeometry } from "./useMeshGeometry";

interface FloorProps {
  polygon: Vec2[];
  thickness: number;
  material: string;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}

export function Floor({ polygon, thickness, material, onPointerDown }: FloorProps) {
  const finish = findFloorMaterial(material);
  const data = useMemo(
    () => triangulateFloor(polygon, thickness),
    [polygon, thickness],
  );
  const geometry = useMeshGeometry(data);

  return (
    <mesh geometry={geometry} receiveShadow onPointerDown={onPointerDown}>
      <meshStandardMaterial
        color={finish.color}
        roughness={finish.roughness}
        metalness={0}
      />
    </mesh>
  );
}
