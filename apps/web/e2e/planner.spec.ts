import { expect, test, type Page } from "@playwright/test";

/** Canvas-relative points that trace a rectangle on the ground plane. */
const ROOM_CORNERS = [
  { x: 0.40, y: 0.55 },
  { x: 0.60, y: 0.55 },
  { x: 0.66, y: 0.72 },
  { x: 0.34, y: 0.72 },
];

/**
 * Waits for a live WebGL context, which means the Canvas mounted and its
 * children ran their effects. Clicking before this races the pointer listeners.
 */
async function waitForCanvas(page: Page) {
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector("canvas");
    const gl = element?.getContext("webgl2") ?? element?.getContext("webgl");
    return Boolean(gl) && !gl!.isContextLost();
  });
  await page.waitForTimeout(300);
}

async function canvasBox(page: Page) {
  await waitForCanvas(page);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("canvas has no box");
  return box;
}

async function drawRoom(page: Page) {
  const box = await canvasBox(page);
  for (const corner of ROOM_CORNERS) {
    await page.mouse.click(box.x + box.width * corner.x, box.y + box.height * corner.y);
  }
  await page.keyboard.press("Enter");
}

/** A dead canvas screenshots as one flat colour. */
async function screenshotVariety(page: Page): Promise<number> {
  const shot = await page.locator("canvas").screenshot();
  const seen = new Set<string>();
  for (let i = 0; i < shot.length - 3; i += 997) {
    seen.add(`${shot[i]},${shot[i + 1]},${shot[i + 2]}`);
  }
  return seen.size;
}

// Each test gets a fresh browser context, so localStorage starts empty.
// Do not clear it via addInitScript: that also runs on reload, which would
// wipe the autosave before the app could read it back.

/** Screen position of the room's centre, via the test hook. */
async function roomCentre(page: Page): Promise<{ x: number; y: number }> {
  const points = await page.evaluate(
    () =>
      (window as unknown as {
        __layraStore: { getState(): { scene: { room: { polygon: { x: number; z: number }[] } } } };
      }).__layraStore.getState().scene.room.polygon,
  );
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return page.evaluate(
    ([x, z]) =>
      (window as unknown as {
        __layraProject: (x: number, z: number) => { x: number; y: number };
      }).__layraProject(x as number, z as number),
    [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2],
  );
}


/**
 * Arms a catalog item and clicks to place it.
 *
 * Waits for the ghost rather than the sidebar hint: the hint lives in the DOM
 * tree while the placer's listeners attach inside R3F's separate reconciler,
 * so the two do not update in step.
 */
async function placeItem(page: Page, name: RegExp, target: { x: number; y: number }) {
  await page.getByRole("button", { name }).click();
  // Nudge until the ghost appears: the placer's listeners attach inside R3F's
  // own reconciler, so a single move can land before they exist and nothing
  // would re-trigger it.
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(target.x + (i % 2), target.y);
    const armed = await page.evaluate(
      () =>
        (window as unknown as {
          __layraStore: { getState(): { furnitureGhost: unknown } };
        }).__layraStore.getState().furnitureGhost !== null,
    );
    if (armed) break;
    await page.waitForTimeout(50);
  }
  await page.mouse.click(target.x, target.y);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("boots with a live WebGL context", async ({ page }) => {
  await waitForCanvas(page);

  const state = await page.evaluate(() => {
    const element = document.querySelector("canvas");
    const gl = element?.getContext("webgl2") ?? element?.getContext("webgl");
    return gl ? { lost: gl.isContextLost() } : null;
  });

  expect(state).not.toBeNull();
  expect(state?.lost).toBe(false);
  await expect(page.locator("text=3D view lost its graphics context")).toHaveCount(0);
});

test("renders something rather than a blank rectangle", async ({ page }) => {
  await waitForCanvas(page);
  await page.waitForTimeout(1000);
  expect(await screenshotVariety(page)).toBeGreaterThan(5);
});

test("draws a room and reports its measurements", async ({ page }) => {
  await expect(page.locator("text=Draw a room to see measurements")).toBeVisible();

  await drawRoom(page);

  await expect(page.locator("text=Floor area")).toBeVisible();
  await expect(page.locator("text=Draw room (4 walls)")).toBeVisible();
  await expect(page.getByRole("button", { name: "edit" })).toBeEnabled();
});

test("undoes and redoes with the keyboard", async ({ page }) => {
  await drawRoom(page);
  await expect(page.locator("text=Draw room (4 walls)")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator("text=Draw a room to see measurements")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.locator("text=Floor area")).toBeVisible();
});

test("places furniture where you click", async ({ page }) => {
  await drawRoom(page);

  await placeItem(page, /Sofa/, await roomCentre(page));
  await expect(page.locator("text=Add Sofa (3 seat)")).toBeVisible();
});

test("keeps the scene across a reload", async ({ page }) => {
  await drawRoom(page);
  await expect(page.locator("text=Floor area")).toBeVisible();

  // Autosave debounces for 500ms.
  await page.waitForTimeout(900);
  await page.reload();

  await expect(page.locator("text=Floor area")).toBeVisible();
  // Restoring is not a user action, so history starts empty.
  await expect(page.locator("text=Draw room (4 walls)")).toHaveCount(0);
});

test("exports an svg plan", async ({ page }) => {
  await drawRoom(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  expect((await download).suggestedFilename()).toBe("layra-plan.svg");
});

test("renders labels without reaching the network", async ({ page }) => {
  // troika fetches four files from a CDN unless Text is given an explicit
  // font, which means no dimensions offline or behind a strict CSP.
  const offOrigin: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    // blob: is troika's own worker, which is local.
    if (/^https?:\/\//.test(url) && !url.startsWith("http://localhost")) {
      offOrigin.push(url);
    }
  });

  await drawRoom(page);
  // Wall labels mount with the room; give the font time to load.
  await page.waitForTimeout(2000);

  expect(offOrigin).toEqual([]);
  await expect(page.locator("canvas")).toBeVisible();
  const size = await page.evaluate(() => {
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  });
  // Guards the display:none regression: a suspended font hid the whole canvas.
  expect(size.w).toBeGreaterThan(0);
  expect(size.h).toBeGreaterThan(0);
});
