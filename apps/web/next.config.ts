import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack transpiles workspace packages automatically, but the docs enumerate
  // npm/pnpm/Yarn workspaces - not bun. Declared explicitly so the just-in-time
  // TypeScript exports from packages/* resolve regardless.
  transpilePackages: ["@layra/types", "@layra/geometry", "@layra/state"],
};

export default nextConfig;
