"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { Vec2 } from "@layra/types";
import { bounds, ensureCCW } from "@layra/geometry";
import { Walls } from "./Walls";
import { Floor } from "./Floor";

/** Placeholder until draw mode lands. The 30 degree corner exercises mitring. */
const DEMO_ROOM: Vec2[] = [
  { x: -2.5, z: -2 },
  { x: 2.5, z: -2 },
  { x: 3.5, z: 0.5 },
  { x: 2.5, z: 2 },
  { x: -2.5, z: 2 },
];

interface SceneProps {
  wallHeight: number;
  wallThickness: number;
}

export default function Scene({ wallHeight, wallThickness }: SceneProps) {
  const polygon = useMemo(() => ensureCCW(DEMO_ROOM), []);
  const extent = useMemo(() => bounds(polygon), [polygon]);

  // Frame the shadow camera to the room so shadows stay sharp.
  const shadowRadius = Math.max(extent.size.x, extent.size.z);

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

      <Floor polygon={polygon} thickness={wallThickness} />
      <Walls polygon={polygon} height={wallHeight} thickness={wallThickness} />

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
