"use client";

import { useCallback, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { Vec2 } from "@layra/types";

const GROUND = new Plane(new Vector3(0, 1, 0), 0);

/** Exact ray/Y=0 intersection, so no collider mesh is needed. */
export function useGroundPointer(): (event: PointerEvent) => Vec2 | null {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const hit = useMemo(() => new Vector3(), []);

  return useCallback(
    (event: PointerEvent) => {
      const rect = domElement.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(GROUND, hit) ? { x: hit.x, z: hit.z } : null;
    },
    [camera, domElement, raycaster, ndc, hit],
  );
}
