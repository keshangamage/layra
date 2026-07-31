"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { livePolygon, snapPoint } from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

/** Lifted off the floor so the handle isn't buried in it. */
const Y = 0.06;
const RADIUS = 0.11;

export function VertexHandles() {
  const mode = useEditor((state) => state.mode);
  const polygon = useEditor(useShallow(livePolygon));
  const draggingIndex = useEditor((state) => state.dragging?.index ?? null);
  const groundAt = useGroundPointer();
  const [hovered, setHovered] = useState<number | null>(null);

  // Listen on window so a fast drag that outruns the pointer still tracks.
  useEffect(() => {
    if (draggingIndex === null) return;

    const onMove = (event: PointerEvent) => {
      const raw = groundAt(event);
      if (raw) editor().updateDrag(snapPoint(raw, editor().snap.grid));
    };
    const onUp = () => editor().endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingIndex, groundAt]);

  useEffect(() => {
    document.body.style.cursor = hovered !== null ? "grab" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  if (mode !== "edit" || polygon.length < 3) return null;

  return (
    <group>
      {polygon.map((point, i) => {
        const active = draggingIndex === i || hovered === i;
        return (
          <mesh
            key={i}
            position={[point.x, Y, point.z]}
            scale={active ? 1.35 : 1}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(i);
            }}
            onPointerOut={() => setHovered((current) => (current === i ? null : current))}
            onPointerDown={(event) => {
              // Stop OrbitControls from also treating this as an orbit drag.
              event.stopPropagation();
              editor().beginDrag(i);
            }}
          >
            <sphereGeometry args={[RADIUS, 20, 14]} />
            <meshBasicMaterial color={active ? "#4ade80" : "#38bdf8"} />
          </mesh>
        );
      })}
    </group>
  );
}
