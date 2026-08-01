// Editor store and the do()/undo() command stack.
// Imports zustand/vanilla only - this package stays free of React.

export {
  addOpening,
  addPlacement,
  closeRoom,
  loadScene,
  movePlacement,
  moveVertex,
  removeOpening,
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
  clearanceRect,
  findCollisions,
  isBlocked,
  placementRect,
  type CollisionReport,
} from "./collision";

export {
  DEFAULT_SNAP,
  DEFAULT_WALLS,
  OPENING_DEFAULTS,
  createEditorStore,
  currentWallSettings,
  historyLabels,
  livePlacements,
  livePolygon,
  type EditorState,
  type EditorStore,
  type Mode,
  type SnapSettings,
} from "./store";

export { snapFrom, snapPoint, snapToGrid } from "./snap";

export { parseScene, serializeScene, type ParseResult } from "./serialize";

export { sceneToSvg, type SvgOptions } from "./svg";
