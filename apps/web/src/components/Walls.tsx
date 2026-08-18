"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2, Wall, WallMaterial } from "@layra/types";
import { extrudeWalls, type WallOpening } from "@layra/geometry";
import { Surface } from "./Surface";
import type { SurfaceKind } from "./textures";
import { useMeshGeometry } from "./useMeshGeometry";

interface WallsProps {
  polygon: Vec2[];
  height: number;
  thickness: number;
  openings: readonly (readonly WallOpening[])[];
  walls: readonly Wall[];
  wallMaterial?: WallMaterial;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onDoubleClick?: (event: ThreeEvent<MouseEvent>) => void;
}

export function Walls({
  polygon,
  height,
  thickness,
  openings,
  walls,
  wallMaterial = "plaster",
  onPointerDown,
  onDoubleClick,
}: WallsProps) {
  const data = useMemo(
    () => extrudeWalls(polygon, { height, thickness, openings }),
    [polygon, height, thickness, openings],
  );
  const geometry = useMeshGeometry(data);
  const finishes: Record<WallMaterial, { color: string; roughness: number; kind: SurfaceKind; relief: number }> = {
    plaster: { color: "#e7e5e4", roughness: 0.92, kind: "plaster", relief: 1 },
    "warm-white": { color: "#f1eadf", roughness: 0.82, kind: "plaster", relief: 0.8 },
    concrete: { color: "#9b9a96", roughness: 0.96, kind: "concrete", relief: 1.2 },
    brick: { color: "#9a5c47", roughness: 0.9, kind: "brick", relief: 1.6 },
  };
  const finish = finishes[wallMaterial];

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
              <Surface
                kind={finish.kind}
                color={finish.color}
                roughness={finish.roughness}
                span={Math.max(length, wall.height)}
                relief={finish.relief}
                envMapIntensity={0.85}
              />
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
      <Surface
        kind={finish.kind}
        color={finish.color}
        roughness={finish.roughness}
        worldUnits
        relief={finish.relief}
        envMapIntensity={0.85}
      />
    </mesh>
  );
}
