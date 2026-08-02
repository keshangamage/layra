"use client";

import { useStore } from "zustand";
import { createEditorStore, type EditorState } from "@layra/state";

// Module singleton rather than React context: R3F's Canvas mounts its own
// reconciler root, so context from the DOM tree doesn't reach scene components.
export const editorStore = createEditorStore();

// Test hook. NEXT_PUBLIC_E2E is set only by the e2e build, so this is dead
// code in a normal production bundle. Canvas drags cannot be driven from the
// DOM otherwise, since R3F exposes nothing to reach the camera with.
if (process.env.NEXT_PUBLIC_E2E === "1" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__layraStore = editorStore;
}

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, selector);
}

/** For event handlers that need the latest state without subscribing. */
export function editor(): EditorState {
  return editorStore.getState();
}
