"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2 } from "@layra/types";
import { extrudeWalls, type WallOpening } from "@layra/geometry";
import { useMeshGeometry } from "./useMeshGeometry";

interface WallsProps {
  polygon: Vec2[];
  height: number;
  thickness: number;
  openings: readonly (readonly WallOpening[])[];
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onDoubleClick?: (event: ThreeEvent<MouseEvent>) => void;
}

export function Walls({
  polygon,
  height,
  thickness,
  openings,
  onPointerDown,
  onDoubleClick,
}: WallsProps) {
  const data = useMemo(
    () => extrudeWalls(polygon, { height, thickness, openings }),
    [polygon, height, thickness, openings],
  );
  const geometry = useMeshGeometry(data);

  return (
    <mesh geometry={geometry} castShadow receiveShadow onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <meshStandardMaterial color="#e7e5e4" roughness={0.9} metalness={0} />
    </mesh>
  );
}
