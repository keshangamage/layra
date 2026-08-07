"use client";

import { useEffect, useMemo, useState } from "react";
import { RoundedBox } from "@react-three/drei";
import {
  clearanceRect,
  findCatalogItem,
  findCollisions,
  isBlocked,
  placementsInRoom,
} from "@layra/state";
import type { Rect } from "@layra/geometry";
import type { Placement } from "@layra/types";
import { editor, useEditor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

interface PieceProps {
  placement: Placement;
  selected: boolean;
  blocked: boolean;
  crowded: boolean;
  onGrab: (id: string, event: PointerEvent) => void;
  onHover: (hovering: boolean) => void;
}

function colourFor(selected: boolean, blocked: boolean, crowded: boolean): string {
  if (blocked) return selected ? "#f87171" : "#dc2626";
  if (crowded) return selected ? "#fbbf24" : "#b45309";
  return selected ? "#38bdf8" : "#8b7355";
}

function Box({
  size,
  position,
  color,
  metalness = 0,
  roughness = 0.7,
  radius,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  metalness?: number;
  roughness?: number;
  radius?: number;
}) {
  const bevel = radius ?? Math.min(0.025, size[0] / 7, size[1] / 5, size[2] / 7);
  return (
    <RoundedBox
      args={size}
      position={position}
      radius={bevel}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </RoundedBox>
  );
}

function Leg({ position, height = 0.65, color = "#3f3028" }: { position: [number, number, number]; height?: number; color?: string }) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.035, 0.045, height, 8]} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  );
}

function Cushion({
  size,
  position,
  color,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
}) {
  return <Box size={size} position={position} color={color} roughness={0.92} radius={0.06} />;
}

