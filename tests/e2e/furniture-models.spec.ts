import { expect, test } from "@playwright/test";
import { addSampleRoom, createApartment, deleteApartment, waitForSave } from "./helpers";

test("a piece's 3D model and colour are picked in the inspector and saved", async ({ page, isMobile }) => {
  test.skip(isMobile, "The catalogue drawer is checked on desktop");
  test.setTimeout(120_000);
  const aptUrl = await createApartment(page, `E2E models ${Date.now()}`);
  try {
    await addSampleRoom(page, aptUrl);
    const drawer = page.getByRole("complementary", { name: "Catalogue" });
    if (!(await drawer.isVisible())) await page.getByTestId("planner-catalogue").click();
    await page.getByTestId("catalogue-piece-sofa-medium").click();
    const floor = (await page.locator('[data-testid^="room-floor-"]').first().boundingBox())!;
    await page.mouse.click(floor.x + floor.width * 0.5, floor.y + floor.height * 0.75);

    const models = page.getByTestId("piece-models");
    await expect(models.locator('[data-model=""]')).toHaveAttribute("aria-checked", "true");
    await models.locator('[data-model="glam_velvet_sofa"]').click();
    await page.getByTestId("sel-colour").fill("#c9a27a");
    await waitForSave(page);

    await page.reload();
    await page.getByTestId("plan-item-sofa-1").click();
    await expect(page.getByTestId("piece-models").locator('[data-model="glam_velvet_sofa"]')).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("sel-colour")).toHaveValue("#c9a27a");
  } finally {
    await deleteApartment(page, aptUrl);
  }
});
