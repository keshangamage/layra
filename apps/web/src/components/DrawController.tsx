"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { Vec2 } from "@layra/types";
import { distance } from "@layra/geometry";
import { snapFrom, snapPoint } from "@layra/state";
import { editor } from "@/state/editor";

const GROUND = new Plane(new Vector3(0, 1, 0), 0);

/** Metres from the first vertex that count as "clicking the start". */
const CLOSE_RADIUS = 0.25;

/** Pointer travel in px below which a press counts as a click, not an orbit drag. */
const CLICK_SLOP = 4;

export function DrawController() {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const raycaster = useMemo(() => new Raycaster(), []);

  useEffect(() => {
    const ndc = new Vector2();
    const hit = new Vector3();

    /** Exact ray/Y=0 intersection — no collider mesh needed. */
    const groundAt = (event: PointerEvent): Vec2 | null => {
      const rect = domElement.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(GROUND, hit)
        ? { x: hit.x, z: hit.z }
        : null;
    };

    /** Angle snap first, then length — the reverse pulls the angle off its increment. */
    const snapped = (raw: Vec2): Vec2 => {
      const { draft, snap } = editor();
      const last = draft.at(-1);
      if (draft.length >= 3 && distance(raw, draft[0]!) < CLOSE_RADIUS) {
        return draft[0]!;
      }
      return last ? snapFrom(last, raw, snap.grid, snap.angle) : snapPoint(raw, snap.grid);
    };

    let pressX = 0;
    let pressY = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (editor().mode !== "draw") return;
      const raw = groundAt(event);
      editor().setCursor(raw ? snapped(raw) : null);
    };

    const onPointerDown = (event: PointerEvent) => {
      pressX = event.clientX;
      pressY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      const state = editor();
      if (state.mode !== "draw" || event.button !== 0) return;
      // Let OrbitControls keep the left button for orbiting.
      if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > CLICK_SLOP) return;

      const raw = groundAt(event);
      if (!raw) return;

      const point = snapped(raw);
      const first = state.draft[0];
      if (first && state.draft.length >= 3 && distance(raw, first) < CLOSE_RADIUS) {
        state.closeDraft();
        return;
      }
      state.addDraftPoint(point);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (editor().mode !== "draw") return;

      if (event.key === "Enter") {
        event.preventDefault();
        editor().closeDraft();
      } else if (event.key === "Escape") {
        event.preventDefault();
        editor().cancelDraft();
      }
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
    };
  }, [camera, domElement, raycaster]);

  return null;
}
