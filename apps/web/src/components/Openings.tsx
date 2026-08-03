"use client";

import { useEffect, useMemo, useState } from "react";
import { openingTransform } from "@layra/geometry";
import type { Opening } from "@layra/types";
import { activeRoom } from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

interface Panel {
  key: string;
  wallIndex: number;
  opening: Opening;
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
}

export function Openings() {
  const walls = useEditor((state) => activeRoom(state).walls);
  const drag = useEditor((state) => state.openingDrag);
  const selected = useEditor((state) => state.selectedOpening);
  const groundAt = useGroundPointer();
  const [hovered, setHovered] = useState<string | null>(null);

  const panels = useMemo(() => {
    const result: Panel[] = [];
    walls.forEach((wall, wallIndex) => {
      for (const opening of wall.openings) {
        // Show the dragged opening at its live offset, not the stored one.
        const live =
          drag && drag.wallIndex === wallIndex && drag.id === opening.id
            ? { ...opening, offset: drag.offset }
            : opening;
        const transform = openingTransform(wall.start, wall.end, live);
        if (!transform) continue;
        result.push({
          key: opening.id,
          wallIndex,
          opening,
          position: [transform.position.x, transform.position.y, transform.position.z],
          rotationY: transform.rotationY,
          width: transform.width,
          height: transform.height,
        });
      }
    });
    return result;
  }, [walls, drag]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const point = groundAt(event);
      if (point) editor().updateOpeningDrag(point);
    };
    const onUp = () => editor().endOpeningDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, groundAt]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "grab" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  return (
    <group>
      {panels.map((panel) => {
        const active = selected?.id === panel.key || hovered === panel.key;
        const isWindow = panel.opening.type === "window";
        return (
          <mesh
            key={panel.key}
            position={panel.position}
            rotation={[0, panel.rotationY, 0]}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(panel.key);
            }}
            onPointerOut={() =>
              setHovered((current) => (current === panel.key ? null : current))
            }
            onPointerDown={(event) => {
              event.stopPropagation();
              const point = groundAt(event.nativeEvent);
              if (point) {
                editor().beginOpeningDrag(panel.wallIndex, panel.key, point);
              }
            }}
          >
            <planeGeometry args={[panel.width, panel.height]} />
            <meshStandardMaterial
              color={active ? "#38bdf8" : isWindow ? "#bae6fd" : "#a8a29e"}
              transparent
              // Glazing reads as glass; a doorway stays mostly open.
              opacity={active ? 0.5 : isWindow ? 0.35 : 0.18}
              depthWrite={false}
              side={2}
            />
          </mesh>
        );
      })}
    </group>
  );
}
