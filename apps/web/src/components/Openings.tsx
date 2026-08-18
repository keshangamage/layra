"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { openingTransform } from "@layra/geometry";
import type { Opening } from "@layra/types";
import { activeRoom } from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { OpeningModel } from "./openings/models";
import { WindowLights, type WindowLight } from "./openings/WindowLights";
import { useGroundPointer } from "./useGroundPointer";

interface Panel {
  key: string;
  wallIndex: number;
  opening: Opening;
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  thickness: number;
  open: boolean;
  curtainsOpen: boolean;
}

export function Openings() {
  const walls = useEditor((state) => activeRoom(state).walls);
  const drag = useEditor((state) => state.openingDrag);
  const selected = useEditor((state) => state.selectedOpening);
  const groundAt = useGroundPointer();
  const [hovered, setHovered] = useState<string | null>(null);
  const dragged = useRef(false);

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
          thickness: wall.thickness,
          open: opening.open === true,
          curtainsOpen: opening.curtainsOpen === true,
        });
      }
    });
    return result;
  }, [walls, drag]);

  const windowLights = useMemo<WindowLight[]>(
    () =>
      panels
        .filter((panel) => panel.opening.type === "window")
        .map((panel) => ({
          key: panel.key,
          // Clear of the frame and reveal, which sit right on the wall face and
          // would otherwise take the whole falloff.
          position: [
            panel.position[0] + Math.sin(panel.rotationY) * (panel.thickness / 2 + 0.12),
            panel.position[1],
            panel.position[2] + Math.cos(panel.rotationY) * (panel.thickness / 2 + 0.12),
          ],
          rotationY: panel.rotationY,
          width: panel.width,
          height: panel.height,
        })),
    [panels],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      dragged.current = true;
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
      <WindowLights windows={windowLights} />
      {panels.map((panel) => {
        const active = selected?.id === panel.key || hovered === panel.key;
        return (
          <group
            key={panel.key}
            position={panel.position}
            rotation={[0, panel.rotationY, 0]}
          >
            <mesh
              onPointerOver={(event) => {
                event.stopPropagation();
                setHovered(panel.key);
              }}
              onPointerOut={() =>
                setHovered((current) => (current === panel.key ? null : current))
              }
              onPointerDown={(event) => {
                event.stopPropagation();
                dragged.current = false;
                const point = groundAt(event.nativeEvent);
                if (point) {
                  editor().beginOpeningDrag(panel.wallIndex, panel.key, point);
                }
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (!dragged.current) {
                  editor().toggleOpening(panel.wallIndex, panel.key);
                }
              }}
            >
              <planeGeometry args={[panel.width, panel.height]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} side={2} />
            </mesh>
            <OpeningModel type={panel.opening.type} panel={panel} active={active} />
          </group>
        );
      })}
    </group>
  );
}
