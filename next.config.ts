import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root; a stray package-lock.json higher up the
  // directory tree otherwise makes Next.js guess the wrong root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
