import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// The dev server is NOT started by Playwright. Run `npm run dev` in another
// terminal first (or set E2E_BASE_URL to a deployed preview).
const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
// Optional: use an installed browser instead of Playwright's download, e.g. E2E_BROWSER_CHANNEL=chrome.
const channel = process.env["E2E_BROWSER_CHANNEL"] || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { channel } },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel, storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel, storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
