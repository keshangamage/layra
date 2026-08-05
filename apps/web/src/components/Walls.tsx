"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2, Wall } from "@layra/types";
import { extrudeWalls, type WallOpening } from "@layra/geometry";
import { useMeshGeometry } from "./useMeshGeometry";

interface WallsProps {
  polygon: Vec2[];
  height: number;
  thickness: number;
  openings: readonly (readonly WallOpening[])[];
  walls: readonly Wall[];
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onDoubleClick?: (event: ThreeEvent<MouseEvent>) => void;
}

export function Walls({
  polygon,
  height,
  thickness,
  openings,
  walls,
  onPointerDown,
  onDoubleClick,
}: WallsProps) {
  const data = useMemo(
    () => extrudeWalls(polygon, { height, thickness, openings }),
    [polygon, height, thickness, openings],
  );
  const geometry = useMeshGeometry(data);

  if (polygon.length < 3) {
    return (
      <group>
        {walls.map((wall) => {
          const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
          return (
            <mesh
              key={wall.id}
              position={[(wall.start.x + wall.end.x) / 2, wall.height / 2, (wall.start.z + wall.end.z) / 2]}
              rotation={[0, Math.atan2(-(wall.end.z - wall.start.z), wall.end.x - wall.start.x), 0]}
              castShadow
              receiveShadow
              onPointerDown={onPointerDown}
              onDoubleClick={onDoubleClick}
            >
              <boxGeometry args={[length, wall.height, wall.thickness]} />
              <meshStandardMaterial color="#e7e5e4" roughness={0.9} />
            </mesh>
          );
        })}
      </group>
    );
  }
  return (
    <mesh geometry={geometry} castShadow receiveShadow onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <meshStandardMaterial color="#e7e5e4" roughness={0.9} metalness={0} />
    </mesh>
  );
}
