// Phase 7, checkpoint 2: pages in the real editor (Edge).
const fs = require("fs");
const { OUT, API, WEB, PrismaClient, launchBrowser, opts } = require("./_setup");
const prisma = new PrismaClient();

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

const leaf = (id, label, type = "short", extra = {}) => ({ id, type, label, required: false, ...extra });
const group = (id, label, blocks, extra = {}) => ({ id, type: "group", label, blocks, ...extra });
const page = (id, title, blocks, extra = {}) => ({ id, type: "page", title, blocks, ...extra });
const YN = { options: opts("Yes", "No") };
const THREE = {
  title: "Health intake",
  blocks: [
    page("p1", "About you", [leaf("name", "Full name", "short", { required: true }), leaf("meds", "Do you take any regular medication?", "choice", YN)]),
    page("p2", "Medication", [
      leaf("med_name", "Medication name", "short", { required: true }),
      group("g_dose", "Dosage", [
        leaf("dose", "Dose (mg)", "number"),
        group("g_sched", "Schedule", [leaf("freq", "How often?", "dropdown", { options: opts("Once daily", "Twice daily"), required: true }), leaf("food", "Taken with food?", "choice", YN)]),
      ]),
    ], { enableWhen: [{ question: "meds", operator: "=", answer: "yes" }] }),
    page("p3", "Lifestyle", [
      leaf("smoke", "Do you smoke?", "choice", YN),
      group("g_habits", "Health habits", [leaf("exercise", "How often do you exercise?", "dropdown", { options: opts("Rarely", "Weekly", "Daily") })]),
      leaf("notes", "Anything else?"),
    ], { enableWhen: [{ question: "name", operator: "exists" }] }),
  ],
};
const SINGLE = {
  title: "Quick survey",
  blocks: [leaf("q1", "Your name"), group("g1", "Contact", [leaf("q2", "Email address", "email")]), leaf("q3", "Comments")],
};

