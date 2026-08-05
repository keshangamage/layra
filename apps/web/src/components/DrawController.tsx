"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Vec2 } from "@layra/types";
import { distance } from "@layra/geometry";
import { snapFrom, snapPoint } from "@layra/state";
import { editor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

/** Metres from the first vertex that count as "clicking the start". */
const CLOSE_RADIUS = 0.25;

/** Pointer travel in px below which a press counts as a click, not an orbit drag. */
const CLICK_SLOP = 4;

export function DrawController() {
  const domElement = useThree((state) => state.gl.domElement);
  const groundAt = useGroundPointer();

  useEffect(() => {
    /** Angle snap first, then length - the reverse pulls the angle off its increment. */
    const snapped = (raw: Vec2): Vec2 => {
      const { draft, snap } = editor();
      const first = draft[0];
      if (first && draft.length >= 3 && distance(raw, first) < CLOSE_RADIUS) {
        return first;
      }
      const last = draft.at(-1);
      return last ? snapFrom(last, raw, snap.grid, snap.angle) : snapPoint(raw, snap.grid);
    };

    let pressX = 0;
    let pressY = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (editor().mode !== "draw" && editor().mode !== "wall") return;
      const raw = groundAt(event);
      editor().setCursor(raw ? snapped(raw) : null);
    };

    const onPointerDown = (event: PointerEvent) => {
      pressX = event.clientX;
      pressY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      const state = editor();
      if ((state.mode !== "draw" && state.mode !== "wall") || event.button !== 0) return;
      // Let OrbitControls keep the left button for orbiting.
      if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > CLICK_SLOP) return;

      const raw = groundAt(event);
      if (!raw) return;

      const first = state.draft[0];
      if (first && state.draft.length >= 3 && distance(raw, first) < CLOSE_RADIUS) {
        state.closeDraft();
        return;
      }
      const point = snapped(raw);
      state.addDraftPoint(point);
      if (state.mode === "wall" && state.draft.length === 1) {
        state.closeDraft();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (editor().mode !== "draw" && editor().mode !== "wall") return;

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
  }, [domElement, groundAt]);

  return null;
}
