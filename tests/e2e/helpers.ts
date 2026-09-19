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

/** Adds the first sample room (living room) through the room editor's dev button. */
export async function addSampleRoom(page: Page, aptUrl: string) {
  await page.goto(aptUrl);
  await page.getByRole("link", { name: "Add room" }).click();
  await page.getByRole("button", { name: "Fill sample data" }).click();
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${UUID}$`));
}
