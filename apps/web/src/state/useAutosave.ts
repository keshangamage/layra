"use client";

import { useEffect } from "react";
import { attachAutosave, readAutosave } from "@layra/state";
import { editorStore } from "./editor";

/**
 * Restores the last scene on mount, then keeps saving it.
 *
 * No readiness gate is needed: autosave only writes when the scene changes,
 * and mounting the canvas does not change it.
 */
export function useAutosave(): void {
  useEffect(() => {
    // localStorage is absent during SSR and can throw when blocked.
    if (typeof window === "undefined") return;

    const saved = readAutosave(window.localStorage);
    if (saved) editorStore.getState().resetScene(saved);

    return attachAutosave(editorStore, window.localStorage);
  }, []);
}
