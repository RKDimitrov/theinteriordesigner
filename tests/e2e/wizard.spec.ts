import { expect, test } from "@playwright/test";
import { createApartment, deleteApartment, UUID } from "./helpers";

test("create apartment, add room by dimensions with a door and a window, reload keeps data", async ({ page }) => {
  const name = `E2E flat ${Date.now()}`;
  const aptUrl = await createApartment(page, name);

  await page.getByRole("link", { name: "Add room" }).click();
  await page.getByLabel("Room name").fill("Living");
  await page.getByLabel("Width", { exact: true }).fill("420");
  await page.getByLabel("Length", { exact: true }).fill("380");
  await expect(page.getByTestId("room-area")).toHaveText("15.96 m²");

  await page.getByRole("button", { name: "Add Door" }).click();
  const door = page.getByTestId("opening-door-1");
  await expect(door).toBeVisible();
  await door.getByLabel("Wall").selectOption("2");
  await door.getByLabel("Opens").selectOption("in");

  await page.getByRole("button", { name: "Add Window" }).click();
  const win = page.getByTestId("opening-window-1");
  await expect(win).toBeVisible();
  await win.getByLabel("Sill height").fill("85");

  await expect(page.getByTestId("room-issues")).toHaveCount(0);
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${UUID}$`));

  await page.reload();
  await expect(page.getByLabel("Room name")).toHaveValue("Living");
  await expect(page.getByLabel("Width", { exact: true }).first()).toHaveValue("420");
  await expect(page.getByTestId("opening-door-1").getByLabel("Wall")).toHaveValue("2");
  await expect(page.getByTestId("opening-window-1").getByLabel("Sill height")).toHaveValue("85");

  await page.goto(aptUrl);
  await expect(page.getByTestId("room-card")).toHaveCount(1);
  await expect(page.getByTestId("room-card")).toContainText("1 door, 1 window");

  await deleteApartment(page, aptUrl);
});

test("overlapping openings block saving", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E overlap ${Date.now()}`);
  await page.getByRole("link", { name: "Add room" }).click();
  await page.getByLabel("Room name").fill("Office");
  await page.getByLabel("Width", { exact: true }).fill("300");
  await page.getByLabel("Length", { exact: true }).fill("300");
  // Both land centred on wall 1.
  await page.getByRole("button", { name: "Add Door" }).click();
  await page.getByRole("button", { name: "Add Window" }).click();
  await expect(page.getByTestId("room-issues")).toContainText("overlaps");
  await expect(page.getByRole("button", { name: "Save room" })).toBeDisabled();
  await deleteApartment(page, aptUrl);
});

test("draw a room by dragging on the canvas", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mouse drag test runs on desktop only");
  const aptUrl = await createApartment(page, `E2E draw ${Date.now()}`);
  await page.getByRole("link", { name: "Add room" }).click();
  await expect(page.getByTestId("room-area")).toHaveText("—");

  const box = await page.getByTestId("plan-canvas").boundingBox();
  if (!box) throw new Error("canvas not visible");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByTestId("room-area")).not.toHaveText("—");
  const width = Number(await page.getByLabel("Width", { exact: true }).inputValue());
  expect(width % 5).toBe(0);
  expect(width).toBeGreaterThanOrEqual(50);
  await deleteApartment(page, aptUrl);
});
