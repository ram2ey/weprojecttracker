import type { NextConfig } from "next";
const offlineScriptHash = "sha256-fMrO7Uq5sHdWzOQDqWY1ciHOD7u8iX4uBSgz2lZ4b1k=";
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
        source: "/notification-sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Static offline page stored by the service worker. It skips the
        // proxy's per-request nonce, so its one inline script is allowed by hash
        // (tests/app-mode.test.ts keeps the hash in step with the file).
        source: "/offline.html",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src '${offlineScriptHash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
          },
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
