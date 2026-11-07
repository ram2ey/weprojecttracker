import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests/e2e",
  timeout: 60000,
  projects: [
    {
      name: "phone-360",
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-430",
      use: {
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
