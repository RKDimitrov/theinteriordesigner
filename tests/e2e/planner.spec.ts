import { expect, test } from "@playwright/test";
import { addSampleRoom, createApartment, deleteApartment, waitForSave } from "./helpers";

test("place a piece from the catalogue, move it, and it is saved as a design version", async ({ page, isMobile }) => {
  test.skip(isMobile, "The catalogue drawer is checked on desktop");
  const aptUrl = await createApartment(page, `E2E planner ${Date.now()}`);
  await addSampleRoom(page, aptUrl);

  // Room cards open the planner scoped to that room.
  await page.goto(aptUrl);
  await page.getByRole("link", { name: /^Edit plan: / }).first().click();
  await expect(page).toHaveURL(/\/planner\?room=[0-9a-f-]{36}$/);

  const drawer = page.getByRole("complementary", { name: "Catalogue" });
  if (!(await drawer.isVisible())) await page.getByTestId("planner-catalogue").click();
  await page.getByTestId("catalogue-piece-armchair-medium").click();
  const floor = await page.locator('[data-testid^="room-floor-"]').first().boundingBox();
  if (!floor) throw new Error("floor not visible");
  await page.mouse.click(floor.x + floor.width * 0.5, floor.y + floor.height * 0.3);

  const piece = page.getByTestId("plan-item-armchair-1");
  await expect(piece).toBeVisible();
  await expect(page.getByTestId("planner-selection")).toContainText("Armchair");

  // Drag it a little; the whole drag is one undo step.
  const b = (await piece.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  await waitForSave(page);

  await page.reload();
  await expect(page.getByTestId("plan-item-armchair-1")).toBeVisible();

  // The design page shows the planner's version, checked by the validator.
  await page.goto(aptUrl);
  await page.getByTestId("step-4").click();
  await expect(page.getByTestId("design-status")).toBeVisible();
  await expect(page.getByTestId("item-armchair-1")).toBeVisible();

  await deleteApartment(page, aptUrl);
});

test("3D view opens with the camera panel, and 3 switches back to 2D", async ({ page, isMobile }) => {
  test.skip(isMobile, "3D is checked on desktop");
  const aptUrl = await createApartment(page, `E2E 3d ${Date.now()}`);
  await addSampleRoom(page, aptUrl);
  await page.getByTestId("planner-mode-3d").click();
  await expect(page.getByTestId("planner-scene-3d")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Camera" })).toBeVisible();
  await page.keyboard.press("3");
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await deleteApartment(page, aptUrl);
});
