import { expect, test } from "@playwright/test";
import { addSampleRoom, createApartment, deleteApartment, waitForSave, wallPoint } from "./helpers";

test("place a WC with the fixture tool; it is saved and can be selected", async ({ page, isMobile }) => {
  test.skip(isMobile, "The planner tools are checked on desktop");
  const aptUrl = await createApartment(page, `E2E fixture ${Date.now()}`);
  try {
    await addSampleRoom(page, aptUrl);
    await page.getByTestId("planner-tool-fixture").click();
    await page.getByTestId("fixture-picker").getByRole("radio", { name: "WC", exact: true }).click();
    const p = await wallPoint(page, "right");
    await page.mouse.click(p.x, p.y);
    await expect(page.getByTestId("planner-selection")).toContainText("WC");
    await expect(page.getByTestId("planner-selection")).toContainText("70 cm kept free in front");
    await waitForSave(page);

    await page.reload();
    await page.getByTestId("planner-tool-select").click();
    await page.getByTestId("fixed-wc-1").click();
    await expect(page.getByTestId("planner-selection")).toContainText("WC");
  } finally {
    await deleteApartment(page, aptUrl);
  }
});
