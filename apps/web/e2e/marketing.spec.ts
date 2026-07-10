import { expect, test } from "@playwright/test";

test.describe("marketing homepage", () => {
  test("renders the hero and primary CTA", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Forms that feel like",
    );
    await expect(
      page.getByRole("link", { name: /start for free/i }).first(),
    ).toBeVisible();
  });

  test("navigates to the login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /log in/i }).first().click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});
