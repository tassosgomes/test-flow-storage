import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tfs/schema"],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
