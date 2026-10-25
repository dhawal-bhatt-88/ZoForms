// The public docs (docs/briefs/BUILDER-BRIEF-DOCS.md, CP3): each page at 375
// and 1440 wide, in light and dark, screenshotted to output/docs/ with nothing
// scrolling sideways; and the keyboard: the skip link first, landing on the
// page, and the live examples' tabs moving with the arrow keys, Home and End.
// Needs the web app only. axe and the page structure are in verify-a11y.js;
// the shadow-root checks are in apps/web/e2e/docs.spec.ts.
const path = require("path");
const fs = require("fs");
const { WEB, OUT, launchBrowser } = require("./_setup");

const DIR = path.join(OUT, "docs");
fs.mkdirSync(DIR, { recursive: true });

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = [
  ["docs-home", "/docs"],
  ["dropdown", "/docs/build/question-types/dropdown"],
  ...["short-answer", "long-answer", "multiple-choice", "checkboxes", "number", "email", "phone-number", "link", "date", "time", "respondents-country"].map((n) => [n, `/docs/build/question-types/${n}`]),
  ["show-questions-conditionally", "/docs/build/show-questions-conditionally"],
  ["form-renderer", "/docs/integrate/reference/form-renderer"],
  ["follow-up-question", "/docs/examples/follow-up-question"],
];
const urlOf = (name) => PAGES.find(([n]) => n === name)[1];
const WIDTHS = [375, 1440];
const THEMES = ["light", "dark"];

