"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { bounds, fitDistance } from "@layra/geometry";
import { activeRoom, type ViewKind } from "@layra/state";
import { useEditor } from "@/state/editor";

/** Looking exactly straight down leaves the camera's up vector undefined. */
const TOP_TILT = 0.001;

const DIRECTIONS: Record<Exclude<ViewKind, "fit">, Vector3> = {
  top: new Vector3(TOP_TILT, 1, TOP_TILT).normalize(),
  iso: new Vector3(0.75, 0.7, 0.9).normalize(),
};

interface Controls {
  target: Vector3;
  update: () => void;
}

export function CameraRig() {
  const view = useEditor((state) => state.view);
  const polygon = useEditor((state) => activeRoom(state).polygon);
  const rooms = useEditor((state) => state.scene.rooms);
  const showOtherRooms = useEditor((state) => state.showOtherRooms);
  const hiddenRoomIds = useEditor((state) => state.hiddenRoomIds);
  const activeRoomIndex = useEditor((state) => state.activeRoomIndex);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as Controls | null;
  const size = useThree((state) => state.size);

  useEffect(() => {
    if (!view || !controls || !(camera instanceof PerspectiveCamera)) return;

    const points =
      view.kind === "fit" && showOtherRooms
        ? rooms
            .filter((room, index) => index === activeRoomIndex || !hiddenRoomIds.has(room.id))
            .flatMap((room) => room.polygon)
        : polygon;
    const extent = bounds(points);
    // An empty scene still needs something to frame.
    const span = {
      x: Math.max(extent.size.x, 4),
      z: Math.max(extent.size.z, 4),
    };
    const distance = fitDistance(span, camera.fov, size.width / size.height);
    const centre = new Vector3(extent.center.x, 0, extent.center.z);

    // "fit" keeps the current angle and only changes how far back we are.
    const direction =
      view.kind === "fit"
        ? camera.position.clone().sub(controls.target).normalize()
        : DIRECTIONS[view.kind].clone();

    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(direction, distance);
    camera.updateProjectionMatrix();
    controls.update();
    // Keyed on the nonce, so asking for the same view twice still fires.
  }, [view, controls, camera, polygon, rooms, showOtherRooms, hiddenRoomIds, activeRoomIndex, size]);

  return null;
}