function FurnitureModel({ item }: { item: NonNullable<ReturnType<typeof findCatalogItem>> }) {
  const { w, d } = item.footprint;
  const h = item.height;
  const wood = "#8b5e3c";
  const darkWood = "#4b3025";
  const fabric = item.id === "armchair" ? "#64748b" : "#5f6f52";
  const metal = "#71717a";

  switch (item.id) {
    case "sofa-3":
      return (
        <group>
          <Box size={[w - 0.1, 0.18, d - 0.08]} position={[0, 0.19, 0]} color={darkWood} roughness={0.5} radius={0.04} />
          <Box size={[w - 0.1, 0.43, 0.16]} position={[0, 0.65, d * 0.39]} color={fabric} roughness={0.94} radius={0.07} />
          <Box size={[0.18, 0.43, d * 0.86]} position={[-w / 2 + 0.1, 0.46, 0]} color={fabric} roughness={0.94} radius={0.07} />
          <Box size={[0.18, 0.43, d * 0.86]} position={[w / 2 - 0.1, 0.46, 0]} color={fabric} roughness={0.94} radius={0.07} />
          {[-w / 3, 0, w / 3].map((x) => (
            <Cushion key={x} size={[w / 3 - 0.11, 0.14, d * 0.57]} position={[x, 0.43, d * 0.01]} color="#72815f" />
          ))}
          <Cushion size={[0.34, 0.12, 0.28]} position={[-w * 0.27, 0.72, d * 0.17]} color="#c4a17d" />
          <Cushion size={[0.3, 0.12, 0.24]} position={[w * 0.26, 0.72, d * 0.18]} color="#526173" />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg key={`${x}-${z}`} position={[x * (w / 2 - 0.16), 0.09, z * (d / 2 - 0.13)]} height={0.18} color="#2f2924" />
          )))}
        </group>
      );
    case "armchair":
      return (
        <group>
          <Box size={[w - 0.08, 0.16, d - 0.08]} position={[0, 0.18, 0]} color={darkWood} roughness={0.5} radius={0.04} />
          <Cushion size={[w - 0.22, 0.17, d * 0.6]} position={[0, 0.42, d * 0.02]} color="#6b7a8a" />
          <Box size={[w - 0.12, 0.46, 0.16]} position={[0, 0.66, d * 0.38]} color="#6b7a8a" roughness={0.94} radius={0.07} />
          <Box size={[0.16, 0.42, d * 0.82]} position={[-w / 2 + 0.09, 0.47, 0]} color="#6b7a8a" roughness={0.94} radius={0.07} />
          <Box size={[0.16, 0.42, d * 0.82]} position={[w / 2 - 0.09, 0.47, 0]} color="#6b7a8a" roughness={0.94} radius={0.07} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg key={`${x}-${z}`} position={[x * (w / 2 - 0.13), 0.09, z * (d / 2 - 0.13)]} height={0.18} color="#2f2924" />
          )))}
        </group>
      );
    case "bed-double":
      return (
        <group>
          <Box size={[w - 0.06, 0.2, d - 0.08]} position={[0, 0.18, 0]} color={darkWood} roughness={0.48} radius={0.04} />
          <Box size={[w - 0.12, 0.26, d - 0.15]} position={[0, 0.4, -0.02]} color="#d9cbb8" roughness={0.9} radius={0.06} />
          <Box size={[w - 0.16, 0.035, d * 0.48]} position={[0, 0.55, d * 0.17]} color="#9a7868" roughness={0.94} radius={0.02} />
          <Cushion size={[w * 0.41, 0.11, d * 0.2]} position={[-w * 0.22, 0.58, -d * 0.29]} color="#f1e8dc" />
          <Cushion size={[w * 0.41, 0.11, d * 0.2]} position={[w * 0.22, 0.58, -d * 0.29]} color="#f1e8dc" />
          <Box size={[w, 0.86, 0.13]} position={[0, 0.53, d / 2 - 0.065]} color={darkWood} roughness={0.48} radius={0.05} />
          <Box size={[w - 0.14, 0.58, 0.025]} position={[0, 0.56, d / 2 - 0.14]} color="#b49478" roughness={0.8} radius={0.01} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg key={`${x}-${z}`} position={[x * (w / 2 - 0.12), 0.1, z * (d / 2 - 0.12)]} height={0.2} />
          )))}
        </group>
      );
    case "dining-table":
      return (
        <group>
          <Box size={[w, 0.12, d]} position={[0, h - 0.07, 0]} color={wood} roughness={0.42} radius={0.035} />
          <Box size={[w - 0.12, 0.09, d - 0.12]} position={[0, h - 0.15, 0]} color={darkWood} roughness={0.5} radius={0.015} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg key={`${x}-${z}`} position={[x * (w / 2 - 0.13), h / 2 - 0.08, z * (d / 2 - 0.13)]} color={darkWood} />
          )))}
          {[-w * 0.26, 0, w * 0.26].map((x) => (
            <mesh key={x} position={[x, h + 0.006, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.018, 20]} />
              <meshStandardMaterial color="#e9e4da" roughness={0.36} />
            </mesh>
          ))}
        </group>
      );
    case "dining-chair":
      return (
        <group>
          <Box size={[w - 0.05, 0.09, d - 0.05]} position={[0, 0.48, 0]} color={wood} roughness={0.5} radius={0.025} />
          <Cushion size={[w - 0.12, 0.08, d - 0.14]} position={[0, 0.56, -0.01]} color="#7d8b78" />
          <Box size={[w - 0.08, 0.44, 0.09]} position={[0, 0.78, d / 2 - 0.05]} color={wood} roughness={0.5} radius={0.025} />
          <Box size={[w - 0.15, 0.24, 0.04]} position={[0, 0.77, d / 2 - 0.105]} color="#72815f" roughness={0.94} radius={0.02} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg key={`${x}-${z}`} position={[x * (w / 2 - 0.08), 0.24, z * (d / 2 - 0.08)]} color={darkWood} />
          )))}
        </group>
      );
    case "desk":
      return (
        <group>
          <Box size={[w, 0.1, d]} position={[0, h - 0.055, 0]} color={wood} roughness={0.42} radius={0.025} />
          <Box size={[w - 0.1, 0.07, d - 0.12]} position={[0, h - 0.12, 0]} color={darkWood} roughness={0.5} radius={0.015} />
          {[-1, 1].map((x) => (
            <Leg key={x} position={[x * (w / 2 - 0.1), (h - 0.14) / 2, d * 0.3]} height={h - 0.14} color="#3d3a35" />
          ))}
          <Box size={[w * 0.28, h * 0.62, d * 0.68]} position={[-w * 0.31, h * 0.35, d * 0.1]} color="#5a4031" roughness={0.58} radius={0.025} />
          {[0.24, 0.43].map((y) => (
            <group key={y}>
              <Box size={[w * 0.23, 0.016, 0.022]} position={[-w * 0.31, y, -d * 0.25]} color="#2c2520" radius={0.004} />
              <Box size={[w * 0.1, 0.018, 0.02]} position={[-w * 0.31, y + 0.06, -d * 0.28]} color={metal} metalness={0.7} roughness={0.28} radius={0.004} />
            </group>
          ))}
          <Box size={[w * 0.42, 0.035, d * 0.52]} position={[w * 0.12, h + 0.02, -d * 0.06]} color="#26343c" roughness={0.84} radius={0.015} />
          <Box size={[w * 0.29, h * 0.31, 0.025]} position={[w * 0.12, h + h * 0.2, d * 0.05]} color="#151a1e" roughness={0.38} radius={0.02} />
          <Box size={[0.035, h * 0.17, 0.035]} position={[w * 0.12, h + h * 0.04, d * 0.05]} color="#343b42" metalness={0.65} roughness={0.25} radius={0.008} />
        </group>
      );
    case "wardrobe":
      return (
        <group>
          <Box size={[w, h, d]} position={[0, h / 2, 0]} color={wood} roughness={0.46} radius={0.035} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Box size={[w * 0.43, h * 0.86, 0.028]} position={[side * w * 0.235, h * 0.5, -d / 2 - 0.018]} color="#9d704c" roughness={0.5} radius={0.015} />
              <Box size={[w * 0.34, h * 0.72, 0.012]} position={[side * w * 0.235, h * 0.5, -d / 2 - 0.037]} color="#805b41" roughness={0.55} radius={0.008} />
            </group>
          ))}
          <Box size={[0.025, h * 0.82, 0.02]} position={[0, h * 0.5, -d / 2 - 0.045]} color={darkWood} />
          <mesh position={[-0.08, h * 0.5, -d / 2 - 0.03]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.08, h * 0.5, -d / 2 - 0.03]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );
    case "bookshelf":
      return (
        <group>
          <Box size={[w, 0.08, d]} position={[0, 0.04, 0]} color={wood} roughness={0.52} />
          <Box size={[0.08, h, d]} position={[-w / 2 + 0.04, h / 2, 0]} color={wood} roughness={0.52} />
          <Box size={[0.08, h, d]} position={[w / 2 - 0.04, h / 2, 0]} color={wood} roughness={0.52} />
          {[0.35, 0.8, 1.25, 1.7].filter((y) => y < h).map((y) => (
            <group key={y}>
              <Box size={[w - 0.08, 0.07, d]} position={[0, y, 0]} color={wood} roughness={0.52} />
              {[-0.22, -0.1, 0.04, 0.18].map((x, index) => (
                <Box
                  key={x}
                  size={[0.08, 0.2 + (index % 2) * 0.05, d * 0.45]}
                  position={[x, y + 0.14, -d * 0.16]}
                  color={["#a4523b", "#667558", "#3f5870", "#b58a48"][index]!}
                  roughness={0.78}
                  radius={0.008}
                />
              ))}
            </group>
          ))}
        </group>
      );
    case "wall-shelf":
      return (
        <group>
          <Box size={[w, 0.08, d]} position={[0, h * 0.5, 0]} color={wood} />
          <Box size={[w * 0.75, 0.05, 0.05]} position={[0, h * 0.35, d / 2 - 0.02]} color={darkWood} />
        </group>
      );
    case "coffee-table":
      return (
        <group>
          <Box size={[w, 0.1, d]} position={[0, h - 0.05, 0]} color={wood} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg
              key={`${x}-${z}`}
              height={h - 0.1}
              position={[x * (w / 2 - 0.1), (h - 0.1) / 2, z * (d / 2 - 0.1)]}
              color={darkWood}
            />
          )))}
        </group>
      );
    case "tv-stand":
      return (
        <group>
          <Box size={[w, h * 0.72, d]} position={[0, h * 0.42, 0]} color={darkWood} roughness={0.5} radius={0.025} />
          <Box size={[w - 0.08, 0.06, d + 0.03]} position={[0, h * 0.8, 0]} color={wood} roughness={0.42} radius={0.02} />
          <Box size={[w * 0.65, h * 0.48, 0.045]} position={[0, h * 0.67, -d / 2 - 0.03]} color="#15191c" roughness={0.28} radius={0.02} />
          <Box size={[w * 0.58, h * 0.4, 0.012]} position={[0, h * 0.67, -d / 2 - 0.058]} color="#30475a" metalness={0.2} roughness={0.18} radius={0.01} />
          {[-0.28, 0.28].map((x) => (
            <Box key={x} size={[w * 0.22, h * 0.28, 0.02]} position={[x * w, h * 0.28, -d / 2 - 0.022]} color="#76533d" roughness={0.55} radius={0.012} />
          ))}
          <Box size={[0.04, 0.04, 0.04]} position={[-w * 0.3, h * 0.35, -d / 2 - 0.03]} color={metal} />
          <Box size={[0.04, 0.04, 0.04]} position={[w * 0.3, h * 0.35, -d / 2 - 0.03]} color={metal} />
        </group>
      );
    case "floor-lamp":
      return (
        <group>
          <mesh position={[0, 0.025, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.18, 0.05, 16]} />
            <meshStandardMaterial color={metal} metalness={0.65} roughness={0.3} />
          </mesh>
          <mesh position={[0, h * 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, h - 0.2, 10]} />
            <meshStandardMaterial color={metal} metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, h - 0.12, 0]} castShadow>
            <coneGeometry args={[0.18, 0.24, 16, 1, true]} />
            <meshStandardMaterial color="#d8b68a" roughness={0.8} side={2} />
          </mesh>
        </group>
      );
    case "plant":
      return (
        <group>
          <mesh position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.12, 0.3, 12]} />
            <meshStandardMaterial color="#b45335" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.035, 0.95, 8]} />
            <meshStandardMaterial color="#365b3d" roughness={0.9} />
          </mesh>
          {([
            [-0.13, 0.82, 0.02, 0.45, 0.12, 0.18],
            [0.13, 0.96, -0.02, 0.4, 0.11, 0.16],
            [-0.08, 1.08, 0.03, 0.35, 0.1, 0.15],
            [0.08, 1.16, -0.02, 0.3, 0.09, 0.14],
          ] as [number, number, number, number, number, number][]).map(([x, y, z, sx, sy, sz], index) => (
            <mesh key={index} position={[x, y, z]} scale={[sx, sy, sz]} castShadow>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={index % 2 ? "#4f7f52" : "#668d5a"} roughness={0.9} />
            </mesh>
          ))}
        </group>
      );
    case "rug":
      return (
        <group>
          <Box size={[w, h, d]} position={[0, h / 2, 0]} color="#9a7b62" roughness={0.96} radius={0.035} />
          <Box size={[w - 0.12, 0.008, 0.035]} position={[0, h + 0.006, -d / 2 + 0.07]} color="#d2b48c" />
          <Box size={[w - 0.12, 0.008, 0.035]} position={[0, h + 0.006, d / 2 - 0.07]} color="#d2b48c" />
          <Box size={[0.035, 0.008, d - 0.12]} position={[-w / 2 + 0.07, h + 0.006, 0]} color="#d2b48c" />
          <Box size={[0.035, 0.008, d - 0.12]} position={[w / 2 - 0.07, h + 0.006, 0]} color="#d2b48c" />
          {[-0.25, 0, 0.25].map((x) => (
            <Box key={x} size={[0.025, 0.006, d * 0.56]} position={[x * w, h + 0.008, 0]} color="#d2b48c" radius={0.004} />
          ))}
        </group>
      );
    case "kitchen-island":
      return (
        <group>
          <Box size={[w, h - 0.12, d]} position={[0, (h - 0.12) / 2, 0]} color="#d6c7b2" />
          <Box size={[w + 0.08, 0.12, d + 0.08]} position={[0, h - 0.06, 0]} color="#8b6a4d" />
          <Box size={[w * 0.35, 0.018, d * 0.5]} position={[-w * 0.2, h + 0.004, 0]} color="#475569" />
          <Box size={[w * 0.35, 0.018, d * 0.5]} position={[w * 0.2, h + 0.004, 0]} color="#475569" />
          <Box size={[0.035, 0.035, 0.035]} position={[-w * 0.25, h * 0.45, -d / 2 - 0.02]} color={metal} />
          <Box size={[0.035, 0.035, 0.035]} position={[w * 0.25, h * 0.45, -d / 2 - 0.02]} color={metal} />
        </group>
      );
    case "nightstand":
      return (
        <group>
          <Box size={[w, h * 0.82, d]} position={[0, h * 0.41, 0]} color={wood} />
          <Box size={[w + 0.04, 0.07, d + 0.04]} position={[0, h * 0.85, 0]} color={darkWood} />
          <Box size={[w * 0.65, 0.04, 0.02]} position={[0, h * 0.55, -d / 2 - 0.025]} color={metal} metalness={0.65} />
          <Leg position={[-w / 2 + 0.06, 0.05, -d / 2 + 0.06]} height={0.1} />
          <Leg position={[w / 2 - 0.06, 0.05, -d / 2 + 0.06]} height={0.1} />
        </group>
      );
    case "dresser":
      return (
        <group>
          <Box size={[w, h, d]} position={[0, h / 2, 0]} color={wood} />
          {[0.24, 0.48, 0.72].map((y) => (
            <group key={y}>
              <Box size={[w - 0.08, 0.018, 0.02]} position={[0, y, -d / 2 - 0.025]} color={darkWood} />
              <mesh position={[0, y + 0.04, -d / 2 - 0.04]}>
                <sphereGeometry args={[0.025, 10, 8]} />
                <meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "bench":
      return (
        <group>
          <Box size={[w, 0.16, d]} position={[0, h - 0.08, 0]} color={fabric} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg key={`${x}-${z}`} height={h - 0.16} position={[x * (w / 2 - 0.12), (h - 0.16) / 2, z * (d / 2 - 0.1)]} />
          )))}
        </group>
      );
    case "ottoman":
      return (
        <group>
          <Box size={[w, h * 0.82, d]} position={[0, h * 0.41, 0]} color="#8c6f5a" />
          <Box size={[w - 0.08, 0.08, d - 0.08]} position={[0, h * 0.86, 0]} color="#b99a7d" />
          <Leg position={[-w / 2 + 0.1, 0.05, -d / 2 + 0.1]} height={0.1} />
          <Leg position={[w / 2 - 0.1, 0.05, -d / 2 + 0.1]} height={0.1} />
        </group>
      );
    case "toilet":
      return (
        <group>
          <mesh position={[0, 0.22, 0.04]} castShadow>
            <cylinderGeometry args={[0.2, 0.17, 0.44, 16]} />
            <meshStandardMaterial color="#e7e5e4" roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.49, 0.04]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.07, 16]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.3} />
          </mesh>
          <Box size={[0.34, 0.55, 0.16]} position={[0, 0.48, -d / 2 + 0.08]} color="#f5f5f4" />
          <Box size={[0.28, 0.025, 0.03]} position={[0, h - 0.03, -d / 2 - 0.02]} color={metal} metalness={0.7} />
        </group>
      );
    case "bathtub":
      return (
        <group>
          <Box size={[w, 0.48, d]} position={[0, 0.24, 0]} color="#f5f5f4" />
          <Box size={[w - 0.14, 0.08, d - 0.14]} position={[0, 0.5, 0]} color="#bae6fd" />
          <Box size={[w + 0.04, 0.08, d + 0.04]} position={[0, 0.52, 0]} color="#d6d3d1" />
          <Box size={[0.03, 0.03, 0.03]} position={[w * 0.32, 0.58, -d * 0.25]} color={metal} metalness={0.8} />
        </group>
      );
    case "wall-mirror":
      return (
        <group>
          <Box size={[w, h, 0.05]} position={[0, 0, 0]} color={darkWood} />
          <Box size={[w - 0.1, h - 0.1, 0.02]} position={[0, 0, 0.04]} color="#bfdbfe" />
        </group>
      );
    case "refrigerator":
      return (
        <group>
          <Box size={[w, h, d]} position={[0, h / 2, 0]} color="#cbd5e1" metalness={0.55} />
          <Box size={[w - 0.06, h * 0.52, 0.025]} position={[0, h * 0.68, -d / 2 - 0.025]} color="#e2e8f0" metalness={0.35} />
          <Box size={[w - 0.06, h * 0.36, 0.025]} position={[0, h * 0.22, -d / 2 - 0.025]} color="#e2e8f0" metalness={0.35} />
          <Box size={[0.035, h * 0.34, 0.035]} position={[w * 0.32, h * 0.68, -d / 2 - 0.06]} color={metal} metalness={0.8} />
          <Box size={[0.035, h * 0.25, 0.035]} position={[w * 0.32, h * 0.22, -d / 2 - 0.06]} color={metal} metalness={0.8} />
        </group>
      );
    case "stove":
      return (
        <group>
          <Box size={[w, h - 0.1, d]} position={[0, (h - 0.1) / 2, 0]} color="#52525b" metalness={0.5} />
          <Box size={[w + 0.04, 0.08, d + 0.04]} position={[0, h - 0.04, 0]} color="#27272a" metalness={0.4} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <mesh key={`${x}-${z}`} position={[x * w * 0.24, h + 0.01, z * d * 0.22]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.018, 16]} />
              <meshStandardMaterial color="#18181b" metalness={0.5} />
            </mesh>
          )))}
          <Box size={[w * 0.6, 0.06, 0.025]} position={[0, h * 0.58, -d / 2 - 0.03]} color="#a1a1aa" metalness={0.65} />
        </group>
      );
    case "kitchen-sink":
      return (
        <group>
          <Box size={[w, h - 0.1, d]} position={[0, (h - 0.1) / 2, 0]} color="#d6c7b2" />
          <Box size={[w + 0.04, 0.1, d + 0.04]} position={[0, h - 0.05, 0]} color="#a8a29e" metalness={0.55} />
          <Box size={[w * 0.58, 0.04, d * 0.58]} position={[0, h + 0.01, 0]} color="#52525b" metalness={0.6} />
          <mesh position={[0, h + 0.14, -d * 0.18]} castShadow>
            <torusGeometry args={[0.09, 0.018, 8, 16, Math.PI]} />
            <meshStandardMaterial color={metal} metalness={0.8} roughness={0.25} />
          </mesh>
          <Box size={[0.035, 0.035, 0.035]} position={[w * 0.3, h + 0.03, -d * 0.28]} color={metal} metalness={0.8} />
        </group>
      );
    case "shower":
      return (
        <group>
          <Box size={[w, 0.06, d]} position={[0, 0.03, 0]} color="#d6d3d1" />
          <Box size={[w - 0.1, 0.035, d - 0.1]} position={[0, 0.065, 0]} color="#bae6fd" />
          {[-1, 1].map((x) => (
            <mesh key={x} position={[x * (w / 2 - 0.04), h / 2, d / 2 - 0.04]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, h, 10]} />
              <meshStandardMaterial color={metal} metalness={0.7} roughness={0.25} />
            </mesh>
          ))}
          <Box size={[w, 0.035, 0.035]} position={[0, h - 0.02, d / 2 - 0.04]} color={metal} metalness={0.7} />
          <mesh position={[0, h - 0.22, -d * 0.2]} castShadow>
            <sphereGeometry args={[0.08, 12, 8]} />
            <meshStandardMaterial color="#dbeafe" metalness={0.3} roughness={0.2} />
          </mesh>
        </group>
      );
    case "console-table":
      return (
        <group>
          <Box size={[w, 0.12, d]} position={[0, h - 0.06, 0]} color={wood} />
          {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
            <Leg key={`${x}-${z}`} height={h - 0.12} position={[x * (w / 2 - 0.1), (h - 0.12) / 2, z * (d / 2 - 0.07)]} color={darkWood} />
          )))}
          <Box size={[w * 0.55, 0.08, 0.025]} position={[0, h * 0.42, d / 2 - 0.02]} color={darkWood} />
        </group>
      );
    case "beanbag":
      return (
        <group>
          <mesh position={[0, h * 0.45, 0]} scale={[w * 0.55, h * 0.75, d * 0.55]} castShadow receiveShadow>
            <sphereGeometry args={[1, 18, 12]} />
            <meshStandardMaterial color="#a8555a" roughness={0.95} />
          </mesh>
          <mesh position={[0, h * 0.88, -d * 0.08]} scale={[w * 0.28, 0.08, d * 0.2]} castShadow>
            <sphereGeometry args={[1, 14, 8]} />
            <meshStandardMaterial color="#c26b6b" roughness={0.95} />
          </mesh>
        </group>
      );
    default:
      return <Box size={[w, h, d]} position={[0, h / 2, 0]} color="#8b7355" />;
  }
}

