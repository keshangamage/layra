"use client";

import { useEffect } from "react";
import { Line, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { distance, formatLength } from "@layra/geometry";
import { snapPoint } from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

const Y = 0.03;
const CLICK_SLOP = 4;

export function MeasureTool() {
  const mode = useEditor((state) => state.mode);
  const measure = useEditor((state) => state.measure);
  const cursor = useEditor((state) => state.cursor);
  const domElement = useThree((state) => state.gl.domElement);
  const groundAt = useGroundPointer();

  useEffect(() => {
    if (mode !== "measure") return;

    let pressX = 0;
    let pressY = 0;

    const onPointerDown = (event: PointerEvent) => {
      pressX = event.clientX;
      pressY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // Let OrbitControls keep the left button for orbiting.
      if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > CLICK_SLOP) return;
      const point = groundAt(event);
      if (point) editor().addMeasurePoint(snapPoint(point, editor().snap.grid));
    };

    const onPointerMove = (event: PointerEvent) => {
      const point = groundAt(event);
      editor().setMeasureCursor(point ? snapPoint(point, editor().snap.grid) : null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") editor().clearMeasure();
    };

    domElement.addEventListener("pointerdown", onPointerDown);
    domElement.addEventListener("pointerup", onPointerUp);
    domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointerup", onPointerUp);
      domElement.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mode, domElement, groundAt]);

  if (mode !== "measure" || !measure.from) return null;

  // While the second end is unplaced, track the cursor.
  const end = measure.to ?? cursor;
  const from = measure.from;

  return (
    <group>
      <mesh position={[from.x, Y, from.z]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>

      {end && (
        <>
          <Line
            points={[
              [from.x, Y, from.z],
              [end.x, Y, end.z],
            ]}
            color="#fbbf24"
            lineWidth={2}
          />
          <mesh position={[end.x, Y, end.z]}>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          <Text
            position={[(from.x + end.x) / 2, Y + 0.25, (from.z + end.z) / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.26}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
          >
            {formatLength(distance(from, end))}
          </Text>
        </>
      )}
    </group>
  );
}
