import { expect, test } from "@playwright/test";
import { addSampleRoom, createApartment, deleteApartment } from "./helpers";

// Real generation costs money, so it only runs with E2E_RUN_LLM=1.
// The dev "Insert sample design" button exercises validator + UI for free.
test("sample design renders, validates and highlights items", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E design ${Date.now()}`);
  await addSampleRoom(page, aptUrl);

  await page.goto(aptUrl);
  await page.getByTestId("step-4").click();
  await expect(page.getByRole("heading", { name: /Design: Living room/ })).toBeVisible();
  await expect(page.getByText("No design yet for this room.")).toBeVisible();

  await page.getByRole("button", { name: "Insert sample design" }).click();
  await expect(page.getByTestId("design-status")).toContainText("Valid");
  await expect(page.getByTestId("design-issues")).toContainText("No problems found.");
  await expect(page.getByTestId("plan-item-sofa")).toBeVisible();
  await expect(page.getByTestId("item-sideboard")).toContainText("existing");

  await page.getByTestId("item-sofa").click();
  await expect(page.getByTestId("item-sofa")).toHaveClass(/ring-2/);

  // Second preset is deliberately broken: the validator must reject it.
  await page.getByRole("button", { name: "Insert sample design" }).click();
  await expect(page.getByTestId("design-status")).toContainText("Not valid");
  await expect(page.getByTestId("design-issues")).toContainText("overlaps");
  await expect(page.getByText("Version 2")).toBeVisible();

  await page.goto(aptUrl);
  await expect(page.getByTestId("step-4")).toContainText("Not done");

  await deleteApartment(page, aptUrl);
});

// The solver runs without the API, so re-solving a design is free to test.
test("re-solves the layout of an existing design", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E re-solve ${Date.now()}`);
  await addSampleRoom(page, aptUrl);

  await page.goto(aptUrl);
  await page.getByTestId("step-4").click();
  await page.getByRole("button", { name: "Insert sample design" }).click();
  await expect(page.getByTestId("design-status")).toContainText("Valid");

  await page.getByTestId("resolve-layout").click();
  await expect(page.getByText("Version 2")).toBeVisible();
  await expect(page.getByTestId("design-status")).toBeVisible();
  await expect(page.getByTestId("plan-item-sofa")).toBeVisible();
  await expect(page.getByTestId("item-sideboard")).toContainText("existing");

  await deleteApartment(page, aptUrl);
});

test("generates a real design with Claude", async ({ page }) => {
  test.skip(process.env["E2E_RUN_LLM"] !== "1", "Set E2E_RUN_LLM=1 to spend API credit");
  test.setTimeout(10 * 60 * 1000);
  const aptUrl = await createApartment(page, `E2E llm design ${Date.now()}`);
  await addSampleRoom(page, aptUrl);
  await page.goto(`${aptUrl}/design`);
  await page.getByTestId("generate-design").click();
  await expect(page.getByTestId("generate-progress")).toBeVisible();
  await expect(page.getByTestId("design-status")).toBeVisible({ timeout: 9 * 60 * 1000 });
  await deleteApartment(page, aptUrl);
});
