import { expect, test } from "@playwright/test";
import { addSampleRoom, createApartment, deleteApartment } from "./helpers";

test("fill sample profile, save, reload keeps data, overview shows done", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E profile ${Date.now()}`);
  await addSampleRoom(page, aptUrl);

  await page.goto(aptUrl);
  await expect(page.getByTestId("step-2")).toContainText("Not done");
  await page.getByTestId("step-2").click();
  await expect(page.getByRole("heading", { name: "Style profile" })).toBeVisible();

  await page.getByRole("button", { name: "Fill sample data" }).click();
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await expect(page.getByTestId("profile-summary")).toContainText("Quiz 10/10");
  await expect(page.getByTestId("profile-summary")).toContainText("all rooms have a budget");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Adults")).toHaveValue("2");
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await expect(page.getByTestId("chip-liked-a3b09a")).toBeVisible();
  await expect(page.getByTestId("budget-total")).toContainText("€4,500");

  await page.goto(aptUrl);
  await expect(page.getByTestId("step-2")).toContainText("Done");
  await deleteApartment(page, aptUrl);
});

test("answer the quiz by tapping cards", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E quiz ${Date.now()}`);
  await page.goto(`${aptUrl}/profile`);
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId("quiz-progress")).toHaveText(`${i} / 10`);
    await page.locator('[data-testid^="quiz-option-"]').first().click();
  }
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await page.getByRole("button", { name: "Redo quiz" }).click();
  await expect(page.getByTestId("quiz-progress")).toHaveText("1 / 10");
  await deleteApartment(page, aptUrl);
});

test("a colour moves between liked and disliked", async ({ page }) => {
  const aptUrl = await createApartment(page, `E2E colours ${Date.now()}`);
  await page.goto(`${aptUrl}/profile`);
  await page.getByRole("button", { name: "Colours you like: Sage" }).click();
  await expect(page.getByTestId("chip-liked-a3b09a")).toBeVisible();
  await page.getByRole("button", { name: "Colours you want to avoid: Sage" }).click();
  await expect(page.getByTestId("chip-disliked-a3b09a")).toBeVisible();
  await expect(page.getByTestId("chip-liked-a3b09a")).toHaveCount(0);
  await deleteApartment(page, aptUrl);
});
