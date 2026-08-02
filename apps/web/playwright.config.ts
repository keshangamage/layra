import { defineConfig, devices } from "@playwright/test";

const PORT = 3199;
const DIST = ".next-e2e";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Headless Chromium needs SwiftShader to give three.js a real
          // WebGL context; without these the canvas silently never renders.
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
  ],
  webServer: {
    // A production build, not `next dev`: Next refuses to run two dev servers
    // for the same directory, so this would fight one you already have open.
    // Its own port and distDir keep the two fully independent.
    command: `NEXT_PUBLIC_E2E=1 NEXT_DIST_DIR=${DIST} bunx next build && NEXT_DIST_DIR=${DIST} bunx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
