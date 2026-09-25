import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The app has no server actions, but vinext treats every multipart POST
      // without an action ID as a server-action form and applies this limit
      // before the route handler runs (1 MB by default). Keep it above the
      // 30 MB upload cap in lib/server/api.ts so photo uploads reach the API.
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
