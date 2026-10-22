import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['172.16.0.22'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
