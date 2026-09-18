import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("sign in with the E2E user", async ({ page }) => {
  const email = process.env["E2E_USER_EMAIL"];
  const password = process.env["E2E_USER_PASSWORD"];
  if (!email || !password) throw new Error("Set E2E_USER_EMAIL and E2E_USER_PASSWORD in .env");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/apartments$/);
  await page.context().storageState({ path: authFile });
});
