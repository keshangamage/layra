import type { Scene } from "@layra/types";
import { parseScene, serializeScene } from "./serialize";
import type { EditorStore } from "./store";

/** The slice of Web Storage this needs, so tests can pass a plain object. */
export interface SceneStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const AUTOSAVE_KEY = "layra.scene";

/** Returns null for anything unreadable, so a bad entry never blocks startup. */
export function readAutosave(
  storage: SceneStorage,
  key: string = AUTOSAVE_KEY,
): Scene | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  const result = parseScene(raw);
  return result.ok ? result.scene : null;
}

/** Swallows quota and privacy-mode errors; autosave must never break editing. */
export function writeAutosave(
  storage: SceneStorage,
  scene: Scene,
  key: string = AUTOSAVE_KEY,
): boolean {
  try {
    storage.setItem(key, serializeScene(scene));
    return true;
  } catch {
    return false;
  }
}

export function clearAutosave(storage: SceneStorage, key: string = AUTOSAVE_KEY): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
}

export interface AutosaveOptions {
  key?: string;
  /** Milliseconds of quiet before writing. Keeps drags off the disk. */
  debounceMs?: number;
}

/**
 * Persists the scene whenever it changes. Returns a function that stops it.
 *
 * Only the scene is watched, so switching modes or selecting furniture does
 * not trigger a write.
 */
export function attachAutosave(
  store: EditorStore,
  storage: SceneStorage,
  options: AutosaveOptions = {},
): () => void {
  const key = options.key ?? AUTOSAVE_KEY;
  const debounceMs = options.debounceMs ?? 500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous = store.getState().scene;

  const unsubscribe = store.subscribe((state) => {
    if (state.scene === previous) return;
    previous = state.scene;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      writeAutosave(storage, store.getState().scene, key);
    }, debounceMs);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
