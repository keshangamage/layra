import { expect, test, type Page } from "@playwright/test";

const ROOM_CORNERS = [
  { x: 0.4, y: 0.55 },
  { x: 0.6, y: 0.55 },
  { x: 0.66, y: 0.72 },
  { x: 0.34, y: 0.72 },
];

async function waitForCanvas(page: Page) {
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector("canvas");
    const gl = element?.getContext("webgl2") ?? element?.getContext("webgl");
    return Boolean(gl) && !gl!.isContextLost();
  });
  await page.waitForTimeout(300);
}

async function box(page: Page) {
  await waitForCanvas(page);
  const found = await page.locator("canvas").boundingBox();
  if (!found) throw new Error("canvas has no box");
  return found;
}

function at(b: { x: number; y: number; width: number; height: number }, u: number, v: number) {
  return { x: b.x + b.width * u, y: b.y + b.height * v };
}

interface Screen {
  x: number;
  y: number;
}

/**
 * Exact screen position of a ground point, via the test hook.
 *
 * Guessing from the click positions does not work: OrbitControls re-targets to
 * the room centre once the polygon closes, panning the whole view.
 */
async function project(page: Page, x: number, z: number): Promise<Screen> {
  return page.evaluate(
    ([px, pz]) =>
      (window as unknown as {
        __layraProject: (x: number, z: number) => Screen;
      }).__layraProject(px as number, pz as number),
    [x, z],
  );
}

async function polygon(page: Page): Promise<{ x: number; z: number }[]> {
  return page.evaluate(
    () =>
      (window as unknown as {
        __layraStore: { getState(): { scene: { room: { polygon: { x: number; z: number }[] } } } };
      }).__layraStore.getState().scene.room.polygon,
  );
}

async function cornerOnScreen(page: Page, index: number): Promise<Screen> {
  const points = await polygon(page);
  const point = points[index];
  if (!point) throw new Error(`no vertex ${index}`);
  return project(page, point.x, point.z);
}

async function drawRoom(page: Page) {
  const b = await box(page);
  for (const corner of ROOM_CORNERS) {
    const p = at(b, corner.x, corner.y);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("text=Floor area")).toBeVisible();
  // The sidebar updates before the scene does; handles need a frame to mount.
  await page.waitForTimeout(400);
  return b;
}

/** Drags well past the 4px click threshold, in steps so pointermove fires. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

/** History entries, newest last. */
async function history(page: Page): Promise<string[]> {
  return page.locator("section:has(h2:text-is('History')) li").allTextContents();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("dragging a vertex reshapes the room and records one entry", async ({ page }) => {
  await drawRoom(page);
  const areaBefore = await page.locator("text=/\\d+\\.\\d+ m²/").first().textContent();

  // Edit mode is active after closing; handles sit on the corners.
  const corner = await cornerOnScreen(page, 1);
  await drag(page, corner, { x: corner.x + 60, y: corner.y - 30 });

  const entries = await history(page);
  expect(entries.filter((e) => e.startsWith("Move vertex"))).toHaveLength(1);

  const areaAfter = await page.locator("text=/\\d+\\.\\d+ m²/").first().textContent();
  expect(areaAfter).not.toBe(areaBefore);
});

test("a vertex drag is one undo, not one per frame", async ({ page }) => {
  await drawRoom(page);
  const original = await polygon(page);

  const corner = await cornerOnScreen(page, 1);
  await drag(page, corner, { x: corner.x + 60, y: corner.y - 30 });
  expect(await polygon(page)).not.toEqual(original);

  // A single undo must restore the whole gesture, however many frames it took.
  await page.keyboard.press("ControlOrMeta+z");
  expect(await polygon(page)).toEqual(original);
});

test("furniture can be dragged across the floor", async ({ page }) => {
  await drawRoom(page);
  // Place it at the centre of the room's bounds, then drag from there.
  const points = await polygon(page);
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const centre = await project(
    page,
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
  );
  await page.getByRole("button", { name: /Sofa/ }).click();
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(centre.x + (i % 2), centre.y);
    const armed = await page.evaluate(
      () =>
        (window as unknown as {
          __layraStore: { getState(): { furnitureGhost: unknown } };
        }).__layraStore.getState().furnitureGhost !== null,
    );
    if (armed) break;
    await page.waitForTimeout(50);
  }
  await page.mouse.click(centre.x, centre.y);
  await expect(page.locator("text=Add Sofa (3 seat)")).toBeVisible();
  await page.waitForTimeout(300);

  await drag(page, centre, { x: centre.x + 45, y: centre.y + 20 });

  const entries = await history(page);
  expect(entries.filter((e) => e === "Move furniture")).toHaveLength(1);
});

test("clicking a wall places a door", async ({ page }) => {
  await drawRoom(page);
  await page.getByRole("button", { name: "door" }).click();

  // Midpoint of the first wall.
  const points = await polygon(page);
  const wall = await project(
    page,
    (points[0]!.x + points[1]!.x) / 2,
    (points[0]!.z + points[1]!.z) / 2,
  );
  await page.mouse.click(wall.x, wall.y);

  await expect(page.locator("text=Add door")).toBeVisible();
  await expect(page.locator("text=Selected door")).toBeVisible();
});

test("measuring never touches history", async ({ page }) => {
  const b = await drawRoom(page);
  const before = await history(page);

  await page.getByRole("button", { name: "measure" }).click();
  const first = at(b, 0.42, 0.6);
  const second = at(b, 0.58, 0.68);
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);

  expect(await history(page)).toEqual(before);
});

test("the canvas survives a full editing session", async ({ page }) => {
  await drawRoom(page);
  const corner = await cornerOnScreen(page, 3);
  await drag(page, corner, { x: corner.x - 40, y: corner.y + 15 });
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");

  const lost = await page.evaluate(() => {
    const element = document.querySelector("canvas");
    const gl = element?.getContext("webgl2") ?? element?.getContext("webgl");
    return gl ? gl.isContextLost() : true;
  });
  expect(lost).toBe(false);
  await expect(page.locator("text=3D view lost its graphics context")).toHaveCount(0);
});
