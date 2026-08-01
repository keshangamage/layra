// Editor store and the do()/undo() command stack.
// Imports zustand/vanilla only - this package stays free of React.

export {
  addPlacement,
  closeRoom,
  loadScene,
  movePlacement,
  moveVertex,
  removePlacement,
  roomFromPolygon,
  rotatePlacement,
  setWallSettings,
  wallSettingsOf,
  type Command,
  type WallSettings,
} from "./commands";

export { CATALOG, findCatalogItem } from "./catalog";

export {
  DEFAULT_SNAP,
  DEFAULT_WALLS,
  createEditorStore,
  currentWallSettings,
  historyLabels,
  livePolygon,
  type EditorState,
  type EditorStore,
  type Mode,
  type SnapSettings,
} from "./store";

export { snapFrom, snapPoint, snapToGrid } from "./snap";

export { parseScene, serializeScene, type ParseResult } from "./serialize";