/** Flat patch showing the space a piece needs kept free. */
function ClearanceZone({ rect, crowded }: { rect: Rect; crowded: boolean }) {
  return (
    <mesh
      position={[rect.center.x, 0.004, rect.center.z]}
      rotation={[-Math.PI / 2, 0, -rect.rotationY]}
    >
      <planeGeometry args={[rect.w, rect.d]} />
      <meshBasicMaterial
        color={crowded ? "#f59e0b" : "#38bdf8"}
        transparent
        opacity={0.16}
        depthWrite={false}
      />
    </mesh>
  );
}

function Piece({ placement, selected, blocked, crowded, onGrab, onHover }: PieceProps) {
  const item = findCatalogItem(placement.catalogItemId);
  if (!item) return null;

  return (
    <group
      position={[placement.position.x, placement.position.y, placement.position.z]}
      rotation={[0, placement.rotationY, 0]}
    >
      <mesh
        position={[0, item.height / 2, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
        onPointerDown={(event) => {
          event.stopPropagation();
          editor().selectPlacement(placement.id, event.nativeEvent.shiftKey);
          onGrab(placement.id, event.nativeEvent);
        }}
      >
        <boxGeometry args={[item.footprint.w, item.height, item.footprint.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[item.footprint.w, item.footprint.d]} />
        <meshBasicMaterial
          color={colourFor(selected, blocked, crowded)}
          transparent
          opacity={selected ? 0.1 : 0}
          depthWrite={false}
        />
      </mesh>
      <FurnitureModel item={item} />
    </group>
  );
}

export function Furniture() {
  // Subscribe to stable slices and merge here. livePlacements builds a fresh
  // object per call, so as a selector it makes getSnapshot loop forever.
  const stored = useEditor((state) => state.scene.placements);
  const rooms = useEditor((state) => state.scene.rooms);
  const activeRoomIndex = useEditor((state) => state.activeRoomIndex);
  const roomDrag = useEditor((state) => state.roomDrag);
  const drag = useEditor((state) => state.placementDrag);
  const selectedId = useEditor((state) => state.selectedId);
  const selectedIds = useEditor((state) => state.selectedIds);
  const groundAt = useGroundPointer();
  const [hovered, setHovered] = useState(false);

  const isDragging = drag !== null;
  const displayRooms = useMemo(() => {
    if (!roomDrag) return rooms;
    const room = rooms[activeRoomIndex];
    if (!room) return rooms;
    const move = (point: { x: number; z: number }) => ({
      x: point.x + roomDrag.delta.x,
      z: point.z + roomDrag.delta.z,
    });
    return rooms.map((candidate, index) =>
      index === activeRoomIndex
        ? {
            ...candidate,
            polygon: candidate.polygon.map(move),
            walls: candidate.walls.map((wall) => ({
              ...wall,
              start: move(wall.start),
              end: move(wall.end),
            })),
          }
        : candidate,
    );
  }, [activeRoomIndex, roomDrag, rooms]);

  const placements = useMemo(
    () => {
      let next = stored;
      const room = rooms[activeRoomIndex];
      if (roomDrag && room) {
        const ids = new Set(placementsInRoom(room, stored).map((p) => p.id));
        next = stored.map((p) =>
          ids.has(p.id)
            ? {
                ...p,
                position: {
                  ...p.position,
                  x: p.position.x + roomDrag.delta.x,
                  z: p.position.z + roomDrag.delta.z,
                },
              }
            : p,
        );
      }
      return drag
        ? next.map((p) => (p.id === drag.id ? { ...p, position: drag.position } : p))
        : next;
    },
    [activeRoomIndex, drag, roomDrag, rooms, stored],
  );

  // Recomputed against the live positions, so the warning tracks the drag.
  const collisions = useMemo(
    () => findCollisions(displayRooms, placements),
    [displayRooms, placements],
  );

  // Only the selected piece shows its zone, or the floor turns to soup.
  const selectedZone = useMemo(() => {
    const selected = placements.find((p) => p.id === selectedId);
    return selected ? clearanceRect(selected) : null;
  }, [placements, selectedId]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      const point = groundAt(event);
      if (point) editor().updatePlacementDrag(point, event.altKey);
    };
    const onUp = () => editor().endPlacementDrag();

    // On window, so a fast drag that outruns the pointer still tracks.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, groundAt]);

  useEffect(() => {
    document.body.style.cursor = isDragging ? "grabbing" : hovered ? "grab" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, isDragging]);

  const grab = (id: string, event: PointerEvent) => {
    if (event.shiftKey) return;
    const point = groundAt(event);
    if (point) editor().beginPlacementDrag(id, point);
  };

  return (
    <group>
      {selectedZone && (
        <ClearanceZone
          rect={selectedZone}
          crowded={selectedId !== null && collisions.crowded.has(selectedId)}
        />
      )}
      {placements.map((placement) => (
        <Piece
          key={placement.id}
          placement={placement}
          selected={selectedIds.has(placement.id)}
          blocked={isBlocked(collisions, placement.id)}
          crowded={collisions.crowded.has(placement.id)}
          onGrab={grab}
          onHover={setHovered}
        />
      ))}
    </group>
  );
}
