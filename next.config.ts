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
  // Security headers for pages and API responses. There is deliberately no
  // script-src policy: pages carry inline React Server Components scripts.
  // vinext reads each `source` as a regular expression, so the rules below
  // avoid nested groups and never set the same header twice for one path.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      // Nothing may frame the site, except as allowed below.
      {
        source: "/(?!m/|api/imports/)(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
      // Restaurants may embed their guest menu on their own website.
      {
        source: "/m/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'",
          },
        ],
      },
      // The menu importer shows the uploaded original (a PDF or photo) in a
      // frame inside the workspace.
      {
        source: "/api/imports/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
