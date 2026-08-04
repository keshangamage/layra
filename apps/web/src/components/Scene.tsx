"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { bounds } from "@layra/geometry";
import { activeRoom, currentWallSettings,
} from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { Walls } from "./Walls";
import { Floor } from "./Floor";
import { DrawController } from "./DrawController";
import { RoomDragController } from "./RoomDragController";
import { DraftPolyline } from "./DraftPolyline";
import { VertexHandles } from "./VertexHandles";
import { Furniture } from "./Furniture";
import { FurniturePlacer } from "./FurniturePlacer";
import { CameraRig } from "./CameraRig";
import { Openings } from "./Openings";
import { Dimensions } from "./Dimensions";
import { MeasureTool } from "./MeasureTool";

/** The room being edited, which follows an in-progress vertex drag. */
function ActiveRoom() {
  const storedRoom = useEditor((state) => activeRoom(state));
  const roomDrag = useEditor((state) => state.roomDrag);
  const room = useMemo(() => {
    if (!roomDrag) return storedRoom;
    const move = (point: { x: number; z: number }) => ({
      x: point.x + roomDrag.delta.x,
      z: point.z + roomDrag.delta.z,
    });
    return {
      ...storedRoom,
      polygon: storedRoom.polygon.map(move),
      walls: storedRoom.walls.map((wall) => ({
        ...wall,
        start: move(wall.start),
        end: move(wall.end),
      })),
    };
  }, [roomDrag, storedRoom]);
  const polygon = room.polygon;
  const walls = room.walls;
  const mode = useEditor((state) => state.mode);
  const pendingOpening = useEditor((state) => state.pendingOpening);
  const openings = useMemo(() => walls.map((wall) => wall.openings), [walls]);
  const height = useEditor((state) => currentWallSettings(state).height);
  const thickness = useEditor((state) => currentWallSettings(state).thickness);
  const floorMaterial = useEditor((state) => activeRoom(state).floorMaterial);

  if (polygon.length < 3) return null;

  return (
    <>
      <Floor
        polygon={polygon}
        thickness={thickness}
        material={floorMaterial}
        onPointerDown={(event) => {
          if (mode !== "edit" || pendingOpening) return;
          event.stopPropagation();
          editor().beginRoomDrag({ x: event.point.x, z: event.point.z });
        }}
      />
      <Walls
        polygon={polygon}
        height={height}
        thickness={thickness}
        openings={openings}
        onPointerDown={(event) => {
          // Only intercept when an opening is armed, so vertex dragging is safe.
          if (!editor().pendingOpening) return;
          event.stopPropagation();
          editor().placeOpeningAt({ x: event.point.x, z: event.point.z });
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          editor().addVertexAt({ x: event.point.x, z: event.point.z });
        }}
      />
    </>
  );
}

/** Remounting the Canvas is more reliable than reviving a dead renderer. */
const MAX_RECOVERY_ATTEMPTS = 2;

/** Every room except the one being edited, drawn without pointer handling. */
function OtherRooms() {
  const showOtherRooms = useEditor((state) => state.showOtherRooms);
  const rooms = useEditor((state) => state.scene.rooms);
  const activeIndex = useEditor((state) => state.activeRoomIndex);
  const hiddenRoomIds = useEditor((state) => state.hiddenRoomIds);

  if (!showOtherRooms) return null;

  return (
    <group>
      {rooms.map((room, index) => {
        if (index === activeIndex || room.polygon.length < 3) return null;
        if (hiddenRoomIds.has(room.id)) return null;
        const height = room.walls[0]?.height ?? 2.5;
        const thickness = room.walls[0]?.thickness ?? 0.2;
        return (
          <group
            key={room.id}
            onPointerDown={(event) => {
              event.stopPropagation();
              editor().setActiveRoom(index);
            }}
          >
            <Floor
              polygon={room.polygon}
              thickness={thickness}
              material={room.floorMaterial}
            />
            <Walls
              polygon={room.polygon}
              height={height}
              thickness={thickness}
              openings={room.walls.map((wall) => wall.openings)}
            />
          </group>
        );
      })}
    </group>
  );
}

export default function Scene() {
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const attempts = useRef(0);
  const polygon = useEditor((state) => activeRoom(state).polygon);
  const isDragging = useEditor(
    (state) =>
      state.dragging !== null ||
      state.roomDrag !== null ||
      state.placementDrag !== null ||
      state.openingDrag !== null,
  );
  const extent = useMemo(() => bounds(polygon), [polygon]);

  // Frame the shadow camera to the room so shadows stay sharp.
  const shadowRadius = Math.max(extent.size.x, extent.size.z, 4);

  useEffect(() => {
    if (!contextLost || attempts.current >= MAX_RECOVERY_ATTEMPTS) return;
    // Give the GPU a moment before asking for a new context.
    const timer = setTimeout(() => {
      attempts.current += 1;
      setContextLost(false);
      setCanvasKey((key) => key + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [contextLost]);

  return (
    <>
    <Canvas
      key={canvasKey}
      onCreated={({ gl, camera }) => {
        const canvas = gl.domElement;
        if (process.env.NEXT_PUBLIC_E2E === "1") {
          (window as unknown as Record<string, unknown>).__layraInfo = () => ({
            geometries: gl.info.memory.geometries,
            textures: gl.info.memory.textures,
            programs: gl.info.programs?.length ?? 0,
            frames: gl.info.render.frame,
            calls: gl.info.render.calls,
          });
          (window as unknown as Record<string, unknown>).__layraProject = (
            x: number,
            z: number,
            y = 0,
          ) => {
            const v = new Vector3(x, y, z).project(camera);
            const rect = canvas.getBoundingClientRect();
            return {
              x: rect.left + ((v.x + 1) / 2) * rect.width,
              y: rect.top + ((1 - v.y) / 2) * rect.height,
            };
          };
        }
        canvas.addEventListener("webglcontextlost", (event) => {
          // Required, or the browser never attempts to restore the context.
          event.preventDefault();
          setContextLost(true);
        });
        canvas.addEventListener("webglcontextrestored", () => {
          attempts.current = 0;
          setContextLost(false);
        });
      }}
      // "percentage" is PCFShadowMap; the default maps to the deprecated PCFSoftShadowMap.
      shadows="percentage"
      camera={{ position: [7, 6, 8], fov: 45, near: 0.1, far: 200 }}
      className="bg-zinc-900"
      // Fires only when a click hit no mesh, unlike a raw canvas pointerup.
      onPointerMissed={() => {
        editor().selectPlacement(null);
        editor().selectVertex(null);
      }}
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

      <OtherRooms />
      <ActiveRoom />
      <Furniture />
      <Openings />
      <FurniturePlacer />
      <RoomDragController />
      <CameraRig />
      <DraftPolyline />
      <VertexHandles />
      {/*
        Text suspends while troika fetches its font. Without its own boundary
        that suspension reaches the dynamic() boundary above, which hides the
        whole canvas with display:none until the font resolves - or forever,
        if the network never answers.
      */}
      <Suspense fallback={null}>
        <Dimensions />
        <MeasureTool />
      </Suspense>
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
        makeDefault
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

    {contextLost && (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900/95 text-center">
        <p className="text-sm text-zinc-300">3D view lost its graphics context.</p>
        <p className="max-w-xs text-xs text-zinc-500">
          Your scene is safe. Automatic recovery did not take, which usually means
          the browser is out of GPU contexts. Close other heavy tabs, or restart
          the browser.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-600"
        >
          Reload
        </button>
      </div>
    )}
    </>
  );
}
