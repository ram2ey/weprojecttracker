import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  // Sharp loads companion DLLs/shared libraries dynamically. Include the
  // installed platform packages in standalone builds on Windows and Linux.
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/@img/sharp-*/**/*",
      "node_modules/@img/sharp-libvips-*/**/*",
      "src/assets/fonts/NotoSans-Regular.ttf",
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      ...[
        "/",
        "/projects",
        "/projects/:slug",
        "/information/:slug",
        "/updates",
        "/about",
        "/announcements",
        "/reports",
        "/following",
      ].map((source) => ({
        source,
        headers: [{ key: "X-Public-Cache", value: "public-page-v1" }],
      })),
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/staff/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};
export default nextConfig;
