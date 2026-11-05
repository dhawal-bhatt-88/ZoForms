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
    await expect(page).toHaveTitle("ZoForms: clinical forms that run in your app");
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

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "ZoForms: clinical forms that run in your app");
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /behavioral health teams/);
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toMatch(/\/opengraph-image/);
    const res = await page.request.get(new URL(image!).pathname + new URL(image!).search);
    expect(res.headers()["content-type"]).toBe("image/png");
  });

  test("the sections, in order", async ({ page }) => {
    await page.goto("/");

    // Each section's own heading; the live examples' forms have headings of their own, in shadow roots.
    const headings = await page.evaluate(() =>
      [...document.querySelectorAll("main section[aria-labelledby]")]
        .map((s) => document.getElementById(s.getAttribute("aria-labelledby")!)!)
        .filter((h) => h.tagName === "H2")
        .map((h) => h.textContent),
    );
    expect(headings).toEqual([
      "Why ZoForms",
      "How it works",
      "See it working",
      "Built for clinical forms",
      "Your data stays with you",
      "Accessible forms",
      "Questions",
      "Build your first form",
    ]);
    // The final call to action repeats the hero's two buttons.
    const cta = page.getByRole("region", { name: "Build your first form" });
    await expect(cta.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    await expect(cta.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  test("Why ZoForms: four cards, in order, each linking to its docs page", async ({ page }) => {
    await page.goto("/");
    const why = page.getByRole("region", { name: "Why ZoForms" });
    expect(await why.getByRole("heading", { level: 3 }).allInnerTexts()).toEqual([
      "Clinical scoring built in",
      "Logic for real clinical forms",
      "Answers never touch our servers",
      "Developer-friendly package",
    ]);
    for (const [name, href] of [
      ["Read scores", "/docs/integrate/scores"],
      ["Show a question only when it applies", "/docs/build/show-questions-conditionally"],
      ["Where respondents’ data goes", "/docs/compliance/data-flow"],
      ["Quickstart", "/docs/integrate/quickstart"],
    ]) {
      await expect(why.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  test.describe("See it working", () => {
    const shimmed = (page: import("@playwright/test").Page) => page.evaluate(() => "__zoworkDocsExampleFetch" in window.fetch);

    test("three live examples, each with Preview and Server output only", async ({ page }) => {
      await page.goto("/");
      const section = page.getByRole("region", { name: "See it working" });
      for (const title of ["Scored check-in", "Follow-up question", "Repeating group"]) {
        const tabs = section.getByRole("tablist", { name: `Example: ${title}` });
        // Loaded after the page paints; a fresh dev server compiles the renderer's chunk first.
        await expect(tabs).toBeVisible({ timeout: 20_000 });
        expect(await tabs.getByRole("tab").allInnerTexts()).toEqual(["Preview", "Server output"]);
      }
      await expect(section.locator(".zf-form")).toHaveCount(3);
      await expect(section.getByText("An example of scoring, not a clinical tool.")).toBeVisible();
    });

    test("the check-in shows its total after submit, and Server output comes from prepareSubmission; nothing is sent", async ({ page }) => {
      const posts: string[] = [];
      page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
      await page.goto("/");
      const form = page.locator("[data-docs-example=check-in]");
      await expect(form.locator(".zf-form")).toBeVisible({ timeout: 20_000 });
      for (const [question, answer] of [
        ["Skip a meal?", "A few days"],
        ["Go to bed later than you planned?", "Most days"],
        ["Feel rushed during the day?", "Nearly every day"],
        ["Put off a task you meant to do?", "Not at all"],
        ["Have less time with friends or family than you wanted?", "A few days"],
      ]) {
        await form.getByRole("group", { name: question }).getByRole("radio", { name: answer }).check();
      }
      await form.getByRole("button", { name: "Submit" }).click();
      await expect(form.getByText("Form submitted successfully.")).toBeVisible();
      await expect(form.locator(".zf-scores")).toHaveText("Check-in total: 7");

      await page.getByRole("tablist", { name: "Example: Scored check-in" }).getByRole("tab", { name: "Server output" }).click();
      const server = JSON.parse((await page.getByRole("region", { name: "prepareSubmission(schema, body)" }).first().textContent()) ?? "");
      expect(server.ok).toBe(true);
      expect(server.answers.felt_rushed).toEqual({ state: "answered", value: { code: "nearly_every_day", label: "Nearly every day" } });
      await expect(page.getByText("Computed in your browser by prepareSubmission").first()).toBeVisible();
      expect(posts).toEqual([]);
    });

    test("the repeating group adds and removes entries", async ({ page }) => {
      await page.goto("/");
      const form = page.locator("[data-docs-example=medications]");
      await expect(form.locator(".zf-form")).toBeVisible({ timeout: 20_000 });
      await expect(form.getByRole("textbox", { name: "Medication name" })).toHaveCount(1);
      await form.getByRole("button", { name: "Add another medication" }).click();
      await expect(form.getByRole("textbox", { name: "Medication name" })).toHaveCount(2);
      await form.getByRole("button", { name: "Remove medication 2" }).click();
      await expect(form.getByRole("textbox", { name: "Medication name" })).toHaveCount(1);
    });

    test("the examples load only on the home page, not on the signed-in pages", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".zf-form")).toHaveCount(3, { timeout: 20_000 });
      expect(await shimmed(page)).toBe(true);

      await page.addInitScript(() => localStorage.setItem("frame_token", "e2e-token"));
      // A running API would refuse the stand-in token; without one the app still renders.
      await page.route("**/v1/**", (route) => route.abort());
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/app");
      await expect(page.getByRole("navigation", { name: "App" })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("[data-docs-example]")).toHaveCount(0);
      expect(await shimmed(page)).toBe(false);
    });
  });

  test("the hero's example: an excerpt, the whole file and the form rendered", async ({ page }) => {
    await page.goto("/");
    const figure = page.getByRole("figure");

    await expect(figure.getByText('"label": "Little interest or pleasure in doing things"')).toBeVisible();
    await expect(figure.getByRole("img", { name: /Little interest or pleasure in doing things/ })).toBeVisible();

    const href = await figure.getByRole("link", { name: "Download the whole file" }).getAttribute("href");
    const file = await (await page.request.get(href!)).json();
    expect(file.title).toBe("PHQ-2");
    expect(file.blocks[0].blocks.map((b: { label: string }) => b.label)).toEqual([
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
    ]);
  });

  test("a question in the FAQ opens to its answer", async ({ page }) => {
    await page.goto("/");
    const answer = page.getByText("Wherever your app sends them. ZoForms never sees them.");

    await expect(answer).toBeHidden();
    await page.getByText("Where are the answers stored?").click();
    await expect(answer).toBeVisible();
  });

  test("the footer links what exists and marks the rest as soon", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("navigation", { name: "Footer" });

    await expect(footer.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    await expect(footer.getByRole("link", { name: "ZoBlocks" })).toHaveAttribute("href", "https://zoblocks.design");
    for (const name of ["Release notes", "Privacy", "Terms"]) {
      await expect(footer.getByRole("link", { name })).toHaveCount(0);
      await expect(footer.getByText(`${name} (soon)`)).toBeVisible();
    }
    // Plain text until its address is settled, and not "soon": it exists.
    await expect(footer.getByRole("link", { name: "Zowork" })).toHaveCount(0);
    await expect(footer.getByText("Zowork", { exact: true })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("© 2026 Zowork");
  });

  test("Get started opens sign-up", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Get started" }).click();

    // The dev server may be compiling /signup for the first time, under load
    // from the other workers: longer than the default 5s.
    await expect(page).toHaveURL(/\/signup$/, { timeout: 20_000 });
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
    await page.getByRole("link", { name: "ZoForms home" }).click();

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
        // One screenshot of the rendered form, in this theme.
        const rendered = page.getByRole("img", { name: /Little interest or pleasure/ });
        await expect(rendered).toHaveCount(1);
        await expect(rendered).toHaveAttribute("src", new RegExp(`phq-2-rendered-${theme}`));
        // The live examples, which axe scans inside their shadow roots.
        await expect(page.locator(".zf-form")).toHaveCount(3, { timeout: 20_000 });
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
