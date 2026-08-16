"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  open: boolean;
  curtainsOpen: boolean;
}

function Box({
  size,
  position,
  color,
  metalness = 0,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  metalness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={metalness} />
    </mesh>
  );
}

function OpeningModel({ panel, active }: { panel: Panel; active: boolean }) {
  const frame = active ? "#38bdf8" : "#6b4f3a";
  const glass = active ? "#7dd3fc" : "#bae6fd";
  const halfWidth = panel.width / 2;
  const halfHeight = panel.height / 2;

  if (panel.opening.type === "door") {
    const leaf = (
      <Box
        size={[Math.max(panel.width - 0.16, 0.1), Math.max(panel.height - 0.16, 0.1), 0.05]}
        position={[panel.width / 2, -0.01, 0.03]}
        color="#a87952"
      />
    );
    return (
      <group>
        <Box size={[0.08, panel.height, 0.12]} position={[-halfWidth + 0.04, 0, 0]} color={frame} />
        <Box size={[0.08, panel.height, 0.12]} position={[halfWidth - 0.04, 0, 0]} color={frame} />
        <Box size={[panel.width, 0.08, 0.12]} position={[0, halfHeight - 0.04, 0]} color={frame} />
        <group position={[-halfWidth, 0, 0]} rotation={[0, panel.open ? -Math.PI / 2 : 0, 0]}>
          {leaf}
        </group>
        <Box size={[0.035, 0.035, 0.035]} position={[panel.width * 0.28, 0, 0.07]} color="#d4af37" metalness={0.75} />
      </group>
    );
  }

  const curtainColor = active ? "#38bdf8" : "#c08473";
  const curtainWidth = panel.curtainsOpen ? 0.12 : Math.max(panel.width * 0.26, 0.18);
  const curtainY = Math.max(panel.height * 0.48, 0.3);
  const curtainX = panel.width / 2 - curtainWidth / 2 - 0.04;
  return (
    <group>
      <Box
        size={[panel.width + 0.12, 0.035, 0.06]}
        position={[0, halfHeight - 0.08, 0.08]}
        color="#9f8068"
        metalness={0.15}
      />
      <Box
        size={[curtainWidth, curtainY, 0.035]}
        position={[-curtainX, (halfHeight - curtainY) / 2, 0.08]}
        color={curtainColor}
      />
      <Box
        size={[curtainWidth, curtainY, 0.035]}
        position={[curtainX, (halfHeight - curtainY) / 2, 0.08]}
        color={curtainColor}
      />
      <Box size={[0.07, panel.height, 0.1]} position={[-halfWidth + 0.035, 0, 0]} color={frame} />
      <Box size={[0.07, panel.height, 0.1]} position={[halfWidth - 0.035, 0, 0]} color={frame} />
      <Box size={[panel.width, 0.07, 0.1]} position={[0, -halfHeight + 0.035, 0]} color={frame} />
      <Box size={[panel.width, 0.07, 0.1]} position={[0, halfHeight - 0.035, 0]} color={frame} />
      <Box size={[panel.width - 0.14, panel.height - 0.14, 0.035]} position={[0, 0, 0.02]} color={glass} />
      <Box size={[0.045, panel.height - 0.14, 0.05]} position={[0, 0, 0.055]} color={frame} />
      <Box size={[panel.width - 0.14, 0.045, 0.05]} position={[0, 0, 0.055]} color={frame} />
    </group>
  );
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
          open: opening.open === true,
          curtainsOpen: opening.curtainsOpen === true,
        });
      }
    });
    return result;
  }, [walls, drag]);

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
            <OpeningModel panel={panel} active={active} />
          </group>
        );
      })}
    </group>
  );
}
