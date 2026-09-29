import { expect, test } from "@playwright/test";
import { addSampleRoom, createApartment, deleteApartment } from "./helpers";

test("floor and accent-wall materials are saved to the room", async ({ page, isMobile }) => {
  test.skip(isMobile, "3D finishes are checked on desktop");
  test.setTimeout(120_000);
  const aptUrl = await createApartment(page, `E2E finishes ${Date.now()}`);
  try {
    await addSampleRoom(page, aptUrl);
    await page.getByTestId("planner-mode-3d").click();
    await page.getByRole("tab", { name: "Finishes" }).click();

    await page.getByTestId("finish-floor").getByRole("radio", { name: "Herringbone oak" }).click();
    const walls = page.getByTestId("finish-walls");
    await walls.getByRole("radio", { name: "Wall 1" }).click();
    await walls.getByRole("radio", { name: "Red brick" }).click();
    await expect(walls.getByRole("radio", { name: "Red brick" })).toHaveAttribute("aria-checked", "true");
    await page.waitForTimeout(1500);

    await page.reload();
    await page.getByTestId("planner-mode-3d").click();
    await page.getByRole("tab", { name: "Finishes" }).click();
    await expect(page.getByTestId("finish-floor").getByRole("radio", { name: "Herringbone oak" })).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("finish-walls").getByRole("radio", { name: "Wall 1" }).click();
    await expect(page.getByTestId("finish-walls").getByRole("radio", { name: "Red brick" })).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("finish-walls").getByRole("radio", { name: "Wall 2" }).click();
    await expect(page.getByTestId("finish-walls").getByRole("radio", { name: "Limewash", exact: true })).toHaveAttribute("aria-checked", "true");
  } finally {
    await deleteApartment(page, aptUrl);
  }
});
