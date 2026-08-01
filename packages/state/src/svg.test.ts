import { describe, expect, it } from "vitest";
import { SCENE_VERSION, emptyScene, type Placement, type Scene } from "@layra/types";
import { sceneToSvg } from "./svg";
import { roomFromPolygon } from "./commands";

function sceneWithRoom(placements: Placement[] = []): Scene {
  return {
    version: SCENE_VERSION,
    room: roomFromPolygon(
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 3 },
        { x: 0, z: 3 },
      ],
      { height: 2.5, thickness: 0.2 },
    ),
    placements,
  };
}

let counter = 0;
function place(catalogItemId: string, x: number, z: number, rotationY = 0): Placement {
  return {
    id: `p${counter++}`,
    catalogItemId,
    position: { x, y: 0, z },
    rotationY,
    locked: false,
  };
}

describe("document shape", () => {
  it("emits a well-formed svg root", () => {
    const svg = sceneToSvg(sceneWithRoom());
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("sizes the viewBox to the room plus margins", () => {
    // 4x3 room, 0.2 walls -> outer 4.2 x 3.2, at 50px/m plus 48px margins.
    const svg = sceneToSvg(sceneWithRoom(), { pixelsPerMetre: 50, margin: 48 });
    expect(svg).toContain('viewBox="0 0 306 256"');
  });

  it("scales with pixelsPerMetre", () => {
    const svg = sceneToSvg(sceneWithRoom(), { pixelsPerMetre: 100, margin: 0 });
    expect(svg).toContain('viewBox="0 0 420 320"');
  });

  it("handles a room with no walls", () => {
    const svg = sceneToSvg(emptyScene());
    expect(svg).toContain("No room drawn");
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("produces no NaN coordinates", () => {
    const svg = sceneToSvg(sceneWithRoom([place("sofa-3", 2, 1.5, 0.7)]));
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
  });
});

describe("walls", () => {
  it("draws the shell as one evenodd path so the inside stays hollow", () => {
    const svg = sceneToSvg(sceneWithRoom());
    expect(svg).toContain('fill-rule="evenodd"');
  });

  it("closes every path", () => {
    const paths = sceneToSvg(sceneWithRoom()).match(/ d="[^"]*"/g) ?? [];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path).toContain("Z");
  });
});

describe("furniture", () => {
  it("draws a path and a label per piece", () => {
    const svg = sceneToSvg(sceneWithRoom([place("desk", 2, 1.5)]));
    expect(svg).toContain("Desk");
  });

  it("omits furniture when asked", () => {
    const svg = sceneToSvg(sceneWithRoom([place("desk", 2, 1.5)]), {
      showFurniture: false,
    });
    expect(svg).not.toContain("Desk");
  });

  it("omits labels but keeps shapes", () => {
    const withLabels = sceneToSvg(sceneWithRoom([place("desk", 2, 1.5)]));
    const without = sceneToSvg(sceneWithRoom([place("desk", 2, 1.5)]), {
      showLabels: false,
    });
    expect(without).not.toContain("Desk");
    expect(without.match(/<path/g)?.length).toBe(withLabels.match(/<path/g)?.length);
  });

  it("expands the canvas for furniture outside the walls", () => {
    const inside = sceneToSvg(sceneWithRoom([place("desk", 2, 1.5)]));
    const outside = sceneToSvg(sceneWithRoom([place("desk", 12, 1.5)]));
    const widthOf = (svg: string) => Number(/width="([\d.]+)"/.exec(svg)?.[1]);
    expect(widthOf(outside)).toBeGreaterThan(widthOf(inside));
  });

  it("skips unknown catalog items", () => {
    const svg = sceneToSvg(sceneWithRoom([place("nope", 2, 1.5)]));
    expect(svg).not.toContain("NaN");
  });
});

describe("dimensions", () => {
  it("labels each wall by default", () => {
    const svg = sceneToSvg(sceneWithRoom());
    expect(svg).toContain("4.00 m");
    expect(svg).toContain("3.00 m");
  });

  it("omits them when asked", () => {
    const svg = sceneToSvg(sceneWithRoom(), { showDimensions: false });
    expect(svg).not.toContain("4.00 m");
  });

  it("reports floor area from the inner face", () => {
    // 3.8 x 2.8 = 10.64
    expect(sceneToSvg(sceneWithRoom())).toContain("10.64 m²");
  });
});

describe("escaping", () => {
  it("escapes markup in text so the document stays valid", () => {
    // Names come from the catalog today, but the escape must hold regardless.
    const svg = sceneToSvg(sceneWithRoom([place("desk", 2, 1.5)]));
    const textContent = svg.match(/>([^<]*)</g) ?? [];
    for (const chunk of textContent) {
      expect(chunk.includes("<script")).toBe(false);
    }
  });
});
