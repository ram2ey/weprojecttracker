import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "public/sw.js",
    ".next/**",
    ".next-test/**",
    ".next-ci/**",
    ".local/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
