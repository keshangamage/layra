"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearanceRect,
  findCatalogItem,
  findCollisions,
  isBlocked,
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
    <mesh
      // Origin is the centre of the footprint at its base, so lift by half.
      // Wall-mounted pieces carry a non-zero y and hang there.
      position={[
        placement.position.x,
        placement.position.y + item.height / 2,
        placement.position.z,
      ]}
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
        color={colourFor(selected, blocked, crowded)}
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
          selected={placement.id === selectedId}
          blocked={isBlocked(collisions, placement.id)}
          crowded={collisions.crowded.has(placement.id)}
          onGrab={grab}
          onHover={setHovered}
        />
      ))}
    </group>
  );
}