(async () => {
  let browser;
  try {
    for (let i = 0; i < 120; i++) {
      try { if ((await fetch(WEB + "/docs")).status < 500) break; } catch {}
      await sleep(1000);
    }
    browser = await launchBrowser();
    const open = async (theme, width) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      await ctx.addCookies([{ name: "zoblocks-theme", value: theme, url: WEB }]);
      // The dev-only Next.js indicator isn't part of the page.
      await ctx.addInitScript(() => {
        const st = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(s); };
        if (document.documentElement) st(); else document.addEventListener("DOMContentLoaded", st);
      });
      const P = await ctx.newPage();
      P.on("pageerror", (e) => check(`no page errors (${theme}, ${width}px)`, false, e.message));
      return { ctx, P };
    };
    const load = async (P, url) => {
      await P.goto(WEB + url);
      await P.locator("h1").first().waitFor({ timeout: 60000 });
      if (await P.locator("[data-docs-example]").count()) await P.locator(".zf-form").first().waitFor({ timeout: 30000 });
      await P.waitForTimeout(300);
    };

    // ---------- screenshots, and nothing scrolling sideways ----------
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const { ctx, P } = await open(theme, width);
        for (const [name, url] of PAGES) {
          await load(P, url);
          const wide = await P.evaluate(() => document.documentElement.scrollWidth);
          check(`${name} at ${width}px (${theme}): nothing scrolls sideways`, wide <= width, `${wide}px wide`);
          const file = `${name}-${width}-${theme}.png`;
          await P.screenshot({ path: path.join(DIR, file), fullPage: true });
          check(`${name} at ${width}px (${theme}): screenshot`, fs.statSync(path.join(DIR, file)).size > 0, file);
        }
        await ctx.close();
      }
    }

    // ---------- keyboard ----------
    {
      const { ctx, P } = await open("light", 1440);
      for (const [name, url] of PAGES) {
        await load(P, url);
        await P.keyboard.press("Tab");
        const first = await P.evaluate(() => document.activeElement?.textContent?.trim());
        check(`${name}: the first Tab stop is the skip link`, first === "Skip to main content", first);
        await P.keyboard.press("Enter");
        const onMain = await P.evaluate(() => document.activeElement?.id);
        check(`${name}: the skip link moves focus to the page`, onMain === "main", onMain);
      }

      for (const [name, url, tabs] of [
        ["dropdown", urlOf("dropdown"), ["Preview", "Schema", "Payload", "Server output"]],
        ["follow-up-question", urlOf("follow-up-question"), ["Preview", "Schema", "React code", "Payload", "Server output"]],
      ]) {
        await load(P, url);
        const tablist = P.getByRole("tablist");
        const names = await tablist.getByRole("tab").allTextContents();
        check(`${name}: the example's tabs, in order`, JSON.stringify(names) === JSON.stringify(tabs), names.join(", "));
        const stops = await tablist.getByRole("tab").evaluateAll((els) => els.filter((e) => e.tabIndex === 0).length);
        check(`${name}: the tab list is one Tab stop`, stops === 1, `${stops}`);
        await tablist.getByRole("tab", { name: "Preview" }).focus();
        const at = async () => P.evaluate(() => [document.activeElement?.textContent, document.activeElement?.getAttribute("aria-selected")]);
        const steps = [
          ["ArrowRight", tabs[1]],
          ["End", tabs[tabs.length - 1]],
          ["ArrowRight", tabs[0]],
          ["ArrowLeft", tabs[tabs.length - 1]],
          ["Home", tabs[0]],
        ];
        for (const [key, want] of steps) {
          await P.keyboard.press(key);
          const [focused, selected] = await at();
          check(`${name}: ${key} selects and focuses ${want}`, focused === want && selected === "true", `${focused}, aria-selected=${selected}`);
        }
        await P.keyboard.press("Tab");
        const panel = await P.evaluate(() => document.activeElement?.getAttribute("role"));
        check(`${name}: Tab from the tabs goes to the selected panel`, panel === "tabpanel", panel);
      }

      // The density switch is a radio group: one Tab stop, the arrow keys move the choice.
      await load(P, urlOf("dropdown"));
      const density = P.getByRole("radiogroup", { name: "Density" });
      await density.getByRole("radio", { name: "Standard" }).focus();
      await P.keyboard.press("ArrowRight");
      const chosen = await density.getByRole("radio", { checked: true }).textContent();
      const attr = await P.locator("[data-docs-example=dropdown]").locator("[data-zf-density]").getAttribute("data-zf-density");
      check("dropdown: ArrowRight in Density chooses Dense", chosen === "Dense" && attr === "dense", `${chosen}, data-zf-density=${attr}`);
      await ctx.close();
    }

    // ---------- what the question-type pages say about their examples ----------
    // Each page's messages and stored formats, against the real renderer.
    {
      const { ctx, P } = await open("light", 1440);
      const errorsOf = async () => (await P.locator(".zf-error-message").allTextContents()).map((t) => t.trim());
      const submit = () => P.getByRole("button", { name: "Submit" }).click();
      const answerWith = async (name, label, enter) => {
        await load(P, urlOf(name));
        const box = P.getByLabel(label, { exact: true });
        await enter(box);
        await submit();
        await P.waitForTimeout(300);
        return box;
      };
      const says = async (name, label, typed, want) => {
        await answerWith(name, label, (box) => box.fill(typed));
        const errors = await errorsOf();
        check(`${name}: "${typed}" gets ${want}`, errors.includes(want), errors.join(" | "));
      };
      await says("short-answer", "Preferred name", "   ", '"Preferred name" is required.');
      await says("email", "Email address", "name@localhost", "Enter a valid email address.");
      await says("phone-number", "Best phone number to reach you", "555 0100 ext 12", "Enter a valid phone number.");
      await says("link", "Referring practice's website", "example.org", "Enter a valid URL, including https://.");

      // Once shown, a message follows the answer and goes when it is fixed.
      await P.getByLabel("Referring practice's website", { exact: true }).fill("https://example.org");
      await P.waitForTimeout(300);
      check("link: the message goes once the answer is fixed", (await errorsOf()).length === 0, (await errorsOf()).join(" | "));

      const label = "How many times have you seen a therapist or counselor in the past 12 months?";
      await answerWith("number", label, (box) => box.pressSequentially("e"));
      const numberErrors = await errorsOf();
      check("number: what isn't a number counts as no answer", numberErrors.includes(`"${label}" is required.`), numberErrors.join(" | "));

      for (const [name, field, typed] of [["date", "Date of birth", "2026-10-25"], ["time", "Preferred appointment time", "14:30"]]) {
        await answerWith(name, field, (box) => box.fill(typed));
        await P.getByText("Form submitted successfully.").waitFor();
        await P.getByRole("tab", { name: "Payload" }).click();
        const payload = await P.getByRole("tabpanel").textContent();
        check(`${name}: stored as ${typed}`, payload.includes(`"${typed}"`), payload.slice(0, 200));
      }

      // Multiple choice: selecting the chosen option again clears the answer.
      await load(P, urlOf("multiple-choice"));
      await P.getByRole("radio", { name: "Video" }).click();
      await P.getByRole("radio", { name: "Video" }).click();
      await submit();
      await P.waitForTimeout(300);
      const choiceErrors = await errorsOf();
      check("multiple-choice: selecting the chosen option again clears it", choiceErrors.includes('"How would you like to attend sessions?" is required.'), choiceErrors.join(" | "));

      // Checkboxes: the answer keeps the order the options were ticked in.
      await load(P, urlOf("checkboxes"));
      for (const day of ["Thursday", "Monday"]) await P.getByRole("checkbox", { name: day }).check();
      await submit();
      await P.getByText("Form submitted successfully.").waitFor();
      await P.getByRole("tab", { name: "Payload" }).click();
      const ticked = (await P.getByRole("tabpanel").textContent()).replace(/\s+/g, "");
      check("checkboxes: ticked in order Thursday, Monday", ticked.includes('["thursday","monday"]'), ticked.slice(0, 300));

      // Respondent's country: the list the page gives, after "Select a country…".
      await load(P, urlOf("respondents-country"));
      const countries = await P.getByLabel("Country of residence", { exact: true }).locator("option").allTextContents();
      const listed = ["Select a country…", "United States", "United Kingdom", "Canada", "Australia", "India", "Germany", "France", "Netherlands", "Spain", "Italy", "Brazil", "Mexico", "Japan", "Singapore", "United Arab Emirates", "Other"];
      check("respondents-country: the list the page gives", JSON.stringify(countries) === JSON.stringify(listed), countries.join(", "));
      await ctx.close();
    }

    // The Docs menu at phone width, from the keyboard.
    {
      const { ctx, P } = await open("light", 375);
      await load(P, "/docs");
      const menu = P.getByRole("button", { name: "Docs menu" });
      await menu.focus();
      await P.keyboard.press("Enter");
      const expanded = await menu.getAttribute("aria-expanded");
      const link = P.getByRole("navigation", { name: "Docs" }).getByRole("link", { name: "Dropdown" });
      check("375px: Enter on Docs menu opens it", expanded === "true" && (await link.isVisible()), expanded);
      await ctx.close();
    }
  } catch (e) {
    check("ran to the end", false, e.stack || String(e));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  for (const [name, pass, detail] of results) console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail && !pass ? ` — ${detail}` : ""}`);
  const passed = results.filter((r) => r[1]).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
