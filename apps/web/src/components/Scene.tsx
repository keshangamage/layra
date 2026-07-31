"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";
import { bounds } from "@layra/geometry";
import { currentWallSettings, livePolygon } from "@layra/state";
import { useEditor } from "@/state/editor";
import { Walls } from "./Walls";
import { Floor } from "./Floor";
import { DrawController } from "./DrawController";
import { DraftPolyline } from "./DraftPolyline";
import { VertexHandles } from "./VertexHandles";

function Room() {
  // livePolygon builds a new array mid-drag, so compare by element identity.
  const polygon = useEditor(useShallow(livePolygon));
  const height = useEditor((state) => currentWallSettings(state).height);
  const thickness = useEditor((state) => currentWallSettings(state).thickness);

  if (polygon.length < 3) return null;

  return (
    <>
      <Floor polygon={polygon} thickness={thickness} />
      <Walls polygon={polygon} height={height} thickness={thickness} />
    </>
  );
}

export default function Scene() {
  const polygon = useEditor((state) => state.scene.room.polygon);
  const isDragging = useEditor((state) => state.dragging !== null);
  const extent = useMemo(() => bounds(polygon), [polygon]);

  // Frame the shadow camera to the room so shadows stay sharp.
  const shadowRadius = Math.max(extent.size.x, extent.size.z, 4);

  return (
    <Canvas
      // "percentage" is PCFShadowMap; the default maps to the deprecated PCFSoftShadowMap.
      shadows="percentage"
      camera={{ position: [7, 6, 8], fov: 45, near: 0.1, far: 200 }}
      className="bg-zinc-900"
    >
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowRadius}
        shadow-camera-right={shadowRadius}
        shadow-camera-top={shadowRadius}
        shadow-camera-bottom={-shadowRadius}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
      />

      <Room />
      <DraftPolyline />
      <VertexHandles />
      <DrawController />

      <Grid
        infiniteGrid
        cellSize={1}
        cellThickness={0.5}
        sectionSize={5}
        sectionThickness={1}
        cellColor="#3f3f46"
        sectionColor="#52525b"
        fadeDistance={60}
        fadeStrength={1.5}
        followCamera={false}
      />

      <OrbitControls
        // R3F's stopPropagation doesn't reach OrbitControls, which listens on
        // the canvas directly, so a handle drag would orbit the camera too.
        enabled={!isDragging}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={2}
        maxDistance={60}
        target={[extent.center.x, 0, extent.center.z]}
      />
    </Canvas>
  );
}
