"use client";

import { useEffect } from "react";
import { editor } from "@/state/editor";

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

/**
 * Only true text entry swallows undo. Range sliders keep focus after a drag,
 * so treating every input as text would break Cmd+Z on the wall settings.
 */
function isTextEntry(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === "TEXTAREA") return true;
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type);
  return false;
}

export function KeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) return;

      if (!event.metaKey && !event.ctrlKey) {
        if (event.key === "Delete" || event.key === "Backspace") {
          if (editor().selectedId === null) return;
          event.preventDefault();
          editor().deleteSelected();
        } else if (event.key.toLowerCase() === "r" && editor().selectedId !== null) {
          event.preventDefault();
          // Shift reverses; 15 degrees matches the drawing angle snap.
          editor().rotateSelected((event.shiftKey ? -1 : 1) * (Math.PI / 12));
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "d") {
        event.preventDefault();
        editor().duplicateSelected();
        return;
      }
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) editor().redo();
        else editor().undo();
      } else if (key === "y") {
        // Windows convention for redo.
        event.preventDefault();
        editor().redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
