"use client";

import { useStore } from "zustand";
import { createEditorStore, type EditorState } from "@layra/state";

// Module singleton rather than React context: R3F's Canvas mounts its own
// reconciler root, so context from the DOM tree doesn't reach scene components.
export const editorStore = createEditorStore();

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, selector);
}

/** For event handlers that need the latest state without subscribing. */
export function editor(): EditorState {
  return editorStore.getState();
}
