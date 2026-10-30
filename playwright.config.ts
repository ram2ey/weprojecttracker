import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    timeout: 300000,
  },
});
