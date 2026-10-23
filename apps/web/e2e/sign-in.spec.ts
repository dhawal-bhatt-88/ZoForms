import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Smoke tests that need only the web app: CI starts no API or database. `/`,
 * the home page, has its own spec: home.spec.ts.
 */
test.describe("sign-in", () => {
  test("the sign-in page shows its email and password fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });

  test("the other auth forms that need no API name their fields too", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");

    await page.goto("/forgot-password");
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");

    await page.goto("/reset-password/smoke-test");
    await expect(page.getByLabel("New password")).toHaveAttribute("type", "password");
  });
});

/**
 * WCAG 2.2 A and AA, by axe, on the one page CI can reach without an API. The
 * full sweep, every screen and state signed in, is e2e/verify-a11y.js.
 *
 * The theme is set by its cookie before the first paint, as the boot script
 * reads it: switching after load would leave fades mid-transition and give
 * contrast readings a reader never sees.
 */
test.describe("sign-in accessibility", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`the sign-in page has no WCAG 2.2 A or AA violations in ${theme}`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "zoblocks-theme", value: theme, url: baseURL! }]);
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      // Fades and rises finished; a looping animation never finishes, so it isn't waited for.
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished),
        ),
      );

      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const found = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`);
      expect(found, `\n${found.join("\n")}\n`).toEqual([]);
    });
  }
});
