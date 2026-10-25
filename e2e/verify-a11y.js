// Accessibility (restyle 4): axe's WCAG 2.2 A and AA rules on every screen and
// state, in light and dark; the page structure on each (one h1, headings in
// order, landmarks, named dialogs); forced colours on My forms, Team, the
// editor and sign-in; and reflow at 320px on the list and auth screens.
//
// A check fails on a serious or critical axe violation. Moderate and minor ones
// are listed in the report, e2e/output/restyle-4/a11y.json, beside every
// violation's rule, screen, state, theme and elements.
//
// Automated checks find roughly a third of WCAG problems: this is a floor, not
// a certificate. Keyboard and screen-reader passes stay manual.
const path = require("path");
const fs = require("fs");
const { API, WEB, OUT, ROOT, PrismaClient, launchBrowser, opts } = require("./_setup");
const { default: AxeBuilder } = require(require.resolve("@axe-core/playwright", { paths: [path.join(ROOT, "apps/web")] }));
const prisma = new PrismaClient();

const DIR = path.join(OUT, "restyle-4");
fs.mkdirSync(path.join(DIR, "forced-colours"), { recursive: true });
fs.mkdirSync(path.join(DIR, "reflow"), { recursive: true });

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url) {
  for (let i = 0; i < 180; i++) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await sleep(1000);
  }
  throw new Error("server not up: " + url);
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["light", "dark"];
const VIEWPORT = { width: 1440, height: 1000 };

// A form with pages, groups, scores, a grid and conditions.
const SCHEMA = {
  title: "Clinic visit",
  description: "Before your appointment",
  blocks: [
    { id: "p1", type: "page", title: "About you", blocks: [
      { id: "name", type: "short", label: "Full name", required: true },
      { id: "smokes", type: "choice", label: "Do you smoke?", options: opts("Yes", "No") },
      { id: "age", type: "number", label: "Age" },
      { id: "g1", type: "group", label: "Level one", blocks: [
        { id: "a1", type: "short", label: "First level question" },
        { id: "g2", type: "group", label: "Level two", blocks: [
          { id: "deep", type: "short", label: "Deep question", enableWhen: [{ question: "smokes", operator: "=", answer: "yes" }, { question: "age", operator: ">", answer: 18 }], enableLogicText: "1 AND 2" },
        ] },
      ] },
    ] },
    { id: "p2", type: "page", title: "Details", enableWhen: [{ question: "smokes", operator: "=", answer: "yes" }], blocks: [
      { id: "rep", type: "group", label: "Medicines", repeats: true, repeatLabel: "medicine", minOccurs: 1, blocks: [
        { id: "med", type: "short", label: "Medicine name" },
      ] },
      { id: "sc", type: "group", label: "Mood score", scores: [{ id: "total", label: "Total", formulaText: "mood", unanswered: "no-score" }], blocks: [
        { id: "mood", type: "choice", label: "Mood", name: "mood", required: true, options: [{ code: "low", label: "Low", score: 0 }, { code: "high", label: "High", score: 1 }] },
      ] },
      { id: "grid", type: "grid", label: "Substances", rows: opts("Alcohol", "Tobacco"), columns: [
        { code: "freq", label: "How often", type: "dropdown", options: opts("Daily", "Weekly"), required: true },
        { code: "age1", label: "Age at first use", type: "text" },
      ] },
    ] },
  ],
};
const GROUP_TEMPLATE = { id: "tg", type: "group", label: "Smoking history", blocks: [
  { id: "t1", type: "choice", label: "Have you ever smoked?", options: opts("Yes", "No") },
  { id: "t2", type: "number", label: "Cigarettes a day", enableWhen: [{ question: "t1", operator: "=", answer: "yes" }] },
] };

// The question-type pages whose example has a required question, so Submit shows its error
// (docs/briefs/BUILDER-BRIEF-DOCS-QUESTIONS.md). Dropdown's error state is checked on its own below.
const DOCS_ERROR_PAGES = [
  ["Short answer", "/docs/build/question-types/short-answer"],
  ["Long answer", "/docs/build/question-types/long-answer"],
  ["Multiple choice", "/docs/build/question-types/multiple-choice"],
  ["Checkboxes", "/docs/build/question-types/checkboxes"],
  ["Number", "/docs/build/question-types/number"],
  ["Email", "/docs/build/question-types/email"],
  ["Phone number", "/docs/build/question-types/phone-number"],
  ["Link", "/docs/build/question-types/link"],
  ["Date", "/docs/build/question-types/date"],
  ["Time", "/docs/build/question-types/time"],
  ["Linear scale", "/docs/build/question-types/linear-scale"],
  ["Grid", "/docs/build/question-types/grid"],
  ["Matrix", "/docs/build/question-types/matrix"],
  ["Rating", "/docs/build/question-types/rating"],
  ["Ranking", "/docs/build/question-types/ranking"],
  ["Respondent's country", "/docs/build/question-types/respondents-country"],
];

