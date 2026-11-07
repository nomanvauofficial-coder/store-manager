import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo-name>/, the workflow sets this.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
};

export default nextConfig;
