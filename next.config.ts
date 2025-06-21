import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images:{ remotePatterns:[{hostname:"files.edgestore.dev"}]}
};

export default nextConfig;
