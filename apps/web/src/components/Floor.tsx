"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec2 } from "@layra/types";
import { triangulateFloor } from "@layra/geometry";
import { findFloorMaterial } from "@layra/state";
import { FLOOR_TEXTURE } from "./finishes";
import { Surface } from "./Surface";
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
      <Surface
        kind={FLOOR_TEXTURE[finish.id] ?? "plaster"}
        color={finish.color}
        roughness={finish.roughness}
        worldUnits
        relief={finish.id === "carpet" ? 1.6 : 1}
        weathering={0.16}
        envMapIntensity={finish.id === "tile" ? 1.4 : 0.9}
      />
    </mesh>
  );
}
