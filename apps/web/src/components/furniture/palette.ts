import type { FurnitureFinish } from "@layra/types";

export interface Palette {
  wood: string;
  darkWood: string;
  /** Main upholstery. */
  fabric: string;
  /** Seat and back cushions, a shade off the frame so the form reads. */
  cushion: string;
  /** Scatter cushions, throws, book spines. */
  accent: string;
  metal: string;
  /** Painted casework and appliance shells. */
  shell: string;
  stone: string;
}

const PALETTES: Record<FurnitureFinish, Palette> = {
  natural: {
    wood: "#a9784d",
    darkWood: "#5c3d29",
    fabric: "#5d6a58",
    cushion: "#8b9a83",
    accent: "#c08a52",
    metal: "#8d9298",
    shell: "#e4ded4",
    stone: "#d8d2c7",
  },
  painted: {
    wood: "#d9d2c6",
    darkWood: "#9b9184",
    fabric: "#6b7d8f",
    cushion: "#a3b2c0",
    accent: "#d8b98c",
    metal: "#9aa0a6",
    shell: "#eeeae3",
    stone: "#e6e2da",
  },
  fabric: {
    wood: "#7d6a5b",
    darkWood: "#493c33",
    fabric: "#95765e",
    cushion: "#c4a88f",
    accent: "#5f7381",
    metal: "#8b857e",
    shell: "#ded5c9",
    stone: "#cfc7bb",
  },
  leather: {
    wood: "#7a4530",
    darkWood: "#432a20",
    fabric: "#8a4a31",
    cushion: "#b46f4d",
    accent: "#4d5a60",
    metal: "#8e857a",
    shell: "#d9cec1",
    stone: "#c9c0b4",
  },
  metal: {
    wood: "#7c848c",
    darkWood: "#3a4148",
    fabric: "#5c6773",
    cushion: "#8b97a4",
    accent: "#b9c4cd",
    metal: "#c4cbd1",
    shell: "#dfe3e7",
    stone: "#d5d9dd",
  },
};

export function paletteFor(finish: FurnitureFinish | undefined): Palette {
  return PALETTES[finish ?? "natural"];
}

/** Leather finishes get pebbled hide on upholstery; everything else gets weave. */
export function upholsteryKind(finish: FurnitureFinish | undefined) {
  return finish === "leather" ? ("leather" as const) : ("fabric" as const);
}
