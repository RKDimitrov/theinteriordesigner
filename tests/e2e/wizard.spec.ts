import { expect, type Page, test } from "@playwright/test";
import { createApartment, deleteApartment, UUID, waitForSave, wallPoint } from "./helpers";

async function newRoom(page: Page, name: string, w: string, l: string) {
  await page.getByRole("link", { name: "Add room" }).click();
  await page.getByLabel("Room name").fill(name);
  await page.getByLabel("Width", { exact: true }).fill(w);
  await page.getByLabel("Length", { exact: true }).fill(l);
}

test("create apartment, add a room by size, add a door and a window in the planner, reload keeps data", async ({ page }) => {
  const name = `E2E flat ${Date.now()}`;
  const aptUrl = await createApartment(page, name);

  await newRoom(page, "Living", "420", "380");
  await expect(page.getByTestId("room-area")).toHaveText("15.96 m²");
  await page.getByRole("button", { name: /Save & open planner/ }).click();
  await expect(page).toHaveURL(new RegExp(`/apartments/${UUID}/planner\\?room=all$`));

  await page.getByTestId("planner-tool-door").click();
  const bottom = await wallPoint(page, "bottom");
  await page.mouse.click(bottom.x, bottom.y);
  await page.getByTestId("planner-tool-window").click();
  const top = await wallPoint(page, "top");
  await page.mouse.click(top.x, top.y);
  await page.getByTestId("planner-tool-select").click();
  await expect(page.getByTestId("opening-door-1")).toBeAttached();
  await expect(page.getByTestId("opening-window-1")).toBeAttached();
  await waitForSave(page);

  await page.reload();
  await expect(page.getByTestId("opening-door-1")).toBeAttached();
  await expect(page.getByTestId("opening-window-1")).toBeAttached();

  await page.goto(aptUrl);
  await expect(page.getByTestId("room-card")).toHaveCount(1);
  await expect(page.getByTestId("room-card")).toContainText("1 door, 1 window");

  await deleteApartment(page, aptUrl);
});

test("overlapping openings are flagged in the planner checks", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E overlap ${Date.now()}`);
  await newRoom(page, "Office", "300", "300");
  await page.getByRole("button", { name: /Save & open planner/ }).click();

  // Both land centred on the bottom wall.
  const bottom = await wallPoint(page, "bottom");
  await page.getByTestId("planner-tool-door").click();
  await page.mouse.click(bottom.x, bottom.y);
  await page.getByTestId("planner-tool-window").click();
  await page.mouse.click(bottom.x, bottom.y);

  await page.getByTestId("planner-tab-designer").click();
  await expect(page.getByTestId("room-issues")).toContainText("overlaps");
  await deleteApartment(page, aptUrl);
});

test("a room that is too small cannot be saved", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E small ${Date.now()}`);
  await newRoom(page, "Cupboard", "60", "60");
  await expect(page.getByTestId("room-issues")).toContainText("at least 1 m²");
  await expect(page.getByRole("button", { name: /Save & open planner/ })).toBeDisabled();
  await deleteApartment(page, aptUrl);
});

test("draw a second room in the planner by dragging", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mouse drag test runs on desktop only");
  const aptUrl = await createApartment(page, `E2E draw ${Date.now()}`);
  await newRoom(page, "Hall", "300", "200");
  await page.getByRole("button", { name: /Save & open planner/ }).click();

  await page.getByTestId("planner-tool-room").click();
  const box = await page.getByTestId("plan-canvas").boundingBox();
  if (!box) throw new Error("canvas not visible");
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.45, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByRole("radio", { name: "Room 2" })).toBeVisible();
  await page.goto(aptUrl);
  await expect(page.getByTestId("room-card")).toHaveCount(2);
  await deleteApartment(page, aptUrl);
});
