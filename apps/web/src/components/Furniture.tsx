"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearanceRect,
  findCatalogItem,
  findCollisions,
  isBlocked,
  placementsInRoom,
} from "@layra/state";
import type { Rect } from "@layra/geometry";
import type { Placement } from "@layra/types";
import { editor, useEditor } from "@/state/editor";
import { FurnitureModel } from "./furniture/models";
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
    <group
      position={[placement.position.x, placement.position.y, placement.position.z]}
      rotation={[0, placement.rotationY, 0]}
    >
      <mesh
        position={[0, item.height / 2, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
        onPointerDown={(event) => {
          event.stopPropagation();
          editor().selectPlacement(placement.id, event.nativeEvent.shiftKey);
          onGrab(placement.id, event.nativeEvent);
        }}
      >
        <boxGeometry args={[item.footprint.w, item.height, item.footprint.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[item.footprint.w, item.footprint.d]} />
        <meshBasicMaterial
          color={colourFor(selected, blocked, crowded)}
          transparent
          opacity={selected ? 0.1 : 0}
          depthWrite={false}
        />
      </mesh>
      <FurnitureModel item={item} finish={placement.finish} />
    </group>
  );
}

export function Furniture() {
  // Subscribe to stable slices and merge here. livePlacements builds a fresh
  // object per call, so as a selector it makes getSnapshot loop forever.
  const stored = useEditor((state) => state.scene.placements);
  const rooms = useEditor((state) => state.scene.rooms);
  const activeRoomIndex = useEditor((state) => state.activeRoomIndex);
  const roomDrag = useEditor((state) => state.roomDrag);
  const drag = useEditor((state) => state.placementDrag);
  const selectedId = useEditor((state) => state.selectedId);
  const selectedIds = useEditor((state) => state.selectedIds);
  const groundAt = useGroundPointer();
  const [hovered, setHovered] = useState(false);

  const isDragging = drag !== null;
  const displayRooms = useMemo(() => {
    if (!roomDrag) return rooms;
    const room = rooms[activeRoomIndex];
    if (!room) return rooms;
    const move = (point: { x: number; z: number }) => ({
      x: point.x + roomDrag.delta.x,
      z: point.z + roomDrag.delta.z,
    });
    return rooms.map((candidate, index) =>
      index === activeRoomIndex
        ? {
            ...candidate,
            polygon: candidate.polygon.map(move),
            walls: candidate.walls.map((wall) => ({
              ...wall,
              start: move(wall.start),
              end: move(wall.end),
            })),
          }
        : candidate,
    );
  }, [activeRoomIndex, roomDrag, rooms]);

  const placements = useMemo(
    () => {
      let next = stored;
      const room = rooms[activeRoomIndex];
      if (roomDrag && room) {
        const ids = new Set(placementsInRoom(room, stored).map((p) => p.id));
        next = stored.map((p) =>
          ids.has(p.id)
            ? {
                ...p,
                position: {
                  ...p.position,
                  x: p.position.x + roomDrag.delta.x,
                  z: p.position.z + roomDrag.delta.z,
                },
              }
            : p,
        );
      }
      return drag
        ? next.map((p) => (p.id === drag.id ? { ...p, position: drag.position } : p))
        : next;
    },
    [activeRoomIndex, drag, roomDrag, rooms, stored],
  );

  // Recomputed against the live positions, so the warning tracks the drag.
  const collisions = useMemo(
    () => findCollisions(displayRooms, placements),
    [displayRooms, placements],
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
    if (event.shiftKey) return;
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
          selected={selectedIds.has(placement.id)}
          blocked={isBlocked(collisions, placement.id)}
          crowded={collisions.crowded.has(placement.id)}
          onGrab={grab}
          onHover={setHovered}
        />
      ))}
    </group>
  );
}
