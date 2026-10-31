import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.GITHUB_ACTIONS ? "/omnipay-resilience-engine" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
