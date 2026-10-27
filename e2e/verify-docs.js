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
  ...["short-answer", "long-answer", "multiple-choice", "checkboxes", "number", "email", "phone-number", "link", "date", "time", "linear-scale", "grid", "matrix", "rating", "ranking", "respondents-country"].map((n) => [n, `/docs/build/question-types/${n}`]),
  ...["layout-blocks", "image", "video", "audio"].map((n) => [n, `/docs/build/layout-and-media/${n}`]),
  ...["groups", "repeating-groups", "pages"].map((n) => [n, `/docs/build/structure/${n}`]),
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
        ["layout-blocks", urlOf("layout-blocks"), ["Preview", "Schema", "Payload", "Server output"]],
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

      // Linear scale: one radio per point, named by its number.
      await load(P, urlOf("linear-scale"));
      const points = await P.locator(".zf-form").getByRole("radio").evaluateAll((els) => els.map((e) => e.value));
      check("linear-scale: points 1 to 5", JSON.stringify(points) === '["1","2","3","4","5"]', points.join(", "));

      // Rating: selecting the same star again keeps the rating; "4 of 5" is stored as 4.
      await load(P, urlOf("rating"));
      await P.getByRole("button", { name: "4 stars" }).click();
      await P.getByRole("button", { name: "4 stars" }).click();
      const pressed = await P.getByRole("button", { name: "4 stars" }).getAttribute("aria-pressed");
      await submit();
      await P.getByText("Form submitted successfully.").waitFor();
      await P.getByRole("tab", { name: "Payload" }).click();
      const rated = (await P.getByRole("tabpanel").textContent()).replace(/\s+/g, "");
      check("rating: the same star again keeps it, stored as 4", pressed === "true" && rated.includes('"checkin_rating":{"state":"answered","value":4}'), `${pressed} ${rated.slice(0, 200)}`);

      // Ranking: ranked in the order selected; a partial ranking gets its message; unranking moves the rest up.
      await load(P, urlOf("ranking"));
      const item = (name) => P.getByRole("button", { name, exact: true });
      await item("Cost").click();
      await item("Distance from home").click();
      const status = await P.locator(".zf-ranking-status").textContent();
      check("ranking: the change is announced", status === "Distance from home ranked 2 of 4.", status);
      await submit();
      await P.waitForTimeout(300);
      const rankErrors = await errorsOf();
      check("ranking: a partial ranking gets its message", rankErrors.includes('Rank every option in "Rank what matters most when choosing a therapist".'), rankErrors.join(" | "));
      await item("Cost").click();
      const described = await item("Distance from home").evaluate((el) => el.getRootNode().getElementById(el.getAttribute("aria-describedby"))?.textContent);
      check("ranking: unranking moves the rest up", described === "Ranked 1 of 4", described);

      // Matrix: a partial answer gets its message when Answer every row is on.
      await load(P, urlOf("matrix"));
      await P.getByRole("radiogroup", { name: "Booking" }).getByRole("radio", { name: "Satisfied", exact: true }).check();
      await submit();
      await P.waitForTimeout(300);
      const matrixErrors = await errorsOf();
      check("matrix: a partial answer gets its message", matrixErrors.includes('Answer every row of "How satisfied were you with each part of your visit?".'), matrixErrors.join(" | "));

      // Grid: a required column's empty cells, each "Required.", and one summary entry for the column.
      await load(P, urlOf("grid"));
      const monday = P.getByRole("radiogroup", { name: "Monday, Available" });
      await monday.getByRole("radio", { name: "Yes" }).click();
      await monday.getByRole("radio", { name: "Yes" }).click();
      const cleared = !(await monday.getByRole("radio", { name: "Yes" }).isChecked());
      check("grid: selecting a Radio cell's option again clears it", cleared);
      await P.getByRole("radiogroup", { name: "Tuesday, Available" }).getByRole("radio", { name: "No" }).click();
      await submit();
      await P.waitForTimeout(300);
      const cellErrors = (await errorsOf()).filter((e) => e === "Required.").length;
      const summary = (await P.locator(".zf-error-summary").textContent()) || "";
      check("grid: Required. under each of the 4 empty cells", cellErrors === 4, `${cellErrors}`);
      check("grid: one summary entry for the column", summary.includes('"Weekly availability": answer "Available" in every row (4 missing).'), summary);
      const wideRow = await P.locator(".zf-grid-card").first().evaluate((el) => getComputedStyle(el).display);
      check("grid: a table at 1440px", wideRow === "table-row", wideRow);

      // Layout blocks: what each renders as.
      await load(P, urlOf("layout-blocks"));
      const form = P.locator(".zf-form");
      const rendered = await form.evaluate((el) => ({
        h2: [...el.querySelectorAll("h2")].map((h) => h.textContent),
        hr: el.querySelector("hr")?.getAttribute("aria-label"),
        text: el.querySelector(".zf-text")?.textContent,
        note: el.querySelector(".zf-block--label")?.textContent,
      }));
      check("layout-blocks: Heading 2 and Title are h2s, the Divider an hr named by its Label, Text and Label their Content",
        JSON.stringify(rendered) === JSON.stringify({ h2: ["About your visit", "Contact details"], hr: "Divider", text: "This form takes about 5 minutes. Only the intake team sees your answers.", note: "Questions marked * are required." }),
        JSON.stringify(rendered));

      // Image: the docs' own file, loaded, with the Label as its alt text.
      await load(P, urlOf("image"));
      const img = P.locator(".zf-form img");
      const image = await img.evaluate(async (el) => {
        if (!el.complete) await new Promise((done) => { el.addEventListener("load", done); el.addEventListener("error", done); });
        return { alt: el.alt, src: el.getAttribute("src"), loaded: el.naturalWidth > 0 };
      });
      check("image: the docs' own map, loaded, its alt text the Label", image.loaded && image.src === "/docs/clinic-entrance-map.svg" && image.alt === "Map of the clinic: the entrance faces Main Street, the parking lot is beside the clinic, and reception is just inside the entrance.", JSON.stringify(image));

      // Video and Audio: schema only, no player.
      for (const [name, src] of [["video", "/videos/welcome.mp4"], ["audio", "/audio/directions.mp3"]]) {
        await load(P, urlOf(name));
        const players = await P.locator("video, audio, iframe, [data-docs-example]").count();
        const excerpt = await P.locator("pre").first().textContent();
        check(`${name}: no player, and the schema's content`, players === 0 && excerpt.includes(`"content": "${src}"`), `${players} players; ${excerpt}`);
      }

      // Groups: the label is the section's heading, level 2 in a form without pages.
      await load(P, urlOf("groups"));
      const legend = await P.locator(".zf-form fieldset legend h2").first().textContent();
      check("groups: the label is a level 2 heading", legend === "Emergency contact", legend);

      // Repeating groups: from no entries to one, its names, removing with answers, and the error prefix.
      await load(P, urlOf("repeating-groups"));
      const entries = () => P.locator(".zf-repeat-instance").count();
      const startsEmpty = (await entries()) === 0 && (await P.getByRole("button", { name: "Add medication", exact: true }).count()) === 1;
      check("repeating-groups: starts with no entries and Add medication", startsEmpty);
      await P.getByRole("button", { name: "Add medication", exact: true }).click();
      const heading = await P.locator(".zf-repeat-instance legend").first().textContent();
      const addAnother = await P.getByRole("button", { name: "Add another medication", exact: true }).count();
      const remove = await P.getByRole("button", { name: "Remove medication 1", exact: true }).count();
      check("repeating-groups: Medication 1, Add another medication, Remove medication 1", heading.trim() === "Medication 1" && addAnother === 1 && remove === 1, `${heading} ${addAnother} ${remove}`);
      await P.getByLabel("Medication name", { exact: true }).fill("Sertraline");
      let asked = null;
      P.once("dialog", (d) => { asked = d.message(); d.accept(); });
      await P.getByRole("button", { name: "Remove medication 1", exact: true }).click();
      await P.waitForTimeout(300);
      const said = await P.locator(".zf-repeat-status").textContent();
      check("repeating-groups: removing an entry with answers asks first, then says so", asked === "Remove medication 1? Its answers will be deleted." && said === "Medication 1 removed." && (await entries()) === 0, `${asked} | ${said}`);
      await P.getByRole("button", { name: "Add medication", exact: true }).click();
      await submit();
      await P.waitForTimeout(300);
      const repeatSummary = (await P.locator(".zf-error-summary").textContent()) || "";
      check("repeating-groups: the summary names the entry", repeatSummary.includes('Medication 1: "Medication name" is required.'), repeatSummary);

      // Pages: progress, Next checking its own page, the condition, and the review page.
      await load(P, urlOf("pages"));
      const step = async () => ((await P.locator(".zf-progress").first().textContent()) || "").replace(/\s+/g, " ").trim();
      const bar = await P.locator(".zf-progress-bar").count();
      check("pages: Step 1 of 4, with the bar", (await step()).startsWith("Step 1 of 4") && bar === 1, `${await step()} bar=${bar}`);
      await P.getByRole("button", { name: "Next" }).click();
      await P.waitForTimeout(300);
      const firstPage = await errorsOf();
      check("pages: Next checks the page it is on", firstPage.includes('"Preferred name" is required.') && firstPage.includes('"Age" is required.'), firstPage.join(" | "));
      await P.getByLabel("Preferred name", { exact: true }).fill("Sam");
      await P.getByLabel("Age", { exact: true }).fill("15");
      const guardian = await P.getByLabel("Parent or guardian's name", { exact: true }).count();
      check("pages: an age under 18 shows the guardian question", guardian === 1, `${guardian}`);
      await P.getByLabel("Parent or guardian's name", { exact: true }).fill("Alex");
      await P.getByRole("button", { name: "Next" }).click();
      const second = await step();
      await P.getByLabel("Email address", { exact: true }).fill("sam@example.org");
      await P.getByRole("button", { name: "Next" }).click();
      await P.getByLabel("What brings you in today?", { exact: true }).fill("Trouble sleeping.");
      const last = await P.getByRole("button", { name: "Review" }).count();
      check("pages: Step 2 of 4 on the second page, and Review on the last", second.startsWith("Step 2 of 4") && last === 1, `${second} review=${last}`);
      await P.getByRole("button", { name: "Review" }).click();
      await P.getByRole("heading", { name: /Review your answers/ }).waitFor();
      const changes = await P.getByRole("button", { name: /^Change/ }).count();
      const review = (await P.locator(".zf-review").textContent()) || "";
      const submitHere = await P.getByRole("button", { name: "Submit" }).count();
      check("pages: the review page, a Change per page, Not answered, and Submit", changes === 3 && review.includes("Not answered") && submitHere === 1, `${changes} changes; submit=${submitHere}`);
      await ctx.close();
    }
    {
      // Grid: each row a card when the grid has less than 34rem.
      const { ctx, P } = await open("light", 375);
      await load(P, urlOf("grid"));
      const card = await P.locator(".zf-grid-card").first().evaluate((el) => getComputedStyle(el).display);
      const label = await P.locator(".zf-grid-cell-label").first().evaluate((el) => getComputedStyle(el).display);
      check("grid: each row a card at 375px, with its column labels", card === "block" && label === "block", `${card}, ${label}`);
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
