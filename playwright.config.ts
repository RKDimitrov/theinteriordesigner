import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// The dev server is NOT started by Playwright. Run `npm run dev` in another
// terminal first (or set E2E_BASE_URL to a deployed preview).
const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

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
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
