"use client";

import { useEffect } from "react";
import { editor, useEditor } from "@/state/editor";
import { useGroundPointer } from "./useGroundPointer";

export function RoomDragController() {
  const groundAt = useGroundPointer();
  const dragging = useEditor((state) => state.roomDrag !== null);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      const point = groundAt(event);
      if (point) editor().updateRoomDrag(point);
    };
    const onUp = () => editor().endRoomDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, groundAt]);

  return null;
}
