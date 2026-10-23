import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The public home page at `/`. It needs no API: signed-in visitors are told
 * apart by the token in localStorage, which these tests set directly.
 */
test.describe("home page", () => {
  test("`/` signed out shows the home page and its header", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle("Zowork Forms: clinical forms that run in your app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clinical forms, built here, running in your app");

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await expect(nav.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("radiogroup", { name: "Color theme" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  });

  test("`/` carries its Open Graph data", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Zowork Forms: clinical forms that run in your app");
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /behavioral health teams/);
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toMatch(/\/opengraph-image/);
    const res = await page.request.get(new URL(image!).pathname + new URL(image!).search);
    expect(res.headers()["content-type"]).toBe("image/png");
  });

  test("Get started opens sign-up", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Get started" }).click();

    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });

  test("`/` signed in ends on the app, before any bundle runs", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("frame_token", "smoke-test"));
    // With the bundles blocked only the inline pre-paint script can redirect,
    // so the home page is never drawn first.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/");

    await expect(page).toHaveURL(/\/app$/);
  });

  test("a signed-in visitor following a link to `/` ends on the app", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("frame_token", "smoke-test"));
    await page.goto("/login");
    // The logo is a client-side link: the pre-paint script doesn't run again.
    await page.getByRole("link", { name: "Zowork Forms home" }).click();

    await expect(page).toHaveURL(/\/app$/);
  });

  test.describe("at phone width", () => {
    test.use({ viewport: { width: 375, height: 740 } });

    test("the header's links are behind Menu, and Escape closes it", async ({ page }) => {
      await page.goto("/");
      const menu = page.getByRole("button", { name: "Menu" });
      const nav = page.getByRole("navigation", { name: "Main" });

      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(nav).toBeHidden();

      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await expect(nav.getByRole("link", { name: "Docs" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Sign in" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Get started" })).toBeVisible();
      await expect(page.getByRole("radiogroup", { name: "Color theme" })).toBeVisible();

      await nav.getByRole("link", { name: "Docs" }).focus();
      await page.keyboard.press("Escape");
      await expect(nav).toBeHidden();
      await expect(menu).toBeFocused();
    });

    test("nothing scrolls sideways, menu open or closed", async ({ page }) => {
      await page.goto("/");
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await overflow()).toBe(0);
      await page.getByRole("button", { name: "Menu" }).click();
      expect(await overflow()).toBe(0);
    });
  });
});

/**
 * WCAG 2.2 A and AA, by axe, as in sign-in.spec.ts: the theme set by its
 * cookie before first paint. At phone width with the menu open as well, since
 * that panel is only drawn there.
 */
test.describe("home page accessibility", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [1280, 375]) {
      test(`the home page has no WCAG 2.2 A or AA violations in ${theme} at ${width}px`, async ({ page, context, baseURL }) => {
        await page.setViewportSize({ width, height: 800 });
        await context.addCookies([{ name: "zoblocks-theme", value: theme, url: baseURL! }]);
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("html")).toHaveClass(theme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
        if (width === 375) await page.getByRole("button", { name: "Menu" }).click();
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
  }
});
