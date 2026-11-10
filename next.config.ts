import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/@img/sharp-*/**/*",
      "node_modules/@img/sharp-libvips-*/**/*",
    ],
  },
  async redirects() {
    return ["q", "category", "community", "status", "page"].map((key) => ({
      source: "/",
      has: [{ type: "query" as const, key, value: ".*" }],
      destination: "/projects",
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Browsers ignore this over plain HTTP, so local development is unaffected.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      ...["/admin/:path*", "/staff/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      })),
    ];
  },
};
export default nextConfig;
