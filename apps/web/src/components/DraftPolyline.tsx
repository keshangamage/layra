"use client";

import { Line } from "@react-three/drei";
import { distance } from "@layra/geometry";
import { useEditor } from "@/state/editor";

/** Lifted just off the floor so it doesn't z-fight with the grid. */
const Y = 0.01;

export function DraftPolyline() {
  const draft = useEditor((state) => state.draft);
  const cursor = useEditor((state) => state.cursor);

  if (draft.length === 0) return null;

  const placed = draft.map((p) => [p.x, Y, p.z] as [number, number, number]);
  const preview = cursor
    ? [...placed, [cursor.x, Y, cursor.z] as [number, number, number]]
    : placed;

  const first = draft[0]!;
  const canClose =
    draft.length >= 3 && cursor !== null && distance(cursor, first) < 0.001;

  return (
    <group>
      {preview.length >= 2 && (
        <Line points={preview} color="#38bdf8" lineWidth={2} />
      )}

      {draft.map((point, i) => (
        <mesh key={i} position={[point.x, Y, point.z]}>
          <sphereGeometry args={[i === 0 && canClose ? 0.12 : 0.07, 16, 12]} />
          <meshBasicMaterial color={i === 0 && canClose ? "#4ade80" : "#38bdf8"} />
        </mesh>
      ))}
    </group>
  );
}
