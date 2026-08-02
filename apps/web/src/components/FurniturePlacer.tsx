"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { Placement } from "@layra/types";
import {
  findCatalogItem,
  findCollisions,
  isBlocked,
  mountToWall,
  snapPoint,
} from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

/** Matches the click-versus-orbit threshold used elsewhere. */
const CLICK_SLOP = 4;

const GHOST_ID = "__ghost";

export function FurniturePlacer() {
  const pending = useEditor((state) => state.pendingFurniture);
  const ghost = useEditor((state) => state.furnitureGhost);
  const room = useEditor((state) => state.scene.room);
  const placements = useEditor((state) => state.scene.placements);
  const domElement = useThree((state) => state.gl.domElement);
  const groundAt = useGroundPointer();

  useEffect(() => {
    if (!pending) return;

    let pressX = 0;
    let pressY = 0;

    const onPointerMove = (event: PointerEvent) => {
      const point = groundAt(event);
      editor().setFurnitureGhost(
        point ? snapPoint(point, editor().snap.grid) : null,
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      pressX = event.clientX;
      pressY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // Let OrbitControls keep the left button for orbiting.
      if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > CLICK_SLOP) return;
      const point = groundAt(event);
      if (point) editor().placeFurnitureAt(point);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") editor().armFurniture(null);
    };

    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerdown", onPointerDown);
    domElement.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      domElement.removeEventListener("pointermove", onPointerMove);
      domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      editor().setFurnitureGhost(null);
    };
  }, [pending, domElement, groundAt]);

  const item = pending ? findCatalogItem(pending) : undefined;

  // The ghost shows exactly where the piece will land, wall snap included.
  const preview = useMemo(() => {
    if (!item || !ghost) return null;
    if (item.wallMounted) return mountToWall(room, ghost, item);
    return { position: { x: ghost.x, y: 0, z: ghost.z }, rotationY: 0 };
  }, [item, ghost, room]);

  // Test the ghost against the real scene so it warns before you commit.
  const blocked = useMemo(() => {
    if (!item || !preview) return false;
    const candidate: Placement = {
      id: GHOST_ID,
      catalogItemId: item.id,
      position: preview.position,
      rotationY: preview.rotationY,
      locked: false,
    };
    return isBlocked(findCollisions(room, [...placements, candidate]), GHOST_ID);
  }, [item, preview, room, placements]);

  if (!item || !preview) return null;

  return (
    <mesh
      position={[preview.position.x, preview.position.y + item.height / 2, preview.position.z]}
      rotation={[0, preview.rotationY, 0]}
    >
      <boxGeometry args={[item.footprint.w, item.height, item.footprint.d]} />
      <meshStandardMaterial
        color={blocked ? "#dc2626" : "#38bdf8"}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </mesh>
  );
}
