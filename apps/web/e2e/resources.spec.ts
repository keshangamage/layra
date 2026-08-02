import { expect, test, type Page } from "@playwright/test";

const ROOM_CORNERS = [
  { x: 0.4, y: 0.55 },
  { x: 0.6, y: 0.55 },
  { x: 0.66, y: 0.72 },
  { x: 0.34, y: 0.72 },
];

interface Info {
  geometries: number;
  textures: number;
  programs: number;
  frames: number;
  calls: number;
}

async function info(page: Page): Promise<Info> {
  return page.evaluate(
    () => (window as unknown as { __layraInfo: () => Info }).__layraInfo(),
  );
}

async function waitForCanvas(page: Page) {
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector("canvas");
    const gl = element?.getContext("webgl2") ?? element?.getContext("webgl");
    return Boolean(gl) && !gl!.isContextLost();
  });
  await page.waitForTimeout(400);
}

async function drawRoom(page: Page) {
  await waitForCanvas(page);
  const box = (await page.locator("canvas").boundingBox())!;
  for (const corner of ROOM_CORNERS) {
    await page.mouse.click(
      box.x + box.width * corner.x,
      box.y + box.height * corner.y,
    );
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("text=Floor area")).toBeVisible();
  await page.waitForTimeout(600);
}

/** The Thickness range input in the Walls panel. */
function thicknessSlider(page: Page) {
  return page.locator('label:has-text("Thickness") input[type="range"]');
}


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

test("does not rebuild geometry while idle", async ({ page }) => {
  // The spec requires memoized geometry: an idle scene must not re-extrude.
  await drawRoom(page);

  const before = await info(page);
  await page.waitForTimeout(1500);
  const after = await info(page);

  expect(after.frames).toBeGreaterThan(before.frames);
  expect(after.geometries).toBe(before.geometries);
});

test("disposes geometry when wall thickness changes", async ({ page }) => {
  await drawRoom(page);
  const baseline = await info(page);

  const slider = thicknessSlider(page);
  for (const value of ["0.25", "0.3", "0.35", "0.4", "0.45", "0.5"]) {
    await slider.fill(value);
  }
  await page.waitForTimeout(600);

  const after = await info(page);
  // Walls and floor are replaced, not accumulated: six changes must not leave
  // six extra geometries behind.
  expect(after.geometries).toBeLessThanOrEqual(baseline.geometries + 1);
});

test("holds steady across many geometry rebuilds", async ({ page }) => {
  await drawRoom(page);
  const slider = thicknessSlider(page);

  await slider.fill("0.2");
  await page.waitForTimeout(400);
  const baseline = await info(page);

  for (let i = 0; i < 30; i++) {
    // Range inputs reject values with trailing zeros, so normalise.
    await slider.fill(String(Number((0.1 + (i % 20) * 0.02).toFixed(2))));
  }
  await slider.fill("0.2");
  await page.waitForTimeout(800);

  const after = await info(page);
  expect(after.geometries).toBeLessThanOrEqual(baseline.geometries + 1);
  expect(after.programs).toBeLessThanOrEqual(baseline.programs + 2);
});

test("releases furniture geometry when a piece is deleted", async ({ page }) => {
  await drawRoom(page);
  const baseline = await info(page);

  await placeItem(page, /Sofa/, await roomCentre(page));
  await expect(page.locator("text=Add Sofa (3 seat)")).toBeVisible();
  await page.waitForTimeout(400);
  expect((await info(page)).geometries).toBeGreaterThan(baseline.geometries);

  await page.keyboard.press("Delete");
  await page.waitForTimeout(600);
  expect((await info(page)).geometries).toBeLessThanOrEqual(baseline.geometries + 1);
});
