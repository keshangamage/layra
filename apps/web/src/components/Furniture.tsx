"use client";

import { useEffect, useMemo, useState } from "react";
import { findCatalogItem, findCollisions, isBlocked } from "@layra/state";
import type { Placement } from "@layra/types";
import { editor, useEditor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

interface PieceProps {
  placement: Placement;
  selected: boolean;
  blocked: boolean;
  onGrab: (id: string, event: PointerEvent) => void;
  onHover: (hovering: boolean) => void;
}

function colourFor(selected: boolean, blocked: boolean): string {
  if (blocked) return selected ? "#f87171" : "#dc2626";
  return selected ? "#38bdf8" : "#8b7355";
}

function Piece({ placement, selected, blocked, onGrab, onHover }: PieceProps) {
  const item = findCatalogItem(placement.catalogItemId);
  if (!item) return null;

  return (
    <mesh
      // Origin is the centre of the footprint at floor level, so lift by half.
      position={[placement.position.x, item.height / 2, placement.position.z]}
      rotation={[0, placement.rotationY, 0]}
      castShadow
      receiveShadow
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
      onPointerDown={(event) => {
        event.stopPropagation();
        editor().selectPlacement(placement.id);
        onGrab(placement.id, event.nativeEvent);
      }}
    >
      <boxGeometry args={[item.footprint.w, item.height, item.footprint.d]} />
      <meshStandardMaterial
        color={colourFor(selected, blocked)}
        roughness={0.7}
        metalness={0}
      />
    </mesh>
  );
}

export function Furniture() {
  // Subscribe to stable slices and merge here. livePlacements builds a fresh
  // object per call, so as a selector it makes getSnapshot loop forever.
  const stored = useEditor((state) => state.scene.placements);
  const room = useEditor((state) => state.scene.room);
  const drag = useEditor((state) => state.placementDrag);
  const selectedId = useEditor((state) => state.selectedId);
  const groundAt = useGroundPointer();
  const [hovered, setHovered] = useState(false);

  const isDragging = drag !== null;
  const placements = useMemo(
    () =>
      drag
        ? stored.map((p) => (p.id === drag.id ? { ...p, position: drag.position } : p))
        : stored,
    [stored, drag],
  );

  // Recomputed against the live positions, so the warning tracks the drag.
  const collisions = useMemo(
    () => findCollisions(room, placements),
    [room, placements],
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      const point = groundAt(event);
      if (point) editor().updatePlacementDrag(point);
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
    const point = groundAt(event);
    if (point) editor().beginPlacementDrag(id, point);
  };

  return (
    <group>
      {placements.map((placement) => (
        <Piece
          key={placement.id}
          placement={placement}
          selected={placement.id === selectedId}
          blocked={isBlocked(collisions, placement.id)}
          onGrab={grab}
          onHover={setHovered}
        />
      ))}
    </group>
  );
}
