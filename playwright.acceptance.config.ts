import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests",
  testMatch: ["acceptance/**/*.spec.ts", "e2e/**/*.spec.ts"],
  timeout: 90000,
  projects: [
    {
      name: "chrome-phone-360",
      testMatch: "acceptance/**/*.spec.ts",
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "chrome-phone-430",
      testMatch: "acceptance/**/*.spec.ts",
      use: {
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "chrome-desktop",
      use: { viewport: { width: 1440, height: 1000 } },
    },
  ],
});
