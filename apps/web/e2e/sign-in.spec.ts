import { expect, test } from "@playwright/test";

/**
 * Smoke tests that need only the web app: CI starts no API or database. `/`
 * routes on the token in localStorage, so neither path calls the API.
 */
test.describe("sign-in", () => {
  test("`/` signed out ends on the sign-in page", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("the sign-in page shows its email and password fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });

  test("`/` signed in ends on the app", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("frame_token", "smoke-test"));
    await page.goto("/");

    await expect(page).toHaveURL(/\/app$/);
  });
});
