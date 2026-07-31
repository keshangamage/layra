import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // tsconfig sets jsx:"preserve" for Next, which oxc inherits; override it here.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // happy-dom, not jsdom: jsdom 30 pulls undici 8, which needs Node 22.
    environment: "happy-dom",
    include: ["src/**/*.test.tsx"],
  },
});
