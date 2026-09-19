import { expect, test } from "@playwright/test";
import { addSampleRoom, createApartment, deleteApartment } from "./helpers";

// Uses the real Open-Meteo APIs (free). Trend research is NOT clicked: it costs money.
test("context page shows location, climate, daylight and German renter rules", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E context ${Date.now()}`);
  await addSampleRoom(page, aptUrl);

  await page.goto(aptUrl);
  await expect(page.getByTestId("step-3")).toContainText("Not done");
  await page.getByTestId("step-3").click();
  await expect(page.getByRole("heading", { name: "Context", exact: true })).toBeVisible();

  await expect(page.getByTestId("location-label")).toContainText("Berlin");
  await expect(page.getByTestId("climate-card")).toContainText("Heating demand");
  await expect(page.getByTestId("daylight-Living room")).toBeVisible();
  await expect(page.getByTestId("renter-card")).toContainText("tiles");

  // No style profile yet: trends need the quiz first.
  await expect(page.getByTestId("trends-card")).toContainText("Finish the style quiz first");
  await expect(page.getByRole("button", { name: "Research trends" })).toBeDisabled();

  await deleteApartment(page, aptUrl);
});