(async () => {
  const email = `verify-pages-ui-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Pages UI" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const make = async (schema) => {
      const f = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: schema.title }) })).json();
      const r = await fetch(`${API}/v1/forms/${f.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
      if (!r.ok) throw new Error(`save ${schema.title}: ${r.status} ${await r.text()}`);
      return f.id;
    };
    const threeId = await make(THREE);
    const singleId = await make(SINGLE);

    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const page_ = await ctx.newPage();
    const P = page_;
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    // Accept native confirms: Cancel's "Discard unsaved changes?" and the leave-page warning.
    P.on("dialog", (d) => d.accept());

    const card = (id) => P.locator(`[data-block-id="${id}"]`);
    const pageBox = (id) => P.locator(`[data-page-box="${id}"]`);
    const alert = P.getByRole("alert").filter({ hasText: /Can't/ });
    const dismiss = () => P.getByRole("button", { name: "Dismiss" }).click();
    const deselect = () => P.locator('input[placeholder="Add a description…"]').click();
    const open = async (id) => { await P.goto(`${WEB}/app/forms/${id}/edit`); await P.getByText("All changes saved").waitFor(); };
    /** The canvas, one row per block: pages show their title input's value. */
    const structure = async () => (await P.locator("[data-block-id]").evaluateAll((els) => els.map((e) => {
      const title = e.querySelector('input[aria-label$=" title"]');
      const name = title ? `[${title.value}]` : e.querySelector("span.truncate").textContent;
      return `${"  ".repeat(Number(e.getAttribute("data-depth")))}${name}`;
    }))).join(" | ");
    const selectPage = (id) => card(id).locator("span", { hasText: /^Page \d+$/ }).click();
    const selectCard = (id) => card(id).locator("span.truncate").click();

    // ---------- 1. three pages, nested groups, one collapsed ----------
    await open(threeId);
    const s0 = await structure();
    check("three pages render as containers holding their blocks and nested groups", s0 ===
      "[About you] |   Full name |   Do you take any regular medication? | [Medication] |   Medication name |   Dosage |     Dose (mg) |     Schedule |       How often? |       Taken with food? | [Lifestyle] |   Do you smoke? |   Health habits |     How often do you exercise? |   Anything else?", s0);
    const headers = await P.locator("[data-page-box]").evaluateAll((els) => els.map((e) =>
      `${e.querySelector("span.uppercase").textContent} · ${e.querySelector('input[aria-label$=" title"]').value}`));
    check('page headers read "Page N · <title>"', JSON.stringify(headers) === '["Page 1 · About you","Page 2 · Medication","Page 3 · Lifestyle"]', headers.join(" / "));
    const num = async (id) => card(id).locator("span.tabular-nums").textContent();
    const nums = [await num("name"), await num("meds"), await num("med_name"), await num("dose"), await num("freq"), await num("food"), await num("smoke"), await num("exercise"), await num("notes")];
    check("numbering is continuous across pages", nums.join(" ") === "1. 2. 3. 4. 5. 6. 7. 8. 9.", nums.join(" "));
    check("pages aren't numbered", (await card("p2").locator("span.tabular-nums").count()) === 0);
    const shade = await P.evaluate(() => [
      getComputedStyle(document.querySelector('[data-group-box="g_dose"]')).backgroundColor,
      getComputedStyle(document.querySelector('[data-group-box="g_sched"]')).backgroundColor,
    ]);
    check("groups inside a page keep the box style, levels counted from the page", shade[0] === "rgb(243, 244, 246)" && shade[1] === "rgb(255, 255, 255)", shade.join(" / "));
    const pageStyle = await P.evaluate(() => getComputedStyle(document.querySelector('[data-page-box="p1"]')).borderTopWidth);
    check("a page is visually stronger than a group box (2px border)", pageStyle === "2px", pageStyle);
    check("each page has an Add to row inside it", await pageBox("p3").getByRole("button", { name: 'Add to "Lifestyle"' }).isVisible());
    check("conditional pages get the Conditional badge", await card("p2").getByText("Conditional").isVisible() && await card("p3").getByText("Conditional").isVisible() && (await card("p1").getByText("Conditional").count()) === 0);
    check("pages can't be dragged (no grip on a page header)", (await card("p1").getByRole("button", { name: "Drag to reorder" }).count()) === 0);

    await card("p3").getByRole("button", { name: 'Collapse page "Lifestyle"' }).click();
    check('a collapsed page shows "N blocks inside"', await card("p3").getByText("4 blocks inside").isVisible() && (await card("smoke").count()) === 0);
    await deselect();
    // Tall enough to show all three pages; then wait out the selection border's fade.
    await P.setViewportSize({ width: 1440, height: 1750 });
    await sleep(400);
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-1-three-pages-collapsed.png` });
    await P.setViewportSize({ width: 1440, height: 1100 });
    await card("p3").getByRole("button", { name: 'Expand page "Lifestyle"' }).click();

    // ---------- 2. conditions on pages ----------
    await selectPage("p2");
    check('inspector: a Page, with a Title and no help text or required', (await P.locator("aside h4").first().textContent()) === "Page"
      && (await P.locator("aside").getByText("Help text").count()) === 0 && (await P.locator('aside [role="switch"]').count()) === 0);
    check('"Show this page only when…"', await P.getByText("Show this page only when…").isVisible());
    const picker = P.getByRole("combobox", { name: "Question" }).first();
    const groups = await picker.locator("optgroup").evaluateAll((els) => els.map((g) => `${g.label}: ${[...g.querySelectorAll("option")].map((o) => o.textContent).join(", ")}`));
    check("the source picker lists earlier questions under their page", JSON.stringify(groups) === JSON.stringify(["About you: 1. Full name, 2. Do you take any regular medication?"]), groups.join(" | "));
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-2a-conditional-page.png` });
    await selectCard("food");
    await P.getByRole("button", { name: "Add condition" }).click();
    const deepGroups = await P.getByRole("combobox", { name: "Question" }).first().locator("optgroup").evaluateAll((els) => els.map((g) => g.label));
    check("the picker shows page › group paths", JSON.stringify(deepGroups) === JSON.stringify(["About you", "Medication", "Medication › Dosage", "Medication › Dosage › Schedule"]), deepGroups.join(" | "));
    await P.getByRole("button", { name: "Remove condition" }).click();
    await selectPage("p1");
    check("the first page shows the no-conditions message instead of the panel",
      await P.getByText("The first page can't have conditions — it is always shown.").isVisible() && (await P.getByRole("button", { name: "Add condition" }).count()) === 0);
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-2b-first-page.png` });

    // ---------- 3. Move to… ----------
    await selectCard("notes");
    // By CSS, not role: with a size attribute a select becomes a listbox.
    const moveTo = P.locator('select[aria-label="Move to"]');
    const options = await moveTo.locator("option").allTextContents();
    check('"Move to…" lists every page and group by path, with no top level',
      JSON.stringify(options) === JSON.stringify(["Move to…", "About you", "Medication", "Medication › Dosage", "Medication › Dosage › Schedule", "Lifestyle › Health habits"]), options.join(" | "));
    // Screenshot only: show the native select as an open list box.
    await moveTo.evaluate((el) => { el.setAttribute("size", String(el.options.length)); el.style.height = "auto"; });
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-3-move-to.png` });
    await moveTo.evaluate((el) => { el.removeAttribute("size"); el.style.height = ""; });
    await moveTo.selectOption({ label: "Medication › Dosage" });
    await P.getByRole("button", { name: "Move", exact: true }).click();
    const s1 = await structure();
    check('"Move to…" moves a question into a group on another page', s1.includes("[Medication] |   Medication name |   Dosage |     Dose (mg) |     Schedule |       How often? |       Taken with food? |     Anything else? | [Lifestyle]"), s1);
    await P.getByRole("button", { name: "Cancel", exact: true }).click();

    // ---------- 4. keyboard moves between pages; refused page moves ----------
    await open(threeId);
    await card("smoke").hover();
    await card("smoke").getByRole("button", { name: "Move up" }).click();
    const s2 = await structure();
    check("Move up at the top of a page steps into the end of the previous page", s2.includes("      Taken with food? |   Do you smoke? | [Lifestyle] |   Health habits"), s2);
    await card("smoke").hover();
    await card("smoke").getByRole("button", { name: "Move down" }).click();
    check("…and Move down steps back to the start of the next page", (await structure()) === s0);
    await card("name").hover();
    check("the first block of the first page can't move up", await card("name").getByRole("button", { name: "Move up" }).isDisabled());

    await card("p2").getByRole("button", { name: "Move page up" }).click();
    await alert.waitFor({ timeout: 3000 });
    const refusedMove = await alert.innerText();
    check("a conditional page can't be moved to first: says why and what to do",
      refusedMove.includes(`Can't move "Medication" up: "Medication" would become the first page, and the first page can't have conditions — it is always shown. Remove the conditions on "Medication" first.`), refusedMove);
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-6-refused-move.png` });
    await dismiss();
    await card("p3").getByRole("button", { name: "Move page up" }).click();
    const s3 = await structure();
    check("Move page up moves a page with everything in it", s3.startsWith("[About you] |   Full name |   Do you take any regular medication? | [Lifestyle] |   Do you smoke? |   Health habits"), s3);
    await card("p3").getByRole("button", { name: "Move page down" }).click();
    check("…and back down", (await structure()) === s0);

    // ---------- 5. dragging between pages ----------
    async function dragTo(fromId, toId, dx) {
      const from = card(fromId);
      await from.scrollIntoViewIfNeeded();
      await from.hover();
      const grip = await from.getByRole("button", { name: "Drag to reorder" }).boundingBox();
      const fromBox = await from.boundingBox();
      const toBox = await card(toId).boundingBox();
      const sx = grip.x + grip.width / 2, sy = grip.y + grip.height / 2;
      const ty = toBox.y + toBox.height / 2 + (sy - (fromBox.y + fromBox.height / 2));
      await P.mouse.move(sx, sy);
      await P.mouse.down();
      await P.mouse.move(sx + 8, sy + 2, { steps: 3 });
      await P.mouse.move(sx + dx, ty, { steps: 20 });
      await sleep(250);
      const lit = await P.locator("[data-drop-target]").evaluateAll((els) => els.map((e) => e.getAttribute("data-page-box") ?? e.getAttribute("data-group-box")));
      await P.mouse.up();
      await sleep(400);
      return lit;
    }
    const lit = await dragTo("notes", "p3", 0);
    const s4 = await structure();
    check("dragging a block onto the next page's header from below moves it to the end of the page above", s4.includes("      Taken with food? |   Anything else? | [Lifestyle]"), s4);
    check("while dragging, the receiving page is highlighted", JSON.stringify(lit) === '["p2"]', JSON.stringify(lit));
    await dragTo("notes", "notes", -28 * 4);
    check("dragging far left never takes a block out of its page", (await structure()) === s4);

    // ---------- 6. delete a page: both choices ----------
    await open(threeId);
    await card("p3").getByRole("button", { name: "Delete page" }).click();
    const dialog = P.getByRole("dialog");
    await dialog.waitFor();
    const text = await dialog.innerText();
    check("delete dialog offers both choices",
      text.includes("Page only (move contents to the previous page)") && text.includes("Page and its contents"), text);
    check("…warns that the page's own condition no longer applies",
      text.includes("The condition 'Show when Full name is answered' will no longer apply to these 3 questions."), text);
    check("…and that the contents move into a conditional page",
      text.includes("These 3 questions will move to 'Medication' and will only show when Do you take any regular medication? is Yes."), text);
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-5a-delete-choices.png` });
    await dialog.getByRole("button", { name: /Page only/ }).click();
    const s5 = await structure();
    check('"Page only" moves the contents to the end of the previous page', s5.endsWith("      Taken with food? |   Do you smoke? |   Health habits |     How often do you exercise? |   Anything else?") && !s5.includes("[Lifestyle]"), s5);
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-5b-after-page-only.png` });

    await open(threeId);
    await card("p1").getByRole("button", { name: "Delete page" }).click();
    await P.getByRole("dialog").getByRole("button", { name: /Page only/ }).click();
    await alert.waitFor({ timeout: 3000 });
    const refusedKeep = await alert.innerText();
    check("deleting the first page when Page 2 is conditional is refused, saying why and what to do",
      refusedKeep.includes(`Can't delete "About you" and keep its contents: "Medication" would become the first page, and the first page can't have conditions — it is always shown. Remove the conditions on "Medication" first.`), refusedKeep);
    await dismiss();
    await card("p1").getByRole("button", { name: "Delete page" }).click();
    await P.getByRole("dialog").getByRole("button", { name: /Page and its contents/ }).click();
    await alert.waitFor({ timeout: 3000 });
    const refusedAll = await alert.innerText();
    check('"Page and its contents" is refused while something outside depends on it, with jump links',
      refusedAll.includes(`Can't delete "About you" and its contents — these questions outside it have conditions that depend on something inside it:`) && refusedAll.includes("Medication →") && refusedAll.includes("Lifestyle →"), refusedAll);
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-5c-delete-with-contents-refused.png` });
    await dismiss();

    // ---------- 7. navigation settings ----------
    await deselect();
    const progress = P.getByRole("checkbox", { name: /Show progress/ });
    const review = P.getByRole("checkbox", { name: /Review page before submit/ });
    check("Navigation settings show for a paged form, with the defaults", await progress.isChecked() && !(await review.isChecked())
      && await P.getByText("Shows ‘Step 2 of 5’ above each page title").isVisible() && await P.getByText("Respondents check their answers before submitting").isVisible());
    await review.check();
    check("changing a setting is an unsaved change", await P.getByText("Unsaved changes").isVisible());
    await review.uncheck();
    check("…and changing it back leaves the form unchanged", await P.getByText("All changes saved").isVisible());
    await review.check();
    await P.locator("aside").getByText("Navigation", { exact: true }).scrollIntoViewIfNeeded();
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-7-navigation.png` });
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await P.getByText("All changes saved").waitFor({ timeout: 10000 });
    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const art = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    check("saved and downloaded with navigation { showProgress: true, reviewPage: true }", JSON.stringify(art.navigation) === '{"showProgress":true,"progressStyle":"caption","reviewPage":true}' && art.schemaVersion === 2, JSON.stringify(art.navigation));
    await P.reload();
    await P.getByText("All changes saved").waitFor();
    await deselect();
    check("navigation survives a reload", await P.getByRole("checkbox", { name: /Review page before submit/ }).isChecked());

    // ---------- 8. converting a single-page form ----------
    await open(singleId);
    await deselect();
    check("no Navigation settings on a form without pages", (await P.getByRole("checkbox", { name: /Show progress/ }).count()) === 0);
    await P.getByRole("button", { name: "Add page", exact: true }).click();
    const confirmDialog = P.getByRole("dialog");
    check('"Add page" asks first: "Your questions will move to Page 1"', (await confirmDialog.innerText()).includes("Your questions will move to Page 1"));
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-4a-convert-confirm.png` });
    await confirmDialog.getByRole("button", { name: "Add pages" }).click();
    const c1 = await structure();
    check("converting wraps everything into Page 1 and adds an empty Page 2",
      c1 === "[Untitled page] |   Your name |   Contact |     Email address |   Comments | [Untitled page]", c1);
    const secondId = await P.locator("[data-page-box]").nth(1).getAttribute("data-page-box");
    check("Page 2 is selected and says it's empty", (await P.locator("aside h4").first().textContent()) === "Page"
      && await pageBox(secondId).getByRole("button", { name: '"this page" is empty — add a block to it' }).count() === 0
      && await pageBox(secondId).getByText(/is empty — add a block to it/).isVisible());
    await card(secondId).locator('input[aria-label="Page 2 title"]').fill("Follow-up");
    await sleep(300);
    await P.screenshot({ path: `${OUT}/pages-4b-convert-result.png` });
    check('"Add page" now adds after the current page', await P.getByRole("button", { name: 'Add page after "Follow-up"' }).isVisible());
    await P.getByRole("button", { name: 'Add page after "Follow-up"' }).click();
    check("…a third page, after Page 2", (await structure()).endsWith("[Follow-up] | [Untitled page]"));
    // Down to one page: the page menu offers Remove pages instead of delete.
    for (const n of [2, 1]) {
      const id = await P.locator("[data-page-box]").nth(n).getAttribute("data-page-box");
      await card(id).getByRole("button", { name: "Delete page" }).click();
      await P.getByRole("dialog").getByRole("button", { name: /Page and its contents/ }).click();
    }
    const onlyId = await P.locator("[data-page-box]").first().getAttribute("data-page-box");
    check('with one page left, "Remove pages" replaces delete', await card(onlyId).getByRole("button", { name: "Remove pages" }).isVisible() && (await card(onlyId).getByRole("button", { name: "Delete page" }).count()) === 0);
    await card(onlyId).getByRole("button", { name: "Remove pages" }).click();
    const c2 = await structure();
    check('"Remove pages" unwraps the last page back to a form without pages', c2 === "Your name | Contact |   Email address | Comments", c2);
    check("…which is the saved form again", await P.getByText("All changes saved").isVisible());
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/pages-failure.png` }); } catch {}
  } finally {
    if (browser) await browser.close();
    const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (u) {
      for (const m of u.memberships) await prisma.organization.delete({ where: { id: m.orgId } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
  for (const [name, pass, detail] of results) console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? "   [" + detail + "]" : ""}`);
  console.log(`\n  ${results.filter((r) => r[1]).length}/${results.length} passed`);
  process.exit(results.every((r) => r[1]) ? 0 : 1);
})();
