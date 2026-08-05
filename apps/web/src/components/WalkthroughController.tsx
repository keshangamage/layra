"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { bounds, pointInPolygon, wallLoops } from "@layra/geometry";
import { activeRoom } from "@layra/state";
import { editor, useEditor } from "@/state/editor";
import { Vector3 } from "three";

const EYE_HEIGHT = 1.65;
const WALK_SPEED = 2.2;
const LOOK_SPEED = 0.0022;

export function WalkthroughController() {
  const polygon = useEditor((state) => activeRoom(state).polygon);
  const thickness = useEditor((state) => activeRoom(state).walls[0]?.thickness ?? 0.2);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const keys = useRef(new Set<string>());
  const scratch = useRef({
    direction: new Vector3(),
    right: new Vector3(),
    next: new Vector3(),
  });
  const inner = useMemo(
    () => (polygon.length >= 3 ? wallLoops(polygon, thickness).inner : []),
    [polygon, thickness],
  );

  useEffect(() => {
    if (polygon.length < 3 || inner.length < 3) return;
    const extent = bounds(polygon);
    const current = { x: camera.position.x, z: camera.position.z };
    let start = pointInPolygon(current, inner) ? current : extent.center;
    if (!pointInPolygon(start, inner)) {
      for (let x = extent.min.x; x <= extent.max.x; x += 0.25) {
        for (let z = extent.min.z; z <= extent.max.z; z += 0.25) {
          if (pointInPolygon({ x, z }, inner)) {
            start = { x, z };
            break;
          }
        }
        if (pointInPolygon(start, inner)) break;
      }
    }
    camera.position.set(start.x, EYE_HEIGHT, start.z);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(start.x, EYE_HEIGHT, start.z - 1);
  }, [camera, inner, polygon]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"].includes(event.key)) {
        event.preventDefault();
        keys.current.add(event.key);
      }
      if (event.key === "Escape") editor().setWalking(false);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key);
    const lock = () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    };
    const look = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      camera.rotation.y -= event.movementX * LOOK_SPEED;
      camera.rotation.x -= event.movementY * LOOK_SPEED;
      camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.rotation.x));
    };
    const unlock = () => {
      if (document.pointerLockElement !== canvas) editor().setWalking(false);
    };

    canvas.addEventListener("click", lock);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", look);
    document.addEventListener("pointerlockchange", unlock);
    return () => {
      canvas.removeEventListener("click", lock);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", look);
      document.removeEventListener("pointerlockchange", unlock);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [camera, gl]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (inner.length >= 3) {
        const { direction, right, next } = scratch.current;
        camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        right.crossVectors(direction, camera.up).normalize();
        let x = 0;
        let z = 0;
        if (keys.current.has("w") || keys.current.has("ArrowUp")) z += 1;
        if (keys.current.has("s") || keys.current.has("ArrowDown")) z -= 1;
        if (keys.current.has("d") || keys.current.has("ArrowRight")) x += 1;
        if (keys.current.has("a") || keys.current.has("ArrowLeft")) x -= 1;
        if (x !== 0 || z !== 0) {
          const length = Math.hypot(x, z);
          const speed = WALK_SPEED * (keys.current.has("Shift") ? 1.8 : 1);
          next.copy(camera.position)
            .addScaledVector(right, (x / length) * speed * delta)
            .addScaledVector(direction, (z / length) * speed * delta);
          if (pointInPolygon({ x: next.x, z: next.z }, inner)) {
            camera.position.x = next.x;
            camera.position.z = next.z;
          }
        }
        camera.position.y = EYE_HEIGHT;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [camera, inner]);

  return null;
}
