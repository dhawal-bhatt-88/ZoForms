// Undo and redo in the real editor (Edge): one step per action, typing in a
// field as one step with what leaving it generates, redo cleared by a new
// change, the buttons and the shortcuts, text fields keeping the browser's own
// undo, the announcement and the selection, the 100-step limit, and what keeps
// or clears the history: Save, Cancel, Restore, a reload. A viewer gets none.
// Screenshots of the toolbar and the versions page, light and dark, in output/undo/.
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, markVerified } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = path.join(OUT, "undo");
fs.mkdirSync(SHOTS, { recursive: true });
const PREFIX = `verify-undo-${Date.now()}`;
const PASSWORD = "Verify-pass-123!";

async function api(method, p, token, body) {
  const r = await fetch(API + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => undefined);
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${JSON.stringify(json)}`);
  return json;
}
const q = (id, label, more = {}) => ({ id, type: "short", label, required: false, ...more });
const opt = (code, label) => ({ code, label });

(async () => {
  let browser;
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(API + "/health")).ok && (await fetch(WEB + "/login")).status < 500) break; } catch {} await sleep(1000); }
    const owner = await api("POST", "/v1/auth/signup", null, { email: `${PREFIX}-owner@example.test`, password: PASSWORD, name: "Undo" });
    const T = owner.token;
    const form = await api("POST", "/v1/forms", T, { title: "Intake" });
    const content = {
      title: "Intake",
      description: "Before your visit",
      blocks: [
        q("b_name", "Name"),
        q("b_address", "Address"),
        { id: "b_mood", type: "choice", label: "Mood", required: false, options: [opt("low", "Low"), opt("high", "High")] },
        { id: "b_home", type: "group", label: "Home", blocks: [q("b_city", "City"), q("b_postcode", "Postcode")] },
        // Enough below to need scrolling.
        ...Array.from({ length: 14 }, (_, i) => q(`b_extra${i + 1}`, `Extra ${i + 1}`)),
      ],
    };
    await api("PUT", `/v1/forms/${form.id}/schema?baseVersion=1`, T, content);
    const versionRows = () => prisma.formVersion.count({ where: { formId: form.id } });

    browser = await launchBrowser();
    const context = async (token, theme = "light") => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
      await ctx.addCookies([{ name: "zoblocks-theme", value: theme, url: WEB }]);
      await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
      await ctx.addInitScript(() => {
        const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
        if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
      });
      return ctx;
    };
    const ctx = await context(T);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("no page errors", false, e.message));

    const openEditor = async (p = page) => {
      await p.goto(`${WEB}/app/forms/${form.id}/edit`);
      await p.getByText("All changes saved").waitFor({ timeout: 60000 });
    };
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const redo = page.getByRole("button", { name: "Redo", exact: true });
    const blocked = async (b) => (await b.getAttribute("aria-disabled")) === "true";
    const said = () => page.locator("[data-editor-announcement]").innerText();
    const card = (id) => page.locator(`[data-block-id="${id}"]`);
    const labels = () => page.locator("[data-block-id]").evaluateAll((els) => els.map((e) => e.querySelector("span.truncate")?.textContent));
    const order = async () => (await labels()).join(" | ");
    const aside = page.locator("aside");
    const labelInput = page.locator("#block-label");
    const select = (id) => card(id).locator("span.truncate").first().click();
    const inView = (id) => card(id).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
    const saveBtn = page.getByRole("button", { name: "Save", exact: true });
    /** Somewhere that takes no focus and edits nothing: the shortcuts are the builder's here. */
    const leaveFields = () => page.locator("[data-editor-announcement]").evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));

    await openEditor();
    const start = await order();

    // ---------- 1. the buttons ----------
    check("a form just opened: Undo and Redo are there, blocked, and say why",
      (await blocked(undo)) && (await blocked(redo))
        && (await page.locator(`#${CSS_ID(await undo.getAttribute("aria-describedby"))}`).innerText()) === "Nothing to undo"
        && (await page.locator(`#${CSS_ID(await redo.getAttribute("aria-describedby"))}`).innerText()) === "Nothing to redo");
    for (const theme of ["light", "dark"]) {
      const c = theme === "light" ? ctx : await context(T, "dark");
      const p = theme === "light" ? page : await c.newPage();
      if (theme === "dark") await openEditor(p);
      await p.locator("header").first().screenshot({ path: path.join(SHOTS, `toolbar-nothing-to-undo-${theme}.png`) });
      if (theme === "dark") await c.close();
    }

    // ---------- 2. delete, undo, redo: the announcement and the selection ----------
    await card("b_address").getByRole("button", { name: "Delete", exact: true }).click();
    check("setup: Address deleted", !(await order()).includes("Address"), await order());
    check("after a change: Undo is available and its tooltip names the step, Redo is not",
      !(await blocked(undo)) && (await blocked(redo)) && (await undo.getAttribute("title")) === "Undo: delete question 'Address' (Ctrl+Z)", await undo.getAttribute("title"));
    // Scroll away, so the undo has to bring the question back into view.
    await card("b_extra14").scrollIntoViewIfNeeded();
    await undo.click();
    await sleep(900);
    check("Undo puts the deleted question back where it was", (await order()) === start, await order());
    check("…announces \"Undone: delete question 'Address'.\" in the polite live region",
      (await said()) === "Undone: delete question 'Address'." && (await page.locator("[data-editor-announcement]").getAttribute("aria-live")) === "polite", await said());
    check("…selects it (its settings are in the pane)", (await labelInput.inputValue()) === "Address", await labelInput.inputValue());
    check("…and scrolls it into view", await inView("b_address"));
    check("…and Redo is now available, named for the step", !(await blocked(redo)) && (await redo.getAttribute("title")) === "Redo: delete question 'Address' (Ctrl+Y)", await redo.getAttribute("title"));
    check("focus stays on Undo, now blocked", (await blocked(undo)) && (await undo.evaluate((el) => el === document.activeElement)));
    await redo.click();
    check("Redo deletes it again, and says so", !(await order()).includes("Address") && (await said()) === "Redone: delete question 'Address'.", await said());
    await undo.click();
    check("…and Undo brings it back again", (await order()) === start);

    // ---------- 3. add, move, a setting ----------
    await select("b_name");
    await page.getByTitle("Insert a block").click();
    await page.getByRole("option", { name: "Short answer", exact: true }).click();
    const withNew = await labels();
    check("setup: a question added after Name", withNew.length === (start.split(" | ").length + 1), withNew.join(" | "));
    await leaveFields();
    await undo.click();
    check("Undo removes an added question", (await order()) === start && /^Undone: add (untitled )?question/.test(await said()), await said());
    await redo.click();
    check("Redo adds it back, the same question", (await labels()).join("|") === withNew.join("|") && /^Redone: add /.test(await said()), await said());
    await undo.click();

    await card("b_name").getByRole("button", { name: "Move down" }).click();
    check("setup: Name moved down", (await order()).startsWith("Address | Name"), await order());
    await undo.click();
    check("Undo moves it back, and says which question", (await order()) === start && (await said()) === "Undone: move question 'Name'.", await said());

    await select("b_name");
    const required = aside.getByRole("switch", { name: "Required" });
    await required.click();
    check("setup: Required on", (await required.getAttribute("aria-checked")) === "true");
    await undo.click();
    check("Undo turns a setting back", (await required.getAttribute("aria-checked")) === "false" && (await said()) === "Undone: edit question 'Name'.", await said());

    // ---------- 4. typing is one step, with what leaving the field generates ----------
    await select("b_name");
    await labelInput.click();
    await labelInput.press("End");
    await labelInput.pressSequentially(" in full", { delay: 20 });
    await leaveFields();
    check("setup: the label typed", (await order()).startsWith("Name in full |"), await order());
    await undo.click();
    check("Undo takes back all the typing in one field as one step", (await order()) === start && (await blocked(undo)) && (await said()) === "Undone: edit question 'Name in full'.", `${await order()} / ${await said()}`);
    await redo.click();
    check("…and Redo types it all again", (await order()).startsWith("Name in full |"));
    await undo.click();

    // An option's code is generated on leaving its edited label: the same step.
    await select("b_mood");
    await aside.getByRole("button", { name: "Add option" }).click();
    const optLabel = aside.getByRole("textbox", { name: "Option 3 label" });
    const optCode = aside.getByRole("textbox", { name: "Option 3 code" });
    check("setup: a third option, with no code yet", (await optLabel.inputValue()) === "Option 3" && (await optCode.inputValue()) === "", `${await optLabel.inputValue()} / ${await optCode.inputValue()}`);
    await optLabel.fill("Middling");
    await leaveFields();
    check("setup: leaving the label generated the code", (await optCode.inputValue()) === "middling", await optCode.inputValue());
    await undo.click();
    check("Undo takes back the label and the code it generated, as one step",
      (await optLabel.inputValue()) === "Option 3" && (await optCode.inputValue()) === "" && (await said()) === "Undone: edit options of 'Mood'.", `${await optLabel.inputValue()} / ${await optCode.inputValue()} / ${await said()}`);
    await undo.click();
    check("…and the next Undo takes back adding the option", (await aside.getByRole("textbox", { name: "Option 3 label" }).count()) === 0 && (await blocked(undo)));
    await redo.click();
    await redo.click();
    check("Redo twice: the option, then its label and code", (await optLabel.inputValue()) === "Middling" && (await optCode.inputValue()) === "middling" && (await blocked(redo)));
    await undo.click();
    await undo.click();

    // ---------- 5. redo is cleared by a new change ----------
    await card("b_address").getByRole("button", { name: "Delete", exact: true }).click();
    await undo.click();
    check("setup: something to redo", !(await blocked(redo)));
    await card("b_name").getByRole("button", { name: "Move down" }).click();
    check("a new change after an undo clears Redo", await blocked(redo));
    await undo.click();
    check("…and Undo undoes only that change", (await order()) === start && (await blocked(undo)));

    // ---------- 6. the shortcuts, and text fields keeping the browser's own ----------
    await card("b_address").getByRole("button", { name: "Delete", exact: true }).click();
    await leaveFields();
    await page.keyboard.press("Control+z");
    check("Ctrl+Z outside a text field undoes", (await order()) === start, await order());
    await page.keyboard.press("Control+y");
    check("Ctrl+Y redoes", !(await order()).includes("Address"));
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+Shift+z");
    check("Ctrl+Shift+Z redoes", !(await order()).includes("Address"));
    await page.keyboard.press("Meta+z");
    check("Cmd+Z undoes", (await order()) === start);
    await page.keyboard.press("Meta+Shift+z");
    check("Cmd+Shift+Z redoes", !(await order()).includes("Address"));

    // Address is deleted (one step). In a text field, Ctrl+Z is the field's own undo.
    const desc = page.getByRole("textbox", { name: "Form description" });
    await desc.click();
    await desc.press("End");
    await desc.pressSequentially(" please", { delay: 20 });
    await page.keyboard.press("Control+z");
    await sleep(300);
    check("Ctrl+Z in a text field leaves the builder's history alone: the deleted question stays deleted",
      !(await order()).includes("Address"), await order());
    check("…and it undid typing in that field, as the browser does", (await desc.inputValue()) !== "Before your visit please", await desc.inputValue());
    await desc.fill("Before your visit");
    await leaveFields();
    check("a field left as it was found adds no step", (await undo.getAttribute("title")) === "Undo: delete question 'Address' (Ctrl+Z)", await undo.getAttribute("title"));
    // With a dialog open the shortcuts wait.
    await card("b_home").getByRole("button", { name: "Delete group" }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Control+z");
    check("Ctrl+Z with a dialog open does nothing", !(await order()).includes("Address") && (await page.getByRole("dialog").count()) === 1);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await undo.click();
    check("setup: back to the start", (await order()) === start && (await blocked(undo)));

    // ---------- 7. groups and pages ----------
    await card("b_home").getByRole("button", { name: "Delete group" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Group and its questions/ }).click();
    check("setup: the group and its questions deleted", !(await order()).includes("City") && !(await order()).includes("Home"), await order());
    await undo.click();
    check("Undo restores a group with its contents", (await order()) === start && (await said()) === "Undone: delete group 'Home'.", await said());
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    await page.getByRole("button", { name: "Add pages", exact: true }).click();
    check("setup: the form has pages", (await page.locator("[data-page-box]").count()) === 2);
    await undo.click();
    check("Undo takes the pages away again", (await page.locator("[data-page-box]").count()) === 0 && (await order()) === start && (await said()) === "Undone: turn pages on.", await said());
    await redo.click();
    check("Redo splits it into pages again", (await page.locator("[data-page-box]").count()) === 2 && (await said()) === "Redone: turn pages on.");
    await undo.click();

    // ---------- 8. the form's title ----------
    const title = page.getByRole("textbox", { name: "Form title in the top bar" });
    await title.fill("Client intake");
    await leaveFields();
    await undo.click();
    check("Undo takes back the form title", (await title.inputValue()) === "Intake" && (await said()) === "Undone: edit form title.", await said());

    // ---------- 9. Save keeps the history; undoing after it makes the form unsaved ----------
    await card("b_address").getByRole("button", { name: "Delete", exact: true }).click();
    await page.locator("header").first().screenshot({ path: path.join(SHOTS, "toolbar-light.png") });
    const before = await versionRows();
    await saveBtn.click();
    await page.getByText("All changes saved").waitFor();
    check("Save keeps the history: Undo is still available", (await versionRows()) === before + 1 && !(await blocked(undo)));
    await undo.click();
    await page.getByText("Unsaved changes").first().waitFor();
    check("undoing after a save makes the form unsaved again: Save is available", !(await blocked(saveBtn)) && (await order()) === start);
    check("…and nothing was saved by undoing", (await versionRows()) === before + 1);
    await redo.click();
    await page.getByText("All changes saved").waitFor();
    check("redoing back to what was saved is saved again", await blocked(saveBtn));
    await undo.click();
    await saveBtn.click();
    await page.getByText("All changes saved").waitFor();

    // ---------- 10. Cancel clears the history ----------
    await card("b_name").getByRole("button", { name: "Move down" }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Discard changes" }).click();
    await page.getByText("All changes saved").waitFor();
    check("Cancel clears the history", (await blocked(undo)) && (await blocked(redo)) && (await order()) === start);

    // ---------- 11. the last 100 steps ----------
    const required2 = async () => { await select("b_name"); return aside.getByRole("switch", { name: "Required" }); };
    const sw = await required2();
    for (let i = 0; i < 103; i++) await sw.click(); // 103 steps; it ends on
    check("setup: 103 changes", (await sw.getAttribute("aria-checked")) === "true");
    let undone = 0;
    while (!(await blocked(undo)) && undone < 200) { await undo.click(); undone++; }
    check("only the last 100 steps can be undone", undone === 100, String(undone));
    check("…leaving the form as it was after the third", (await (await required2()).getAttribute("aria-checked")) === "true");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Discard changes" }).click();
    await page.getByText("All changes saved").waitFor();

    // ---------- 12. a reload loses the history ----------
    await card("b_address").getByRole("button", { name: "Delete", exact: true }).click();
    await saveBtn.click();
    await page.getByText("All changes saved").waitFor();
    check("setup: saved, with a step to undo", !(await blocked(undo)));
    await page.reload();
    await page.getByText("All changes saved").waitFor({ timeout: 60000 });
    check("a reload loses the history", (await blocked(undo)) && (await blocked(redo)) && !(await order()).includes("Address"));

    // ---------- 13. Restore clears it ----------
    await card("b_name").getByRole("button", { name: "Move down" }).click();
    await saveBtn.click();
    await page.getByText("All changes saved").waitFor();
    await page.getByRole("button", { name: "More form actions" }).filter({ visible: true }).click();
    await page.getByRole("menuitem", { name: "Version history" }).click();
    await page.getByRole("button", { name: "Restore v2", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();
    await page.waitForURL(`**/app/forms/${form.id}/edit`);
    await page.getByText("All changes saved").waitFor({ timeout: 60000 });
    check("after Restore the editor has the restored version and no history", (await order()) === start && (await blocked(undo)) && (await blocked(redo)), await order());

    // ---------- 14. a viewer ----------
    await markVerified(prisma, `${PREFIX}-owner@example.test`);
    const invite = await api("POST", "/v1/team/invites", T, { email: `${PREFIX}-viewer@example.test`, role: "VIEWER" });
    const viewer = await api("POST", `/v1/invites/${invite.invite.token}/accept`, null, { password: PASSWORD, name: "Viewer" });
    const vctx = await context(viewer.token);
    const vp = await vctx.newPage();
    await vp.goto(`${WEB}/app/forms/${form.id}/edit`);
    await vp.getByText("View only").first().waitFor({ timeout: 60000 });
    await vp.locator('[data-block-id="b_name"]').waitFor();
    check("a viewer's editor has no Undo or Redo", (await vp.getByRole("button", { name: "Undo", exact: true }).count()) === 0 && (await vp.getByRole("button", { name: "Redo", exact: true }).count()) === 0);
    const vTitle = vp.getByRole("textbox", { name: "Form title in the top bar" });
    await vTitle.fill("Changed by a viewer");
    await vp.locator("[data-editor-announcement]").evaluate(() => document.activeElement.blur());
    await vp.keyboard.press("Control+z");
    check("…and Ctrl+Z does nothing there", (await vTitle.inputValue()) === "Changed by a viewer");
    await vctx.close();

    // ---------- screenshots: the toolbar and the versions page, light and dark ----------
    const dark = await context(T, "dark");
    const dp = await dark.newPage();
    await openEditor(dp);
    await dp.locator('[data-block-id="b_address"]').getByRole("button", { name: "Delete", exact: true }).click();
    await dp.locator("header").first().screenshot({ path: path.join(SHOTS, "toolbar-dark.png") });
    await dp.screenshot({ path: path.join(SHOTS, "editor-dark.png") });
    await dp.goto(`${WEB}/app/forms/${form.id}/versions`);
    await dp.getByRole("button", { name: "Restore v1", exact: true }).waitFor({ timeout: 60000 });
    await dp.screenshot({ path: path.join(SHOTS, "versions-dark.png"), fullPage: true });
    await dark.close();
    await page.screenshot({ path: path.join(SHOTS, "editor-light.png") });
    await page.goto(`${WEB}/app/forms/${form.id}/versions`);
    await page.getByRole("button", { name: "Restore v1", exact: true }).waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(SHOTS, "versions-light.png"), fullPage: true });
    check("screenshots written", ["toolbar-light.png", "toolbar-dark.png", "versions-light.png", "versions-dark.png"].every((f) => fs.existsSync(path.join(SHOTS, f))));
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    if (browser) await browser.close();
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true, memberships: { select: { orgId: true } } } });
    const orgIds = [...new Set(users.flatMap((u) => u.memberships.map((m) => m.orgId)))];
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.invite.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.$disconnect();
  }
  const passed = results.filter(([, p]) => p).length;
  for (const [name, pass, detail] of results) console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass || !detail ? "" : `\n      ${detail}`}`);
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();

/** A React `useId` id (":r1:") as a CSS identifier. */
function CSS_ID(id) {
  return String(id).replace(/:/g, "\\:");
}
