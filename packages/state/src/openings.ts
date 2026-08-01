import type { Opening } from "@layra/types";

/** Smallest opening worth cutting, in metres. */
export const MIN_OPENING = 0.3;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/**
 * Pulls an opening back inside its wall.
 *
 * Sliders clamp rather than refuse, unlike placement - the user is actively
 * dragging, so stopping at the limit reads better than snapping back.
 */
export function clampOpening(
  opening: Opening,
  wallLength: number,
  wallHeight: number,
): Opening {
  const width = clamp(opening.width, MIN_OPENING, wallLength);
  const height = clamp(opening.height, MIN_OPENING, wallHeight);
  return {
    ...opening,
    width,
    height,
    offset: clamp(opening.offset, 0, wallLength - width),
    sillHeight: clamp(opening.sillHeight, 0, wallHeight - height),
  };
}

export function sameOpening(a: Opening, b: Opening): boolean {
  return (
    a.offset === b.offset &&
    a.width === b.width &&
    a.height === b.height &&
    a.sillHeight === b.sillHeight
  );
}
