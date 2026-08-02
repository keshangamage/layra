import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the e2e suite build to its own directory, so it never collides with
  // a dev server already using .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // Turbopack transpiles workspace packages automatically, but the docs enumerate
  // npm/pnpm/Yarn workspaces - not bun. Declared explicitly so the just-in-time
  // TypeScript exports from packages/* resolve regardless.
  transpilePackages: ["@layra/types", "@layra/geometry", "@layra/state"],
};

export default nextConfig;