// The docs home and every page (docs/briefs/BUILDER-BRIEF-DOCS.md and BUILDER-BRIEF-DOCS-QUESTIONS.md).
const DOCS_PAGES = [
  ["docs home", "/docs"],
  ["Dropdown", "/docs/build/question-types/dropdown"],
  ...DOCS_ERROR_PAGES,
  // Display blocks only: no answerable question, so no error state to check.
  ["Layout blocks", "/docs/build/layout-and-media/layout-blocks"],
  ["Image", "/docs/build/layout-and-media/image"],
  ["Video", "/docs/build/layout-and-media/video"],
  ["Audio", "/docs/build/layout-and-media/audio"],
  ["Show a question only when it applies", "/docs/build/show-questions-conditionally"],
  ["FormRenderer", "/docs/integrate/reference/form-renderer"],
  ["Follow-up question", "/docs/examples/follow-up-question"],
];

// Every violation, for the report.
const violations = [];
const structure = [];

(async () => {
  const tag = Date.now();
  const emails = {
    author: `verify-a11y-author-${tag}@example.test`,
    viewer: `verify-a11y-viewer-${tag}@example.test`,
    empty: `verify-a11y-empty-${tag}@example.test`,
    invitee: `verify-a11y-invitee-${tag}@example.test`,
  };
  let browser;
  const started = Date.now();
  const forced = [];
  const reflow = [];
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const json = { "Content-Type": "application/json" };
    const signup = async (email, name) => (await (await fetch(API + "/v1/auth/signup", { method: "POST", headers: json, body: JSON.stringify({ email, password: "Verify-pass-123!", name }) })).json()).token;
    const A = await signup(emails.author, "Author");
    const E = await signup(emails.empty, "Empty");
    const H = { ...json, Authorization: `Bearer ${A}` };
    const put = async (id, schema) => {
      const r = await fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
      if (!r.ok) throw new Error(`save ${r.status} ${await r.text()}`);
    };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Clinic visit" }) })).json();
    await put(form.id, { ...SCHEMA, title: "Clinic visit (first draft)" });
    await put(form.id, SCHEMA);
    const single = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "One page" }) })).json();
    await put(single.id, { title: "One page", blocks: [{ id: "q", type: "short", label: "Your name" }] });
    const tplRes = await fetch(`${API}/v1/templates`, { method: "POST", headers: H, body: JSON.stringify({ kind: "group", name: "Smoking history", content: GROUP_TEMPLATE }) });
    if (!tplRes.ok) throw new Error(`template ${tplRes.status} ${await tplRes.text()}`);
    const tpl = await tplRes.json();
    const system = await prisma.template.findFirst({ where: { orgId: null, kind: "form" }, orderBy: { name: "asc" } });
    const inviteFor = async (email, role) => (await (await fetch(API + "/v1/team/invites", { method: "POST", headers: H, body: JSON.stringify({ email, role }) })).json()).invite.token;
    const V = (await (await fetch(`${API}/v1/invites/${await inviteFor(emails.viewer, "VIEWER")}/accept`, { method: "POST", headers: json, body: JSON.stringify({ password: "Verify-pass-123!", name: "Viewer" }) })).json()).token;
    const pendingInvite = await inviteFor(emails.invitee, "EDITOR");
    check("setup: a rich form, a one-page form, a group template, a system template, a viewer and an open invite", !!(form.id && single.id && tpl.id && system && V && pendingInvite));

    browser = await launchBrowser();
    const open = async ({ token = null, theme = "light", viewport = VIEWPORT, forcedColors } = {}) => {
      const ctx = await browser.newContext({ viewport, ...(forcedColors ? { forcedColors } : {}) });
      // Set before the first paint, as the boot script reads it: switching after
      // load leaves fades mid-transition, and contrast readings a reader never sees.
      await ctx.addCookies([{ name: "zoblocks-theme", value: theme, url: WEB }]);
      if (token) await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
      await ctx.addInitScript(() => {
        const st = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(s); };
        if (document.documentElement) st(); else document.addEventListener("DOMContentLoaded", st);
      });
      const P = await ctx.newPage();
      P.on("pageerror", (e) => check(`no page errors (${theme})`, false, e.message));
      P.on("dialog", (d) => d.accept());
      return { ctx, P };
    };
    // Every fade and rise finished, so axe reads the colours a reader sees. A
    // looping animation (a skeleton's shimmer) never finishes, so it isn't waited for.
    const settle = async (P) => {
      await P.waitForTimeout(120);
      await P.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
      await P.waitForTimeout(60);
    };

    /** The page's structure: headings, landmarks, dialogs. */
    const readStructure = (P) => P.evaluate(() => {
      const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";
      const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")]
        .filter((el) => visible(el) || el.classList.contains("sr-only"))
        .map((el) => ({ level: Number(el.getAttribute("aria-level")) || Number(el.tagName.slice(1)) || 2, text: el.textContent.trim().slice(0, 60) }));
      // A <header> is a banner only outside main, article, aside, nav and section.
      const banner = [...document.querySelectorAll("header,[role=banner]")].some((el) => el.getAttribute("role") === "banner" || !el.parentElement.closest("main,article,aside,nav,section,[role=main],[role=region]"));
      const main = document.querySelectorAll("main,[role=main]").length;
      const navigation = document.querySelectorAll("nav,[role=navigation]").length;
      const nameOf = (el) => {
        const label = el.getAttribute("aria-label");
        if (label?.trim()) return label.trim();
        const ids = el.getAttribute("aria-labelledby");
        return ids ? ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent.trim() ?? "").join(" ").trim() : "";
      };
      const dialogs = [...document.querySelectorAll("[role=dialog],[role=alertdialog],dialog[open]")].filter(visible).map((el) => ({ role: el.getAttribute("role") || "dialog", name: nameOf(el) }));
      return { headings, banner, main, navigation, dialogs };
    });

    /**
     * axe, then the structure. `nav`: whether the screen has real navigation
     * (the rail); the auth pages, Versions and the editor need banner and main
     * only.
     */
    const audit = async (P, screen, state, theme, { nav = false } = {}) => {
      await settle(P);
      const result = await new AxeBuilder({ page: P }).withTags(TAGS).analyze();
      for (const v of result.violations) {
        violations.push({ screen, state, theme, rule: v.id, impact: v.impact, help: v.help, url: v.helpUrl, nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary?.split("\n").slice(0, 3).join(" ") })) });
      }
      const severe = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      check(`axe, ${screen}: ${state} (${theme}): no serious or critical violations`, !severe.length, severe.map((v) => `${v.id} ×${v.nodes.length}`).join(", "));

      const s = await readStructure(P);
      const h1s = s.headings.filter((h) => h.level === 1).length;
      const skips = s.headings.filter((h, i) => i > 0 && h.level > s.headings[i - 1].level + 1).map((h) => `h${h.level} "${h.text}"`);
      const unnamed = s.dialogs.filter((d) => !d.name).map((d) => d.role);
      const problems = [
        h1s !== 1 && `${h1s} h1`,
        s.headings[0] && s.headings[0].level !== 1 && `first heading is h${s.headings[0].level}`,
        skips.length && `heading levels skipped at ${skips.join(", ")}`,
        !s.banner && "no banner",
        s.main !== 1 && `${s.main} main`,
        nav && !s.navigation && "no navigation",
        unnamed.length && `unnamed ${unnamed.join(", ")}`,
      ].filter(Boolean);
      structure.push({ screen, state, theme, problems, ...s });
      if (theme === "light") check(`structure, ${screen}: ${state}`, !problems.length, problems.join("; "));
    };

    // ================= Public and auth =================
    for (const theme of THEMES) {
      const { ctx, P } = await open({ theme });
      // The public home page: no session, and navigation of its own.
      await P.goto(WEB + "/");
      await P.locator("h1").first().waitFor({ timeout: 60000 });
      await audit(P, "Public", "home", theme, { nav: true });
      const auth = [
        ["sign-in", "/login"],
        ["sign-up", "/signup"],
        ["forgot password", "/forgot-password"],
        ["reset password", "/reset-password/not-a-real-token"],
        ["invite", `/invite/${pendingInvite}`],
        ["verify email: a link that doesn't resolve", "/verify-email/not-a-real-token"],
      ];
      for (const [name, url] of auth) {
        await P.goto(WEB + url);
        await P.locator("h1").first().waitFor({ timeout: 60000 });
        await audit(P, "Auth", name, theme);
      }
      await P.goto(WEB + "/login");
      await P.getByLabel("Email").fill(emails.author);
      await P.getByLabel("Password").fill("Not-the-password-1!");
      await P.getByRole("button", { name: /log in/i }).click();
      const refused = await P.getByRole("alert").first().waitFor({ timeout: 15000 }).then(() => true, () => false);
      if (theme === "light") check("sign-in: a wrong password is announced (role=alert)", refused);
      await audit(P, "Auth", "sign-in: a wrong password", theme);
      await ctx.close();
    }

    // ================= Docs =================
    // Public like the home page, with a side navigation. The live examples
    // render inside a shadow root, which axe scans too.
    for (const theme of THEMES) {
      const { ctx, P } = await open({ theme });
      const go = async (url) => {
        await P.goto(WEB + url);
        await P.locator("h1").first().waitFor({ timeout: 60000 });
      };
      for (const [name, url] of DOCS_PAGES) {
        await go(url);
        // A live example renders after hydration; wait for its form.
        if (await P.locator("[data-docs-example]").count()) await P.locator(".zf-form").first().waitFor({ timeout: 30000 });
        await audit(P, "Docs", name, theme, { nav: true });
      }

      await go("/docs/build/question-types/dropdown");
      await P.getByRole("button", { name: "Submit" }).click();
      await P.locator(".zf-error-summary").waitFor();
      await audit(P, "Docs", "Dropdown: the example's error shown", theme, { nav: true });

      for (const [name, url] of DOCS_ERROR_PAGES) {
        await go(url);
        await P.locator(".zf-form").first().waitFor({ timeout: 30000 });
        await P.getByRole("button", { name: "Submit" }).click();
        await P.locator(".zf-error-summary").waitFor();
        await audit(P, "Docs", `${name}: the example's error shown`, theme, { nav: true });
      }

      await go("/docs/examples/follow-up-question");
      await P.getByRole("radio", { name: "Yes" }).check();
      await P.getByRole("button", { name: "Submit" }).click();
      await P.locator(".zf-error-summary").waitFor();
      await audit(P, "Docs", "Follow-up question: the follow-up's error shown", theme, { nav: true });
      await P.getByRole("textbox", { name: "Therapist's name" }).fill("Dr. Rivera");
      await P.getByRole("button", { name: "Submit" }).click();
      await P.getByText("Form submitted successfully.").waitFor();
      await P.getByRole("tab", { name: "Server output" }).click();
      await audit(P, "Docs", "Follow-up question: submitted, Server output tab", theme, { nav: true });

      await go("/docs");
      await P.getByRole("searchbox", { name: "Search the docs" }).fill("condition");
      await P.getByRole("list", { name: "Search results" }).waitFor({ timeout: 30000 });
      await audit(P, "Docs", "search results open", theme, { nav: true });
      await P.keyboard.press("Escape");
      await P.getByRole("button", { name: "No", exact: true }).click();
      await P.getByRole("group", { name: "Tell us more" }).getByRole("button", { name: "Missing information" }).click();
      await audit(P, "Docs", "feedback: No, with a reason chosen", theme, { nav: true });
      await ctx.close();
    }

    // ================= My forms =================
    for (const theme of THEMES) {
      {
        const { ctx, P } = await open({ token: A, theme });
        await P.goto(WEB + "/app");
        await P.locator("main ul > li").first().waitFor({ timeout: 60000 });
        await audit(P, "My forms", "with forms", theme, { nav: true });
        await P.getByLabel("Search forms").fill("zzzz-nothing");
        await P.getByText(/No forms match|match/i).first().waitFor({ timeout: 5000 }).catch(() => {});
        await audit(P, "My forms", "no match", theme, { nav: true });
        await P.getByLabel("Search forms").fill("");
        await P.getByRole("button", { name: 'More actions for "Clinic visit"' }).click();
        await P.getByRole("menu").waitFor();
        await audit(P, "My forms", "a card menu open", theme, { nav: true });
        await P.getByRole("menuitem", { name: "Delete…" }).click();
        await P.getByRole("alertdialog").waitFor();
        await audit(P, "My forms", "the delete confirm", theme, { nav: true });
        await P.keyboard.press("Escape");
        await P.getByRole("button", { name: 'More actions for "One page"' }).click();
        await P.getByRole("menuitem", { name: "Duplicate" }).click();
        await P.getByText('Duplicated "One page".').waitFor({ timeout: 10000 });
        await audit(P, "My forms", "a toast", theme, { nav: true });
        await P.getByRole("button", { name: "New form" }).click();
        await P.getByRole("dialog").waitFor();
        await audit(P, "My forms", "the new-form dialog", theme, { nav: true });
        await ctx.close();
      }
      {
        const { ctx, P } = await open({ token: E, theme });
        await P.goto(WEB + "/app");
        await P.getByRole("heading", { name: "My forms" }).waitFor({ timeout: 60000 });
        await P.waitForSelector('[data-loading]', { state: "detached", timeout: 10000 }).catch(() => {});
        await P.waitForTimeout(500);
        await audit(P, "My forms", "empty", theme, { nav: true });
        await ctx.close();
      }
      {
        const { ctx, P } = await open({ token: A, theme });
        await P.route(`${API}/v1/forms`, (route) => route.request().method() === "GET" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Internal server error" }) }) : route.continue());
        await P.goto(WEB + "/app");
        await P.getByText("Couldn't load your forms").waitFor({ timeout: 60000 });
        await audit(P, "My forms", "an API error", theme, { nav: true });
        await ctx.close();
      }
    }

    // ================= Templates =================
    for (const theme of THEMES) {
      const { ctx, P } = await open({ token: A, theme });
      await P.goto(WEB + "/app/templates");
      await P.locator('[data-template-id]').first().waitFor({ timeout: 60000 });
      await audit(P, "Templates", "the System tab", theme, { nav: true });
      await P.getByRole("tab", { name: /Your organisation/ }).click();
      await P.locator(`[data-template-id="${tpl.id}"]`).waitFor();
      await audit(P, "Templates", "the Your organisation tab", theme, { nav: true });
      await P.getByRole("button", { name: 'Preview "Smoking history"' }).click();
      await P.getByRole("dialog").waitFor();
      await audit(P, "Templates", "the preview", theme, { nav: true });
      await ctx.close();
    }

    // ================= Team =================
    for (const theme of THEMES) {
      for (const [who, token] of [["as a manager", A], ["as a viewer", V]]) {
        const { ctx, P } = await open({ token, theme });
        await P.goto(WEB + "/app/team");
        await P.getByRole("table").first().waitFor({ timeout: 60000 });
        await audit(P, "Team", who, theme, { nav: true });
        await ctx.close();
      }
    }

    // ================= Versions =================
    for (const theme of THEMES) {
      const { ctx, P } = await open({ token: A, theme });
      await P.goto(`${WEB}/app/forms/${form.id}/versions`);
      await P.getByRole("button", { name: "Restore v1" }).waitFor({ timeout: 60000 });
      await audit(P, "Versions", "the list", theme);
      await P.getByRole("button", { name: "Restore v1" }).click();
      await P.getByRole("alertdialog").waitFor();
      await audit(P, "Versions", "the restore confirm", theme);
      await ctx.close();
    }

    // ================= The editor =================
    const card = (P, id) => P.locator(`[data-block-id="${id}"]`).first();
    const select = async (P, id) => { await card(P, id).click({ position: { x: 60, y: 12 } }); await P.waitForTimeout(150); };
    const openEditor = async (P, id) => {
      await P.goto(`${WEB}/app/forms/${id}/edit`);
      await P.locator("[data-save-state]").waitFor({ timeout: 90000 });
      await P.locator(`[data-block-id]`).first().waitFor();
    };
    for (const theme of THEMES) {
      const { ctx, P } = await open({ token: A, theme });
      await openEditor(P, form.id);
      await audit(P, "Editor", "a form with pages, groups, scores, a grid and conditions", theme);
      await select(P, "deep");
      await audit(P, "Editor", "a question with conditions selected", theme);
      await select(P, "sc");
      await audit(P, "Editor", "a scored group selected", theme);
      await select(P, "grid");
      await audit(P, "Editor", "a grid selected", theme);

      // The grid's type-change confirm.
      await P.locator("#grid-col-0-type").selectOption("text");
      await P.getByRole("alertdialog").waitFor();
      await audit(P, "Editor", "dialog: change a grid column's type", theme);
      await P.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();

      // Option import.
      await select(P, "smokes");
      await P.locator("aside").locator('input[type="file"]').first().setInputFiles({ name: "answers.csv", mimeType: "text/csv", buffer: Buffer.from("code,label\nyes,Yes\nno,No\nsometimes,Sometimes\n") });
      await P.getByRole("dialog").waitFor();
      await audit(P, "Editor", "dialog: import options", theme);
      await P.keyboard.press("Escape");

      // The block menu, and the template picker from it.
      await P.getByTitle("Insert a block").first().click();
      await P.locator("[data-block-menu]").waitFor();
      await audit(P, "Editor", "the block menu open", theme);
      await P.getByRole("combobox", { name: "Search blocks" }).fill("template");
      await P.locator('[data-block-menu] [role="option"]').filter({ hasText: "From template…" }).click();
      await P.getByRole("dialog").waitFor();
      await audit(P, "Editor", "dialog: insert from a template (the picker)", theme);
      await P.keyboard.press("Escape");

      // Delete a group, delete a page.
      await select(P, "g1");
      await card(P, "g1").getByRole("button", { name: "Delete group" }).first().click();
      await P.getByRole("dialog").waitFor();
      await audit(P, "Editor", "dialog: delete a group", theme);
      await P.keyboard.press("Escape");
      await P.locator('[data-page-box="p2"]').getByRole("button", { name: "Delete page" }).first().click();
      await P.getByRole("dialog").waitFor();
      await audit(P, "Editor", "dialog: delete a page", theme);
      await P.keyboard.press("Escape");

      // A refusal: the score uses "mood".
      await select(P, "mood");
      await card(P, "mood").getByRole("button", { name: "Delete", exact: true }).click();
      const refusal = await P.getByRole("alert").first().waitFor({ timeout: 5000 }).then(() => true, () => false);
      if (theme === "light") check("editor: deleting a scored question is refused with an alert", refusal);
      await audit(P, "Editor", "a refusal Callout", theme);

      // Save as template.
      await P.getByRole("button", { name: "More form actions" }).click();
      await P.getByRole("menuitem", { name: "Save form as template…" }).click();
      await P.getByRole("dialog").waitFor();
      await audit(P, "Editor", "dialog: save the form as a template", theme);
      await P.keyboard.press("Escape");

      // Discard unsaved changes.
      // The top bar's title field ("Form title in the top bar"; the canvas has "…on the canvas").
      await P.getByRole("banner").getByLabel("Form title").fill("Clinic visit, edited");
      await P.getByRole("button", { name: "Cancel", exact: true }).click();
      await P.getByRole("alertdialog", { name: "Discard unsaved changes?" }).waitFor();
      await audit(P, "Editor", "dialog: discard unsaved changes", theme);
      await P.getByRole("alertdialog").getByRole("button", { name: "Discard changes" }).click();

      // Paging a one-page form.
      await openEditor(P, single.id);
      await P.getByRole("button", { name: "Add page", exact: true }).click();
      await P.getByRole("dialog").waitFor();
      await audit(P, "Editor", "dialog: add pages to a one-page form", theme);
      await P.keyboard.press("Escape");

      // A group template; a read-only system template.
      await P.goto(`${WEB}/app/templates/${tpl.id}/edit`);
      await P.locator("[data-save-state]").waitFor({ timeout: 90000 });
      await audit(P, "Editor", "a group template", theme);
      await P.goto(`${WEB}/app/templates/${system.id}/edit`);
      await P.getByText("View only").waitFor({ timeout: 90000 });
      await audit(P, "Editor", `a read-only system template ("${system.name}")`, theme);
      await ctx.close();

      const viewer = await open({ token: V, theme });
      await viewer.P.goto(`${WEB}/app/forms/${form.id}/edit`);
      await viewer.P.getByText("View only").waitFor({ timeout: 90000 });
      await audit(viewer.P, "Editor", "as a viewer", theme);
      await viewer.ctx.close();
    }

    // ================= Forced colours =================
    // Each indicator is compared with itself in the other state, by pixels: if
    // the two pictures are the same, the state can't be seen in forced colours.
    const FC = path.join(DIR, "forced-colours");
    const clipOf = async (loc, pad = 6) => {
      const b = await loc.boundingBox();
      return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 };
    };
    const differs = async (P, loc, name, before, after) => {
      await P.mouse.move(1, 1);
      const clip = await clipOf(loc);
      await before();
      await settle(P);
      const a = await P.screenshot({ clip, path: path.join(FC, `${name}-a.png`) });
      await after();
      await settle(P);
      await P.mouse.move(1, 1);
      const b = await P.screenshot({ clip, path: path.join(FC, `${name}-b.png`) });
      return !a.equals(b);
    };
    const fcCheck = (name, pass, detail = "") => { forced.push({ name, pass, detail }); check(`forced colours: ${name}`, pass, detail); };
    for (const theme of THEMES) {
      // Sign-in: the focus ring on a field and on the button.
      {
        const { ctx, P } = await open({ theme, forcedColors: "active" });
        await P.goto(WEB + "/login");
        await P.locator("h1").waitFor();
        await settle(P);
        await P.screenshot({ path: path.join(FC, `sign-in-${theme}.png`) });
        const email = P.getByLabel("Email");
        fcCheck(`sign-in (${theme}): a focused field is marked`, await differs(P, email, `signin-field-focus-${theme}`, () => P.locator("h1").click(), () => email.focus()));
        const button = P.getByRole("button", { name: /log in/i });
        fcCheck(`sign-in (${theme}): the focus ring on a button`, await differs(P, button, `signin-button-focus-${theme}`, () => P.locator("h1").click(), async () => { await P.getByLabel("Password").focus(); await P.keyboard.press("Tab"); while (!(await button.evaluate((el) => el === document.activeElement))) await P.keyboard.press("Tab"); }));
        await ctx.close();
      }
      // My forms: the selected theme segment; a card's focus ring; a dialog's edge.
      {
        const { ctx, P } = await open({ token: A, theme, forcedColors: "active" });
        await P.goto(WEB + "/app");
        await P.locator("main ul > li").first().waitFor({ timeout: 60000 });
        await settle(P);
        await P.screenshot({ path: path.join(FC, `my-forms-${theme}.png`) });
        const other = theme === "light" ? "Dark" : "Light";
        const mine = theme === "light" ? "Light" : "Dark";
        const seg = P.getByRole("radiogroup", { name: "Colour theme" }).getByRole("radio", { name: mine });
        fcCheck(`My forms (${theme}): the selected segment is distinguishable`, await differs(P, seg, `segment-${theme}`, async () => {}, async () => { await P.getByRole("radiogroup", { name: "Colour theme" }).getByRole("radio", { name: other }).click(); }));
        await P.getByRole("radiogroup", { name: "Colour theme" }).getByRole("radio", { name: mine }).click();
        const cardLink = P.getByRole("link", { name: "Edit Clinic visit" });
        fcCheck(`My forms (${theme}): a card's focus ring`, await differs(P, cardLink, `card-focus-${theme}`, () => P.locator("h1").click(), async () => {
          // By keyboard, so :focus-visible applies; the card list is newest first, so Tab until it's this card.
          await P.getByLabel("Sort forms").focus();
          for (let i = 0; i < 20 && !(await cardLink.evaluate((el) => el === document.activeElement)); i++) await P.keyboard.press("Tab");
        }), "the card's link, reached by Tab, drew nothing new");
        await P.getByRole("button", { name: 'More actions for "Clinic visit"' }).click();
        await P.getByRole("menuitem", { name: "Delete…" }).click();
        const dialog = P.getByRole("alertdialog");
        await dialog.waitFor();
        await settle(P);
        await P.screenshot({ path: path.join(FC, `my-forms-confirm-${theme}.png`) });
        const edge = await dialog.evaluate((el) => { const s = getComputedStyle(el); return { width: s.borderTopWidth, style: s.borderTopStyle, color: s.borderTopColor, outline: s.outlineStyle }; });
        fcCheck(`My forms (${theme}): the confirm dialog has an edge`, (parseFloat(edge.width) >= 1 && edge.style !== "none" && !/rgba\(0, 0, 0, 0\)|transparent/.test(edge.color)) || edge.outline !== "none", JSON.stringify(edge));
        await ctx.close();
      }
      // Team: Switch and Checkbox states, where Team has them; the invite form's focus.
      {
        const { ctx, P } = await open({ token: A, theme, forcedColors: "active" });
        await P.goto(WEB + "/app/team");
        await P.getByRole("table").first().waitFor({ timeout: 60000 });
        await settle(P);
        await P.screenshot({ path: path.join(FC, `team-${theme}.png`), fullPage: true });
        const email = P.getByLabel("Email");
        fcCheck(`Team (${theme}): a focused field is marked`, await differs(P, email, `team-field-focus-${theme}`, () => P.locator("h1").click(), () => email.focus()));
        await ctx.close();
      }
      // The editor: the selected block, a Checkbox and a Switch in the pane, a dialog's edge.
      {
        const { ctx, P } = await open({ token: A, theme, forcedColors: "active" });
        await openEditor(P, form.id);
        await settle(P);
        await P.screenshot({ path: path.join(FC, `editor-${theme}.png`) });
        fcCheck(`editor (${theme}): the selected block is distinguishable`, await differs(P, card(P, "name"), `block-selected-${theme}`, async () => { await select(P, "age"); }, async () => { await select(P, "name"); }));
        // The Switch: a group's "Repeats".
        await select(P, "g1");
        const repeats = P.locator("aside").getByRole("switch", { name: "Repeats" });
        fcCheck(`editor (${theme}): the Switch shows its state`, await differs(P, repeats, `switch-${theme}`, async () => {}, async () => { await repeats.click(); }));
        await repeats.click();
        // The Checkbox: the paged form's "Show progress", with nothing selected.
        await P.locator('input[placeholder="Add a description…"]').click();
        const progress = P.locator("aside").getByRole("checkbox", { name: /Show progress/ });
        fcCheck(`editor (${theme}): the Checkbox shows its state`, await differs(P, progress, `checkbox-${theme}`, async () => {}, async () => { await progress.click(); }));
        await progress.click();
        await select(P, "g1");
        await card(P, "g1").getByRole("button", { name: "Delete group" }).first().click();
        const dialog = P.getByRole("dialog");
        await dialog.waitFor();
        await settle(P);
        await P.screenshot({ path: path.join(FC, `editor-dialog-${theme}.png`) });
        const edge = await dialog.evaluate((el) => { const s = getComputedStyle(el); return { width: s.borderTopWidth, style: s.borderTopStyle, color: s.borderTopColor }; });
        fcCheck(`editor (${theme}): a dialog has an edge`, parseFloat(edge.width) >= 1 && edge.style !== "none" && !/rgba\(0, 0, 0, 0\)|transparent/.test(edge.color), JSON.stringify(edge));
        await ctx.close();
      }
    }

    // ================= Reflow at 320px =================
    // Nothing scrolls sideways (WCAG 1.4.10) except inside a table's own scroller.
    const RF = path.join(DIR, "reflow");
    const reflowScreens = [
      ["home", null, "/"], ["sign-in", null, "/login"], ["sign-up", null, "/signup"], ["forgot password", null, "/forgot-password"],
      ["reset password", null, "/reset-password/not-a-real-token"], ["invite", null, `/invite/${pendingInvite}`], ["verify email", null, "/verify-email/not-a-real-token"],
      ["My forms", A, "/app"], ["Templates", A, "/app/templates"], ["Team", A, "/app/team"], ["Versions", A, `/app/forms/${form.id}/versions`],
      ...DOCS_PAGES.map(([name, url]) => [`docs: ${name}`, null, url]),
      ["docs: Docs menu open", null, "/docs", (P) => P.getByRole("button", { name: "Docs menu" }).click()],
    ];
    {
      const { ctx, P } = await open({ token: null, theme: "light", viewport: { width: 320, height: 640 } });
      for (const [name, token, url, then] of reflowScreens) {
        if (token) await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
        await P.goto(WEB + url);
        await P.locator("h1").first().waitFor({ timeout: 60000 });
        await P.waitForTimeout(800);
        if (then) await then(P);
        await settle(P);
        const r = await P.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth - 1) return true; } return false; };
          const out = [...document.body.querySelectorAll("*")].filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width && b.right > vw + 1 && !scroller(el) && getComputedStyle(el).position !== "fixed" && !el.closest(".sr-only");
          }).slice(0, 6).map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${[...el.classList].slice(0, 3).join(".")} → ${Math.round(el.getBoundingClientRect().right)}px`);
          return { vw, scrollWidth: document.documentElement.scrollWidth, out };
        });
        await P.screenshot({ path: path.join(RF, `${name.replace(/\W+/g, "-")}.png`), fullPage: true });
        reflow.push({ name, ...r });
        check(`reflow at 320px: ${name}`, r.scrollWidth <= r.vw && !r.out.length, `${r.scrollWidth}px wide; ${r.out.join("; ")}`);
      }
      await ctx.close();
    }

  } catch (e) {
    check("ran to the end", false, e.stack || String(e));
  } finally {
    fs.writeFileSync(path.join(DIR, "a11y.json"), JSON.stringify({ seconds: Math.round((Date.now() - started) / 1000), violations, structure, forced, reflow }, null, 2));
    if (browser) await browser.close().catch(() => {});
    for (const email of Object.values(emails)) {
      const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } }).catch(() => null);
      if (!u) continue;
      for (const m of u.memberships) await prisma.organization.delete({ where: { id: m.orgId } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  // The violations, grouped by rule.
  const byRule = {};
  for (const v of violations) (byRule[`${v.rule} (${v.impact})`] ??= []).push(`${v.screen}: ${v.state} (${v.theme}) ×${v.nodes.length}`);
  for (const [rule, where] of Object.entries(byRule)) console.log(`axe ${rule}\n    ${where.join("\n    ")}`);
  for (const [name, pass, detail] of results) console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  const passed = results.filter((r) => r[1]).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
