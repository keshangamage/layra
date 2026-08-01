"use client";

import { findCatalogItem } from "@layra/state";
import type { Placement } from "@layra/types";
import { editor, useEditor } from "@/state/editor";

function Piece({ placement, selected }: { placement: Placement; selected: boolean }) {
  const item = findCatalogItem(placement.catalogItemId);
  if (!item) return null;

  const { w, d } = item.footprint;

  return (
    <mesh
      // Origin is the centre of the footprint at floor level, so lift by half.
      position={[placement.position.x, item.height / 2, placement.position.z]}
      rotation={[0, placement.rotationY, 0]}
      castShadow
      receiveShadow
      onPointerDown={(event) => {
        event.stopPropagation();
        editor().selectPlacement(placement.id);
      }}
    >
      <boxGeometry args={[w, item.height, d]} />
      <meshStandardMaterial
        color={selected ? "#38bdf8" : "#8b7355"}
        roughness={0.7}
        metalness={0}
      />
    </mesh>
  );
}

export function Furniture() {
  const placements = useEditor((state) => state.scene.placements);
  const selectedId = useEditor((state) => state.selectedId);

  return (
    <group>
      {placements.map((placement) => (
        <Piece
          key={placement.id}
          placement={placement}
          selected={placement.id === selectedId}
        />
      ))}
    </group>
  );
}
