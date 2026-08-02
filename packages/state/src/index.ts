// Editor store and the do()/undo() command stack.
// Imports zustand/vanilla only - this package stays free of React.

export {
  addOpening,
  addPlacement,
  addVertex,
  closeRoom,
  loadScene,
  movePlacement,
  moveVertex,
  removeOpening,
  removePlacement,
  removeVertex,
  roomFromPolygon,
  rotatePlacement,
  setPlacementLock,
  setPlacementRotation,
  setWallSettings,
  transformPlacement,
  updateOpening,
  wallSettingsOf,
  type Command,
  type WallSettings,
} from "./commands";

export { CATALOG, findCatalogItem } from "./catalog";

export {
  DEFAULT_MOUNT_HEIGHT,
  WALL_SNAP_DISTANCE,
  mountToWall,
  snapFloorToWall,
  type Mounted,
} from "./mounting";

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
  type OpeningShape,
  type SnapSettings,
} from "./store";

export { snapFrom, snapPoint, snapToGrid } from "./snap";

export { parseScene, serializeScene, type ParseResult } from "./serialize";

export { sceneToSvg, type SvgOptions } from "./svg";

export {
  AUTOSAVE_KEY,
  attachAutosave,
  clearAutosave,
  readAutosave,
  writeAutosave,
  type AutosaveOptions,
  type SceneStorage,
} from "./autosave";

export { MIN_OPENING, clampOpening, sameOpening } from "./openings";
