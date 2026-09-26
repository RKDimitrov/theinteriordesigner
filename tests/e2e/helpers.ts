import { expect, type Page } from "@playwright/test";

export const UUID = "[0-9a-f-]{36}";

export async function createApartment(page: Page, name: string): Promise<string> {
  await page.goto("/apartments/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Street address").fill("Teststraße 1");
  await page.getByLabel("City").fill("Berlin");
  await page.getByLabel("Country code").fill("de");
  await page.getByLabel("Total area (m²)").fill("65");
  await page.getByRole("button", { name: "Create apartment" }).click();
  await expect(page).toHaveURL(new RegExp(`/apartments/${UUID}$`));
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

export async function deleteApartment(page: Page, url: string) {
  await page.goto(url);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/apartments$/);
}

/** Adds the first sample room (living room, with doors and windows) through the new-room form's dev button. */
export async function addSampleRoom(page: Page, aptUrl: string) {
  await page.goto(aptUrl);
  await page.getByRole("link", { name: "Add room" }).click();
  await page.getByRole("button", { name: "Fill sample data" }).click();
  await page.getByRole("button", { name: /Save & open planner/ }).click();
  await expect(page).toHaveURL(new RegExp(`/apartments/${UUID}/planner\\?room=all$`));
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
}

/** Screen point just inside one wall of the first room, for the planner's wall tools. */
export async function wallPoint(page: Page, side: "top" | "bottom" | "left" | "right") {
  const box = await page.locator('[data-testid^="room-floor-"]').first().boundingBox();
  if (!box) throw new Error("room floor not visible");
  const inset = 3;
  switch (side) {
    case "top":
      return { x: box.x + box.width / 2, y: box.y + inset };
    case "bottom":
      return { x: box.x + box.width / 2, y: box.y + box.height - inset };
    case "left":
      return { x: box.x + inset, y: box.y + box.height / 2 };
    case "right":
      return { x: box.x + box.width - inset, y: box.y + box.height / 2 };
  }
}

/** Wait for the planner's autosave (debounced ~1 s) to finish. */
export async function waitForSave(page: Page) {
  await page.waitForTimeout(1500);
  await expect(page.getByText(/^saving…$/)).toHaveCount(0, { timeout: 10_000 });
}
