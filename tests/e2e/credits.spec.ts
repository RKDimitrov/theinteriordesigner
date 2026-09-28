import { expect, test } from "@playwright/test";

test.describe("asset credits", () => {
  // Public page: CC-BY credits must be reachable without an account.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("lists attributed and public-domain assets and is linked from login", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByRole("link", { name: "3D asset credits" }).click();
    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.getByTestId("credits-attribution")).toContainText("Sheen Wood Leather Sofa");
    await expect(page.getByTestId("credits-attribution")).toContainText("CC BY 4.0");
    await expect(page.getByTestId("credits-public-domain")).toContainText("Poly Haven");
  });
});
