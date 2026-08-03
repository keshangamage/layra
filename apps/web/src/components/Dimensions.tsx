"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { edgeLabels, formatLength } from "@layra/geometry";
import { activeRoom } from "@layra/state";
import { useEditor } from "@/state/editor";
import { LABEL_FONT } from "./font";

const Y = 0.02;

export function Dimensions() {
  const polygon = useEditor((state) => activeRoom(state).polygon);
  const show = useEditor((state) => state.showDimensions);

  const labels = useMemo(() => edgeLabels(polygon, 0.4), [polygon]);

  if (!show || polygon.length < 3) return null;

  return (
    <group>
      {labels.map((label, i) => (
        <Text
          key={i}
          position={[label.position.x, Y, label.position.z]}
          rotation={[-Math.PI / 2, 0, -label.angle]}
          font={LABEL_FONT}
          fontSize={0.22}
          color="#a1a1aa"
          anchorX="center"
          anchorY="middle"
        >
          {formatLength(label.length)}
        </Text>
      ))}
    </group>
  );
}
