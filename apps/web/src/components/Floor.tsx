"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2 } from "@layra/types";
import { triangulateFloor } from "@layra/geometry";
import { findFloorMaterial } from "@layra/state";
import { Surface } from "./Surface";
import type { SurfaceKind } from "./textures";
import { useMeshGeometry } from "./useMeshGeometry";

interface FloorProps {
  polygon: Vec2[];
  thickness: number;
  material: string;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}

const FLOOR_TEXTURE: Record<string, SurfaceKind> = {
  default: "plaster",
  oak: "floorboard",
  walnut: "floorboard",
  concrete: "concrete",
  tile: "tile",
  carpet: "carpet",
};

export function Floor({ polygon, thickness, material, onPointerDown }: FloorProps) {
  const finish = findFloorMaterial(material);
  const data = useMemo(
    () => triangulateFloor(polygon, thickness),
    [polygon, thickness],
  );
  const geometry = useMeshGeometry(data);

  return (
    <mesh geometry={geometry} receiveShadow onPointerDown={onPointerDown}>
      <Surface
        kind={FLOOR_TEXTURE[finish.id] ?? "plaster"}
        color={finish.color}
        roughness={finish.roughness}
        worldUnits
        relief={finish.id === "carpet" ? 1.6 : 1}
        envMapIntensity={finish.id === "tile" ? 1.4 : 0.9}
      />
    </mesh>
  );
}
