import type { Scene, Vec2 } from "@layra/types";
import {
  edgeLabels,
  ensureCCW,
  formatArea,
  formatLength,
  openingFootprint,
  polygonArea,
  rectCorners,
  wallLoops,
} from "@layra/geometry";
import { findCatalogItem } from "./catalog";
import { findFloorMaterial } from "./materials";
import { placementRect } from "./collision";

export interface SvgOptions {
  pixelsPerMetre?: number;
  /** Page margin in pixels. */
  margin?: number;
  showDimensions?: boolean;
  showFurniture?: boolean;
  showLabels?: boolean;
  showOpenings?: boolean;
}

const DEFAULTS = {
  pixelsPerMetre: 50,
  margin: 48,
  showDimensions: true,
  showFurniture: true,
  showLabels: true,
  showOpenings: true,
};

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Two decimals keeps the file small and the output stable. */
function n(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

/**
 * SVG y runs downward, which matches +z when looking down at the plan, so
 * z maps straight to y with no flip.
 */
interface Transform {
  (point: Vec2): { x: number; y: number };
}

function pathOf(points: readonly Vec2[], to: Transform): string {
  return (
    points
      .map((p, i) => {
        const { x, y } = to(p);
        return `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`;
      })
      .join(" ") + " Z"
  );
}

/** Renders the scene as a printable 2D floor plan. */
export function sceneToSvg(scene: Scene, options: SvgOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };
  const { polygon } = scene.room;

  if (polygon.length < 3) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><text x="12" y="44" font-family="sans-serif" font-size="14" fill="#71717a">No room drawn</text></svg>`;
  }

  const centreline = ensureCCW(polygon);
  const thickness = scene.room.walls[0]?.thickness ?? 0;
  const { inner, outer } = wallLoops(centreline, thickness);

  const furniture = opts.showFurniture
    ? scene.placements
        .map((placement) => {
          const rect = placementRect(placement);
          const item = findCatalogItem(placement.catalogItemId);
          return rect && item
            ? { corners: rectCorners(rect), name: item.name, centre: rect.center }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  // Bound everything drawn, not just the walls, so nothing clips.
  const all: Vec2[] = [...outer, ...furniture.flatMap((f) => f.corners)];
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minZ = Math.min(...all.map((p) => p.z));
  const maxZ = Math.max(...all.map((p) => p.z));

  const scale = opts.pixelsPerMetre;
  const margin = opts.margin;
  const width = (maxX - minX) * scale + margin * 2;
  const height = (maxZ - minZ) * scale + margin * 2;

  const to: Transform = (p) => ({
    x: (p.x - minX) * scale + margin,
    y: (p.z - minZ) * scale + margin,
  });

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}">`,
  );
  parts.push(`<rect width="${n(width)}" height="${n(height)}" fill="#ffffff"/>`);

  // Walls as a single filled shell: outer loop with the inner loop as a hole.
  parts.push(
    `<path d="${pathOf(outer, to)} ${pathOf(inner, to)}" fill="#d4d4d8" fill-rule="evenodd" stroke="#27272a" stroke-width="1.5"/>`,
  );
  const floor = findFloorMaterial(scene.room.floorMaterial);
  parts.push(`<path d="${pathOf(inner, to)}" fill="${floor.color}" stroke="none"/>`);

  // Openings: erase the wall across the gap, then draw the symbol. A door gets
  // a leaf and swing arc, a window a pane line.
  if (opts.showOpenings) {
    for (const wall of scene.room.walls) {
      for (const opening of wall.openings) {
        const plan = openingFootprint(wall.start, wall.end, opening, wall.thickness);
        if (!plan) continue;

        parts.push(
          `<path d="${pathOf(plan.gap, to)}" fill="${floor.color}" stroke="none"/>`,
        );

        const a = to(plan.gap[0]!);
        const b = to(plan.gap[1]!);
        const c = to(plan.gap[3]!);
        const d = to(plan.gap[2]!);

        if (opening.type === "window") {
          // Pane line down the middle of the gap.
          parts.push(
            `<path d="M${n((a.x + c.x) / 2)} ${n((a.y + c.y) / 2)} L${n((b.x + d.x) / 2)} ${n((b.y + d.y) / 2)}" stroke="#27272a" stroke-width="1" fill="none"/>`,
          );
          parts.push(
            `<path d="M${n(a.x)} ${n(a.y)} L${n(b.x)} ${n(b.y)} M${n(c.x)} ${n(c.y)} L${n(d.x)} ${n(d.y)}" stroke="#27272a" stroke-width="1" fill="none"/>`,
          );
          continue;
        }

        // Door: leaf swung a quarter turn into the room, plus its arc.
        const hinge = to(plan.hinge);
        const leaf = to({
          x: plan.hinge.x + plan.inward.x * opening.width,
          z: plan.hinge.z + plan.inward.z * opening.width,
        });
        const swing: string[] = [];
        const steps = 12;
        for (let s = 0; s <= steps; s++) {
          const angle = (s / steps) * (Math.PI / 2);
          const world = {
            x:
              plan.hinge.x +
              (plan.inward.x * Math.cos(angle) + plan.along.x * Math.sin(angle)) *
                opening.width,
            z:
              plan.hinge.z +
              (plan.inward.z * Math.cos(angle) + plan.along.z * Math.sin(angle)) *
                opening.width,
          };
          const point = to(world);
          swing.push(`${s === 0 ? "M" : "L"}${n(point.x)} ${n(point.y)}`);
        }

        parts.push(
          `<path d="M${n(hinge.x)} ${n(hinge.y)} L${n(leaf.x)} ${n(leaf.y)}" stroke="#52525b" stroke-width="1" fill="none"/>`,
        );
        parts.push(
          `<path d="${swing.join(" ")}" stroke="#a1a1aa" stroke-width="0.75" fill="none" stroke-dasharray="3 2"/>`,
        );
      }
    }
  }

  for (const piece of furniture) {
    parts.push(
      `<path d="${pathOf(piece.corners, to)}" fill="#e4e4e7" stroke="#52525b" stroke-width="1"/>`,
    );
    if (opts.showLabels) {
      const c = to(piece.centre);
      parts.push(
        `<text x="${n(c.x)}" y="${n(c.y)}" font-family="sans-serif" font-size="9" fill="#52525b" text-anchor="middle" dominant-baseline="middle">${escapeText(piece.name)}</text>`,
      );
    }
  }

  if (opts.showDimensions) {
    for (const label of edgeLabels(centreline, thickness / 2 + 0.3)) {
      const p = to(label.position);
      const degrees = (label.angle * 180) / Math.PI;
      parts.push(
        `<text x="${n(p.x)}" y="${n(p.y)}" font-family="sans-serif" font-size="11" fill="#3f3f46" text-anchor="middle" dominant-baseline="middle" transform="rotate(${n(degrees)} ${n(p.x)} ${n(p.y)})">${formatLength(label.length)}</text>`,
      );
    }
  }

  parts.push(
    `<text x="${n(margin)}" y="${n(height - margin / 2)}" font-family="sans-serif" font-size="11" fill="#71717a">Floor area ${formatArea(polygonArea(inner))} &#183; 1:${n(100 / (scale / 50))} at 50px/m</text>`,
  );

  parts.push("</svg>");
  return parts.join("\n");
}
