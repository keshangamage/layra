"use client";

import { useMemo } from "react";
import type { Wall } from "@layra/types";
import { distance } from "@layra/geometry";
import { Surface } from "./Surface";

interface RoomTrimProps {
  walls: readonly Wall[];
}

interface TrimSegment {
  key: string;
  position: [number, number, number];
  rotationY: number;
  length: number;
  y: number;
}

function segmentsForWall(wall: Wall, wallIndex: number, skipOpenings: boolean): TrimSegment[] {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = distance(wall.start, wall.end);
  if (length < 0.05) return [];

  const cutouts = skipOpenings
    ? wall.openings
        .filter((opening) => opening.type === "door")
        .map((opening) => ({ start: opening.offset, end: opening.offset + opening.width }))
        .sort((a, b) => a.start - b.start)
    : [];
  const ranges: Array<[number, number]> = [];
  let cursor = 0;
  for (const cutout of cutouts) {
    if (cutout.start > cursor) ranges.push([cursor, Math.min(cutout.start, length)]);
    cursor = Math.max(cursor, cutout.end);
  }
  if (cursor < length) ranges.push([cursor, length]);

  const angle = Math.atan2(-dz, dx);
  const interiorOffset = wall.thickness / 2 + 0.025;
  const normalX = -dz / length;
  const normalZ = dx / length;

  return ranges
    .filter(([start, end]) => end - start >= 0.08)
    .map(([start, end], segmentIndex) => {
      const centre = (start + end) / 2;
      return {
        key: `${wallIndex}-${skipOpenings ? "base" : "crown"}-${segmentIndex}`,
        position: [
          wall.start.x + (dx / length) * centre + normalX * interiorOffset,
          0,
          wall.start.z + (dz / length) * centre + normalZ * interiorOffset,
        ],
        rotationY: angle,
        length: end - start,
        y: skipOpenings ? 0.07 : wall.height - 0.08,
      };
    });
}

export function RoomTrim({ walls }: RoomTrimProps) {
  const segments = useMemo(
    () => walls.flatMap((wall, index) => [
      ...segmentsForWall(wall, index, true),
      ...segmentsForWall(wall, index, false),
    ]),
    [walls],
  );

  return (
    <group>
      {segments.map((segment) => {
        const baseboard = segment.key.includes("-base-");
        return (
          <mesh
            key={segment.key}
            position={[segment.position[0], segment.y, segment.position[2]]}
            rotation={[0, segment.rotationY, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[segment.length, baseboard ? 0.14 : 0.1, 0.055]} />
            <Surface
              kind="wood"
              color={baseboard ? "#6b4530" : "#8b6a4d"}
              roughness={0.62}
              span={segment.length}
            />
          </mesh>
        );
      })}
    </group>
  );
}
