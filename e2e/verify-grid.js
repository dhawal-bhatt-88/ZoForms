// The grid block (contract §14) in the editor: inserting it from the menu (and
// "matrix" + Enter still inserting a Matrix), the canvas table, the Rows and
// Columns editors, and — after every column edit — every column's type, options
// and required read back from the inspector: editing a code or a label, a code
// generated on leaving an edited label, adding, removing, moving, Required, and
// each type change (Radio ↔ Dropdown keeps options; Text → choice seeds them;
// choice → Text asks first, Cancel changes nothing, focus returns). Also row and
// column-option import (Add, Replace), labels as literal text everywhere, a wide
// grid scrolling inside its card, and the saved schema. Then the code note shown
// once per grid, editing rows, every save rejection the editor can produce (its
// inline message is the API's text), a grid inside a repeating group, and the
// downloaded artifact's exact §14.1 shape. With E2E_EXTERNAL_APP_URL set, the
// download is rendered in the test app (@zoworkhq/zoforms 0.25.0 or later): the §14.5 layout
// (the table in its own named, focusable region, a table at the app's width and
// either side of the 34rem container breakpoint, cards below it), a required
// column blocks submit, a filled grid submits, and the stored record is checked.
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact, opts, noIds, hasIds, ZF_RENDERER, rendererVersion, atLeast } = require("./_setup");
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
const HTML = "<img src=x onerror=alert(1)>";
const file = (name, text) => ({ name, mimeType: name.endsWith(".csv") ? "text/csv" : "text/plain", buffer: Buffer.from(text, "utf8") });
const placeholders = () => [["", "Option 1"], ["", "Option 2"], ["", "Option 3"]];
const EXTERNAL_APP = process.env.E2E_EXTERNAL_APP_URL;
const ARTIFACT = "builder-grid-schema.json";
const NOTE = "Changing a code after the form is in use will not match answers already stored under the old code.";

(async () => {
  const email = `verify-grid-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Grid" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;

    await waitFor(WEB + "/login");
    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 2400 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    // No native dialog but the browser's own "leave with unsaved changes?" warning:
    // the editor asks in its own dialogs, and an alert would mean a label ran as HTML.
    P.on("dialog", async (d) => {
      if (d.type() === "beforeunload") { await d.accept(); return; }
      check("no unexpected native dialogs (an alert would mean a label ran as HTML)", false, `${d.type()}: ${d.message()}`);
      await d.dismiss();
    });
    // The type-change confirmations the editor showed, in its own dialog: what each said.
    const confirms = [];
    const confirmDialog = P.getByRole("alertdialog");

    const aside = P.locator("aside");
    const saveBtn = P.getByRole("button", { name: "Save", exact: true });
    const deselect = () => P.locator('input[placeholder="Add a description…"]').click();
    const focused = () => P.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("aria-label") || "");
    const frame = () => P.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const insertBySearch = async (query) => {
      await deselect();
      await P.getByTitle("Insert a block").click();
      await P.getByPlaceholder("Search blocks…").fill(query);
      await P.keyboard.press("Enter");
      await P.locator("#block-label").waitFor();
    };

    // The inspector, read back: every column's code, label, type, Required and options.
    const readColumns = () =>
      aside.locator("[data-grid-column]").evaluateAll((els) =>
        els.map((el, i) => {
          const type = el.querySelector(`#grid-col-${i}-type`).value;
          return {
            code: el.querySelector(`#grid-columns-${i}-code`).value,
            label: el.querySelector(`#grid-columns-${i}-label`).value,
            type,
            required: el.querySelector(`#grid-col-${i}-required`).getAttribute("aria-checked") === "true",
            options: type === "text" ? null : [...el.querySelectorAll(`input[id^="grid-col-${i}-options-"][id$="-code"]`)].map((c) => [
              c.value, el.querySelector(`#${c.id.replace(/-code$/, "-label")}`).value,
            ]),
          };
        }),
      );
    // What the inspector must show; every step updates it, then checks every column against it.
    let model = [];
    const expectColumns = async (step) => {
      const seen = await readColumns();
      check(`after ${step}: every column's type, options and required intact`, JSON.stringify(seen) === JSON.stringify(model),
        `\n      seen     ${JSON.stringify(seen)}\n      expected ${JSON.stringify(model)}`);
    };
    const colLabel = (i) => P.locator(`#grid-columns-${i}-label`);
    const colCode = (i) => P.locator(`#grid-columns-${i}-code`);
    const typeOf = (i) => P.locator(`#grid-col-${i}-type`);
    const optLabel = (i, k) => P.locator(`#grid-col-${i}-options-${k}-label`);
    const setColumnLabel = async (i, value) => { await colLabel(i).fill(value); await colLabel(i).press("Tab"); };
    const setOptionLabels = async (i, ...values) => {
      for (let k = 0; k < values.length; k++) {
        if (!(await optLabel(i, k).count())) await aside.getByRole("button", { name: `Add option to column ${i + 1}` }).click();
        await optLabel(i, k).fill(values[k]);
        await optLabel(i, k).press("Tab");
      }
      while (await optLabel(i, values.length).count()) {
        await aside.getByRole("button", { name: `Remove option ${values.length + 1}, column ${i + 1}` }).click();
      }
    };
    // `answer`: true confirms, false cancels, null expects no confirmation.
    const changeType = async (i, type, answer = null) => {
      await typeOf(i).focus();
      await typeOf(i).selectOption(type);
      await frame();
      if (!(await confirmDialog.count())) return;
      confirms.push({ title: await confirmDialog.getByRole("heading").innerText(), text: await confirmDialog.innerText() });
      if (answer === null) check("no unexpected confirmation", false, JSON.stringify(confirms.at(-1)));
      await confirmDialog.getByRole("button", { name: answer ? "Change to short text" : "Cancel", exact: true }).click();
      await frame();
    };

    // ================= insert menu =================
    const formId = await create("Substance use");
    await P.goto(`${WEB}/app/forms/${formId}/edit`);
    await P.getByText("All changes saved").waitFor({ timeout: 90000 });

    await insertBySearch("matrix");
    check('insert menu: "matrix" + Enter inserts a Matrix', (await P.locator("#block-label").inputValue()) === "Matrix question");
    await insertBySearch("grid");
    check('insert menu: "grid" + Enter inserts a Grid', (await P.locator("#block-label").inputValue()) === "Grid question");
    await P.getByTitle("Insert a block").click();
    await P.getByPlaceholder("Search blocks…").fill("grid");
    const menuItems = await P.locator('[data-block-menu] [role="option"] [data-label]').allTextContents();
    check('insert menu: "grid" lists Grid first, then Matrix (its keywords untouched)', JSON.stringify(menuItems) === '["Grid","Matrix"]', JSON.stringify(menuItems));
    await P.keyboard.press("Escape");

    // ================= a new grid =================
    const gridCard = P.locator("[data-block-id]").filter({ has: P.locator("[data-grid-preview]") }).first();
    const preview = gridCard.locator("[data-grid-preview]");
    await gridCard.locator("span.truncate").first().click();
    await P.locator("#block-label").fill("Substance use");
    check("new grid: canvas table with column and row headers", JSON.stringify(await preview.locator('th[scope="col"]').allTextContents()) === '["Column 1"]'
      && JSON.stringify(await preview.locator('th[scope="row"]').allTextContents()) === '["Row 1","Row 2","Row 3"]');
    check("new grid: the label isn't repeated above the table", (await gridCard.getByText("Substance use", { exact: true }).count()) === 1);
    check("new grid: it is numbered like a question", (await gridCard.locator("span.tabular-nums").textContent()) === "2.");
    check("new grid: rows start with empty codes", JSON.stringify(await aside.locator('input[id^="rows-"][id$="-code"]').evaluateAll((e) => e.map((x) => x.value))) === '["","",""]');
    model = [{ code: "", label: "Column 1", type: "text", required: false, options: null }];
    await expectColumns("inserting the grid");
    check("new grid: no block-level Required or completeRequired switch", (await P.locator("#required-label").count()) === 0 && (await P.locator("#complete-label").count()) === 0);
    check("new grid: Help text is offered", (await aside.getByText("Help text", { exact: true }).count()) === 1);
    await gridCard.screenshot({ path: `${OUT}/grid-1-new-on-canvas.png` });

    // ================= building the columns, checking every column after each step =================
    await setColumnLabel(0, "Age at first use");
    model[0] = { ...model[0], code: "age_at_first_use", label: "Age at first use" };
    await expectColumns("editing column 1's label (its code generated on leaving it)");
    await aside.getByRole("switch", { name: "Required — Age at first use" }).click();
    model[0].required = true;
    await expectColumns("turning Required on for column 1");

    await aside.getByRole("button", { name: "Add column" }).click();
    model.push({ code: "", label: "Column 2", type: "text", required: false, options: null });
    await expectColumns("adding column 2");
    await setColumnLabel(1, "Frequency");
    model[1] = { ...model[1], code: "frequency", label: "Frequency" };
    await changeType(1, "dropdown");
    model[1] = { ...model[1], type: "dropdown", options: placeholders() };
    await expectColumns("changing column 2 from Short text to Dropdown (placeholder options, no question asked)");
    await setOptionLabels(1, "Daily", "Weekly", "Rarely");
    model[1].options = [["daily", "Daily"], ["weekly", "Weekly"], ["rarely", "Rarely"]];
    await expectColumns("labelling column 2's options");

    await aside.getByRole("button", { name: "Add column" }).click();
    await setColumnLabel(2, "Used in the last 30 days?");
    await changeType(2, "radio");
    await setOptionLabels(2, "Yes", "No");
    await aside.getByRole("switch", { name: "Required — Used in the last 30 days?" }).click();
    model.push({ code: "used_in_the_last_30_days", label: "Used in the last 30 days?", type: "radio", required: true, options: [["yes", "Yes"], ["no", "No"]] });
    await expectColumns("adding a required radio column 3");

    await aside.getByRole("button", { name: "Add column" }).click();
    await setColumnLabel(3, "Sought help?");
    await changeType(3, "radio");
    await setOptionLabels(3, "Yes", "No", "Not sure");
    model.push({ code: "sought_help", label: "Sought help?", type: "radio", required: false, options: [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]] });
    await expectColumns("adding radio column 4");
    check("one column of each type, some required", JSON.stringify(model.map((c) => [c.type, c.required])) === '[["text",true],["dropdown",false],["radio",true],["radio",false]]');
    check("dirty after grid edits: Save enabled", (await saveBtn.getAttribute("aria-disabled")) !== "true" && (await P.getByText("Unsaved changes").count()) === 1);
    await aside.locator("fieldset", { has: P.locator("legend", { hasText: /^Columns$/ }) }).screenshot({ path: `${OUT}/grid-2-inspector-columns.png` });

    // Accessible names carry the column's position or label.
    for (const name of ["Column 2 type", "Required — Frequency", "Move column 2 up", "Move column 2 down", "Column 2 code", "Column 2 label", "Remove column 2",
      "Option 1 code, column 2", "Option 1 label, column 2", "Remove option 1, column 2", "Add option to column 2", "Import from file into options for column 2", "Options for column 2"]) {
      check(`accessible name: "${name}"`, (await aside.getByLabel(name, { exact: true }).or(aside.getByRole("button", { name, exact: true })).or(aside.getByRole("group", { name, exact: true })).count()) === 1);
    }

    // ---------- edits ----------
    await colCode(2).fill("last_30");
    await colCode(2).press("Tab");
    model[2].code = "last_30";
    await expectColumns("editing column 3's code");

    await setColumnLabel(1, "How often");
    model[1].label = "How often";
    await expectColumns("editing column 2's label (its code is never regenerated)");

    await colCode(3).fill("");
    await colCode(3).press("Tab");
    model[3].code = "";
    await expectColumns("emptying column 4's code (no condition uses it, so it stays empty)");
    await setColumnLabel(3, "Sought any help?");
    model[3] = { ...model[3], code: "sought_any_help", label: "Sought any help?" };
    await expectColumns("generating column 4's code on leaving its edited label");

    await aside.getByRole("switch", { name: "Required — How often" }).click();
    model[1].required = true;
    await expectColumns("turning Required on for column 2");
    await aside.getByRole("switch", { name: "Required — How often" }).click();
    model[1].required = false;
    await expectColumns("turning it off again");

    // ---------- moving ----------
    check("the first column can't move up, the last can't move down",
      (await P.locator("#grid-col-0-move-up").isDisabled()) && (await P.locator("#grid-col-3-move-down").isDisabled()));
    await P.locator("#grid-col-0-move-down").click();
    model = [model[1], model[0], model[2], model[3]];
    await frame();
    await expectColumns("moving column 1 down");
    check("focus follows the moved column", (await focused()) === "grid-col-1-move-down", await focused());
    await P.locator("#grid-col-3-move-up").click();
    model = [model[0], model[1], model[3], model[2]];
    await frame();
    await expectColumns("moving column 4 up");
    await P.locator("#grid-col-0-move-up").evaluate((b) => b.click()); // disabled: nothing happens
    await expectColumns("pressing a disabled Move up");
    // What is seen: the required mark's screen-reader word ("required") is left out.
    const headers = () => preview.locator('th[scope="col"]').evaluateAll((ths) => ths.map((th) => {
      const copy = th.cloneNode(true);
      copy.querySelectorAll(".sr-only").forEach((s) => s.remove());
      return copy.textContent;
    }));
    check("the canvas headers follow the column order", JSON.stringify(await headers())
      === JSON.stringify(model.map((c) => (c.required ? `${c.label} *` : c.label))), JSON.stringify(await headers()));
    check("…a required column's mark is read as \"required\"", (await preview.locator('th[scope="col"] [data-required-mark] .sr-only').allTextContents()).every((t) => t === "required"));

    // ---------- adding and removing ----------
    await aside.getByRole("button", { name: "Add column" }).click();
    model.push({ code: "", label: "Column 5", type: "text", required: false, options: null });
    await expectColumns("adding column 5");
    await aside.getByRole("button", { name: "Remove column 5", exact: true }).click();
    model.pop();
    await expectColumns("removing the last column");
    await aside.getByRole("button", { name: "Remove column 2", exact: true }).click();
    const removed = model.splice(1, 1)[0];
    await expectColumns("removing column 2 from the middle");
    await aside.getByRole("button", { name: "Add column" }).click();
    await setColumnLabel(3, removed.label);
    await changeType(3, "text");
    model.push({ code: "age_at_first_use", label: removed.label, type: "text", required: false, options: null });
    await aside.getByRole("switch", { name: `Required — ${removed.label}` }).click();
    model[3].required = true;
    await expectColumns("adding it back at the end");

    // ---------- type changes ----------
    // Columns now: How often (dropdown), Sought any help? (radio), Used in the last 30 days? (radio, required), Age at first use (text, required).
    check("columns before the type changes", JSON.stringify(model.map((c) => [c.label, c.type])) === JSON.stringify([["How often", "dropdown"], ["Sought any help?", "radio"], ["Used in the last 30 days?", "radio"], ["Age at first use", "text"]]));
    await changeType(1, "dropdown");
    model[1].type = "dropdown";
    await expectColumns("Radio → Dropdown (options kept, nothing asked)");
    await changeType(0, "radio");
    model[0].type = "radio";
    await expectColumns("Dropdown → Radio (options kept, nothing asked)");
    check("no confirmation between Radio and Dropdown", confirms.length === 0, JSON.stringify(confirms));
    await changeType(3, "dropdown");
    model[3] = { ...model[3], type: "dropdown", options: placeholders() };
    await expectColumns("Short text → Dropdown (placeholder options, codes empty)");

    await changeType(2, "text", false);
    check("Radio → Short text asks first, with the exact text", confirms.length === 1 && confirms[0].title === 'Change "Used in the last 30 days?" to short text?'
      && confirms[0].text.includes("Its 2 options will be removed."), JSON.stringify(confirms));
    check("Cancel leaves the type control on Radio", (await typeOf(2).inputValue()) === "radio");
    await expectColumns("cancelling Radio → Short text (nothing changes)");
    check("focus returns to the type control after Cancel", (await focused()) === "grid-col-2-type", await focused());
    await changeType(2, "text", true);
    model[2] = { ...model[2], type: "text", options: null };
    check("asked again on the second try", confirms.length === 2);
    await expectColumns("confirming Radio → Short text (options removed, required kept)");
    check("focus returns to the type control after OK", (await focused()) === "grid-col-2-type", await focused());
    await changeType(2, "radio");
    model[2] = { ...model[2], type: "radio", options: placeholders() };
    await expectColumns("Short text → Radio again (fresh placeholders, codes empty)");
    await setOptionLabels(2, "Yes", "No");
    model[2].options = [["yes", "Yes"], ["no", "No"]];
    await expectColumns("Short text → Radio again (fresh placeholders, relabelled)");

    // ---------- import: column options and rows ----------
    const columnFile = (i) => aside.locator(`[data-grid-column="${i}"] input[type="file"]`);
    const dialog = P.getByRole("dialog");
    const apply = () => dialog.getByRole("button", { name: /^(Add|Replace with) \d+$/ });
    await columnFile(1).setInputFiles(file("frequency.csv", "code,label\r\nmonthly,Monthly\r\n,Once or twice\r\n"));
    await dialog.waitFor();
    check("column-option import: the dialog names the column", (await dialog.locator("h2").textContent()) === 'Import options for column "Sought any help?" from “frequency.csv”', await dialog.locator("h2").textContent());
    await dialog.screenshot({ path: `${OUT}/grid-4-import-preview-column-options.png` });
    await apply().click();
    model[1].options = [...model[1].options, ["monthly", "Monthly"], ["once_or_twice", "Once or twice"]];
    await expectColumns("Add from a file into column 2's options");
    await columnFile(1).setInputFiles(file("frequency.txt", "Never\nSometimes\n"));
    await dialog.waitFor();
    await dialog.getByLabel(/^Replace all /).check();
    await apply().click();
    model[1].options = [["never", "Never"], ["sometimes", "Sometimes"]];
    await expectColumns("Replace all of column 2's options from a file");
    await aside.locator('input[type="file"]').first().setInputFiles(file("rows.txt", "Alcohol\nCannabis\nTobacco\n"));
    await dialog.waitFor();
    check("row import: the dialog is about rows", (await dialog.locator("h2").textContent()) === "Import rows from “rows.txt”");
    await dialog.getByLabel(/^Replace all /).check();
    await apply().click();
    check("rows replaced from a file", JSON.stringify(await aside.locator('input[id^="rows-"][id$="-code"]').evaluateAll((e) => e.map((x) => x.value))) === '["alcohol","cannabis","tobacco"]');
    await expectColumns("replacing the rows from a file");
    check("columns aren't importable: one file input per list (rows + each choice column)",
      (await aside.locator('input[type="file"]').count()) === 1 + model.filter((c) => c.options).length);

    // ---------- save: what is stored ----------
    await saveBtn.click();
    await P.getByText("All changes saved").waitFor({ timeout: 15000 });
    const savedGrid = (await stored(formId)).blocks.find((b) => b.type === "grid");
    const toStored = (c) => ({ code: c.code, label: c.label, type: c.type, ...(c.options ? { options: c.options.map(([code, label]) => ({ code, label })) } : {}), ...(c.required ? { required: true } : {}) });
    // Postgres jsonb reorders keys, so stored content is compared with keys sorted.
    const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
    // The placeholders' empty codes are filled at save, from their labels.
    model = model.map((c) => ({ ...c, options: c.options?.map(([code, label]) => [code || label.toLowerCase().replace(/\s+/g, "_"), label]) ?? null }));
    const expectedStored = model.map(toStored);
    check("saved: every column exactly as edited, codes filled at save", JSON.stringify(sorted(savedGrid.columns)) === JSON.stringify(sorted(expectedStored)),
      `\n      stored   ${JSON.stringify(savedGrid.columns)}\n      expected ${JSON.stringify(expectedStored)}`);
    check("saved: no grid-level required", !("required" in savedGrid) && !("completeRequired" in savedGrid));
    await expectColumns("saving (the editor adopts the stored codes)");

    // ---------- the code note: once for the whole grid ----------
    const notes = () => aside.getByText(NOTE, { exact: true }).count();
    check("the code note is shown once for the whole grid", (await notes()) === 1, String(await notes()));
    const describedBy = (id) => P.locator(`#${id}`).getAttribute("aria-describedby");
    check("rows, columns and every column's options point at that one note",
      (await describedBy("rows-0-code")) === "grid-code-note" && (await describedBy("grid-columns-0-code")) === "grid-code-note"
      && (await describedBy("grid-col-0-options-0-code")) === "grid-code-note" && (await describedBy("grid-col-3-options-2-code")) === "grid-code-note");
    await P.locator("[data-block-id]").filter({ hasText: "Matrix question" }).first().locator("span.truncate").first().click();
    check("other blocks unchanged: a matrix still shows the note under each of its two lists", (await notes()) === 2 && (await describedBy("columns-0-code")) === "columns-note");
    await gridCard.locator("span.truncate").first().click();

    // ---------- rows: labels, codes, add, remove, import Add ----------
    const rowCodes = () => aside.locator('input[id^="rows-"][id$="-code"]').evaluateAll((e) => e.map((x) => x.value));
    const rowLabels = () => aside.locator('input[id^="rows-"][id$="-label"]').evaluateAll((e) => e.map((x) => x.value));
    await P.locator("#rows-2-label").fill("Tobacco or nicotine");
    await P.locator("#rows-2-label").press("Tab");
    check("editing a row's label keeps its code", JSON.stringify(await rowCodes()) === '["alcohol","cannabis","tobacco"]');
    await aside.getByRole("button", { name: "Add row", exact: true }).click();
    check("Add row: 'Row 4' with an empty code", (await P.locator("#rows-3-label").inputValue()) === "Row 4" && (await P.locator("#rows-3-code").inputValue()) === "");
    await P.locator("#rows-3-label").fill("Other drugs");
    await P.locator("#rows-3-label").press("Tab");
    check("leaving an edited row label generates its code", (await P.locator("#rows-3-code").inputValue()) === "other_drugs");
    await P.locator("#rows-3-code").fill("OTH-1");
    await P.locator("#rows-3-code").press("Tab");
    check("a row's code can be edited", (await P.locator("#rows-3-code").inputValue()) === "OTH-1");
    await aside.locator('input[type="file"]').first().setInputFiles(file("more-rows.csv", "code,label\nOPI,Opioids\n,Other!\n"));
    await dialog.waitFor();
    await apply().click();
    check("row import Add: appended, codes as given or generated", JSON.stringify(await rowCodes()) === '["alcohol","cannabis","tobacco","OTH-1","OPI","other"]', JSON.stringify(await rowCodes()));
    await aside.getByRole("button", { name: "Remove row 6", exact: true }).click();
    check("Remove row", JSON.stringify(await rowLabels()) === '["Alcohol","Cannabis","Tobacco or nicotine","Other drugs","Opioids"]');
    await expectColumns("editing rows");
    await saveBtn.click();
    await P.getByText("All changes saved").waitFor({ timeout: 15000 });
    const ROWS = [["alcohol", "Alcohol"], ["cannabis", "Cannabis"], ["tobacco", "Tobacco or nicotine"], ["OTH-1", "Other drugs"], ["OPI", "Opioids"]];
    check("rows saved as edited", JSON.stringify((await stored(formId)).blocks.find((b) => b.type === "grid").rows) === JSON.stringify(ROWS.map(([code, label]) => ({ code, label }))));

    // ---------- every save rejection the editor can produce ----------
    // Each starts from the saved grid: the inline message is the save rule's own text, Save
    // shows the API's 400 with the same text, and Cancel (confirmed) puts the grid back.
    // Columns: How often (radio), Sought any help? (dropdown), Used in the last 30 days? (radio,
    // required), Age at first use (dropdown, required). The rejections only the API can meet
    // (an unknown column type, a grid as a source) are in verify-grid-api.js.
    const press = async (sel, value) => { await P.locator(sel).fill(value); await P.locator(sel).press("Tab"); };
    const removeAll = async (name, n) => { for (let k = 0; k < n; k++) await aside.getByRole("button", { name, exact: true }).click(); };
    const CHARS = 'can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.';
    const rejections = [
      ["no rows", () => removeAll("Remove row 1", 5), "it needs at least one row."],
      ["no columns", () => removeAll("Remove column 1", 4), "it needs at least one column."],
      ["a radio column without options", () => removeAll("Remove option 1, column 1", 3), 'column "How often" needs at least one option.'],
      ["a dropdown column without options", () => removeAll("Remove option 1, column 2", 2), 'column "Sought any help?" needs at least one option.'],
      ["a row without a label", () => press("#rows-1-label", ""), 'row 2 (code "cannabis") needs a label.'],
      ["a row code with bad characters", () => press("#rows-0-code", "al cohol"), `the code "al cohol" of row "Alcohol" ${CHARS}`],
      ["two rows with one code", () => press("#rows-1-code", "ALCOHOL"), 'the code "ALCOHOL" is used by more than one row ("Alcohol" and "Cannabis"). Codes must be unique, ignoring case.'],
      ["two rows with one label", () => press("#rows-2-label", " alcohol "), 'the label "alcohol" is used by more than one row. Labels must be unique, ignoring case.'],
      ["a column without a label", () => press("#grid-columns-1-label", ""), 'column 2 (code "sought_any_help") needs a label.'],
      ["a column code with bad characters", () => press("#grid-columns-0-code", "how often"), `the code "how often" of column "How often" ${CHARS}`],
      ["two columns with one code", () => press("#grid-columns-1-code", "Frequency"), 'the code "Frequency" is used by more than one column ("How often" and "Sought any help?"). Codes must be unique, ignoring case.'],
      ["two columns with one label", () => press("#grid-columns-3-label", "how often"), 'the label "how often" is used by more than one column. Labels must be unique, ignoring case.'],
      ["a column option without a label", () => press("#grid-col-2-options-1-label", ""), 'in column "Used in the last 30 days?", option 2 (code "no") needs a label.'],
      ["a column option code with bad characters", () => press("#grid-col-0-options-0-code", "dai ly"), `in column "How often", the code "dai ly" of option "Daily" ${CHARS}`],
      ["two column options with one code", () => press("#grid-col-1-options-1-code", "NEVER"), 'in column "Sought any help?", the code "NEVER" is used by more than one option ("Never" and "Sometimes"). Codes must be unique, ignoring case.'],
      ["two column options with one label", () => press("#grid-col-3-options-2-label", "option 1"), 'in column "Age at first use", the label "option 1" is used by more than one option. Labels must be unique, ignoring case.'],
    ];
    const versionsBefore = await prisma.formVersion.count({ where: { formId } });
    for (const [name, edit, rule] of rejections) {
      await edit();
      const detail = rule.charAt(0).toUpperCase() + rule.slice(1);
      const inline = await aside.getByText(detail, { exact: true }).count();
      await saveBtn.click();
      const refusal = P.getByText(`Couldn't save: Block "Substance use": ${rule}`, { exact: true });
      await refusal.waitFor({ timeout: 10000 }).catch(() => {});
      check(`refused: ${name} — shown inline, and the API's 400 has the same text`, inline === 1 && (await refusal.count()) === 1,
        `inline ${inline}; banner: ${await P.getByRole("alert").filter({ hasText: "Couldn't save" }).allTextContents()}`);
      await P.locator("header").getByRole("button", { name: "Cancel", exact: true }).click();
      await P.getByRole("alertdialog", { name: "Discard unsaved changes?" }).getByRole("button", { name: "Discard changes" }).click();
      await P.getByText("All changes saved").waitFor({ timeout: 10000 });
    }
    check("no version stored for any refused save", (await prisma.formVersion.count({ where: { formId } })) === versionsBefore);
    await expectColumns("cancelling every refused edit");

    // ---------- not a condition source; a condition of its own ----------
    await insertBySearch("Multiple choice");
    await P.locator("#block-label").fill("Uses substances?");
    await insertBySearch("Short answer");
    await aside.getByRole("button", { name: "Add condition" }).click();
    const sources = await aside.getByLabel("Condition 1 question", { exact: true }).locator("option").allTextContents();
    check("the source picker lists the earlier choice question but not the grid", sources.some((x) => x.includes("Uses substances?")) && !sources.some((x) => x.includes("Substance use")), JSON.stringify(sources));
    // The grid's own condition: on a question that now comes after it, so move the grid down first.
    const gridId = await gridCard.getAttribute("data-block-id");
    await gridCard.locator("span.truncate").first().click();
    for (let k = 0; k < 2; k++) await gridCard.getByRole("button", { name: "Move down" }).evaluate((b) => b.click());
    await aside.getByRole("button", { name: "Add condition" }).click();
    const gridSource = await aside.getByLabel("Condition 1 question", { exact: true }).inputValue();
    check("a grid can carry its own condition", gridSource.length > 0);
    await saveBtn.click();
    await P.getByText("All changes saved").waitFor({ timeout: 15000 });
    const conditional = (await stored(formId)).blocks.find((b) => b.id === gridId);
    check("a grid with its own condition saves", JSON.stringify(sorted(noIds(conditional?.enableWhen))) === JSON.stringify(sorted([{ question: gridSource, operator: "exists" }])) && hasIds(conditional?.enableWhen), JSON.stringify(conditional?.enableWhen));

    // ---------- inside a repeating group ----------
    await insertBySearch("group");
    await P.locator("#block-label").fill("Medication history");
    await aside.getByRole("switch", { name: "Repeats" }).click();
    await P.getByTitle("Insert a block").click(); // the group is selected, so the grid goes inside it
    await P.getByPlaceholder("Search blocks…").fill("grid");
    await P.keyboard.press("Enter");
    await P.locator("#block-label").fill("Doses");
    const innerDepth = await P.locator("[data-block-id]").filter({ has: P.locator("span.truncate", { hasText: /^Doses$/ }) }).getAttribute("data-depth");
    check("a grid inserted into the selected repeating group sits inside it", innerDepth === "1", innerDepth);
    await saveBtn.click();
    await P.getByText("All changes saved").waitFor({ timeout: 15000 });
    const repeat = (await stored(formId)).blocks.find((b) => b.type === "group");
    check("a grid inside a repeating group saves, codes filled", repeat?.repeats === true && repeat.blocks[0]?.type === "grid"
      && JSON.stringify(sorted(repeat.blocks[0].columns)) === JSON.stringify(sorted([{ code: "column_1", label: "Column 1", type: "text" }])), JSON.stringify(repeat));

    // ---------- Download: the exact §14.1 shape ----------
    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    const art = JSON.parse(raw);
    const column = (c) => ({ code: c.code, label: c.label, type: c.type, ...(c.options ? { options: c.options.map(([code, label]) => ({ code, label })) } : {}), ...(c.required ? { required: true } : {}) });
    const expectedGrid = { id: gridId, type: "grid", label: "Substance use", enableWhen: [{ question: gridSource, operator: "exists" }],
      rows: ROWS.map(([code, label]) => ({ code, label })), columns: model.map(column) };
    const artGrid = art.blocks.find((b) => b.id === gridId);
    check("download: the grid is exactly the §14.1 shape, key order included", JSON.stringify({ ...artGrid, enableWhen: noIds(artGrid?.enableWhen) }) === JSON.stringify(expectedGrid) && hasIds(artGrid?.enableWhen),
      `\n      got      ${JSON.stringify(artGrid)}\n      expected ${JSON.stringify(expectedGrid)}`);
    const artInner = art.blocks.find((b) => b.type === "group").blocks[0];
    check("download: the grid in the repeating group, exactly", JSON.stringify(artInner) === JSON.stringify({ id: artInner.id, type: "grid", label: "Doses",
      rows: [{ code: "row_1", label: "Row 1" }, { code: "row_2", label: "Row 2" }, { code: "row_3", label: "Row 3" }], columns: [{ code: "column_1", label: "Column 1", type: "text" }] }), JSON.stringify(artInner));
    check("download: no block-level required on a grid; schemaVersion 2", art.blocks.flatMap((b) => [b, ...(b.blocks ?? [])]).filter((b) => b.type === "grid").every((b) => !("required" in b) && !("completeRequired" in b)) && art.schemaVersion === 2);
    saveArtifact(ARTIFACT, raw);

    // ---------- render with @zoworkhq/zoforms (optional) ----------
    if (!EXTERNAL_APP) {
      console.log("  SKIP  render in the external test app (set E2E_EXTERNAL_APP_URL and E2E_EXTERNAL_FORMS_DIR to run it)");
    } else if (!process.env.E2E_EXTERNAL_FORMS_DIR || !fs.existsSync(path.join(process.env.E2E_EXTERNAL_FORMS_DIR, ARTIFACT))) {
      check("render: E2E_EXTERNAL_FORMS_DIR is set, so the app has this run's artifact", false, "set E2E_EXTERNAL_FORMS_DIR to the test app's src/forms");
    } else {
      // The layout checks read the renderer's zf- class names and container name.
      const version = rendererVersion();
      check(`render: the test app has @zoworkhq/zoforms ${ZF_RENDERER} or later (zf- names)`, atLeast(version, ZF_RENDERER), version);
      await sleep(1500); // let the app's dev server see the new file
      // Opens the download in the test app, in a panel `width` pixels wide (the app's ?width=) or
      // at its default width, and shows the grid: it appears once the question its condition uses
      // is answered, which itself shows after the choice. Returns the grid's own box and layout.
      const showGrid = async (page, width) => {
        await page.goto(`${EXTERNAL_APP}${EXTERNAL_APP.includes("?") ? "&" : "?"}form=builder-grid${width ? `&width=${width}` : ""}`);
        await page.getByRole("group", { name: "Uses substances?", exact: true }).getByRole("radio", { name: "Option 1" }).check({ timeout: 15000 });
        await page.getByLabel("Short answer", { exact: true }).fill("Yes, several");
        const region = page.getByRole("region", { name: "Substance use" });
        await region.waitFor({ timeout: 15000 });
        return region.evaluate((box) => {
          const t = box.querySelector("table");
          const css = (e) => getComputedStyle(e);
          const labels = [...t.querySelectorAll("tbody .zf-grid-cell-label")];
          return {
            region: { className: box.className, tabIndex: box.tabIndex, container: `${css(box).containerName} / ${css(box).containerType}`, tableInside: t.parentElement === box },
            width: box.clientWidth, breakpoint: 34 * parseFloat(css(document.documentElement).fontSize), viewport: innerWidth,
            table: css(t).display, headShown: t.tHead.getBoundingClientRect().height > 1,
            rows: [...t.tBodies[0].rows].map((r) => (r.classList.contains("zf-grid-card") ? "" : "no card class; ") + css(r).display),
            cellLabelsShown: labels.length > 0 && labels.every((l) => css(l).display !== "none" && l.getBoundingClientRect().height > 0),
            scrolls: box.scrollWidth > box.clientWidth,
          };
        });
      };
      const R = await ctx.newPage();
      R.on("pageerror", (e) => check("render: no page errors", false, e.message));
      const wide = await showGrid(R);
      const table = R.getByRole("table", { name: "Substance use" });
      check("render: the grid renders with its column and row headers",
        JSON.stringify(await table.getByRole("columnheader").allTextContents()) === JSON.stringify(model.map((c) => c.label))
        && JSON.stringify(await table.getByRole("rowheader").allTextContents()) === JSON.stringify(ROWS.map(([, l]) => l)),
        JSON.stringify([await table.getByRole("columnheader").allTextContents(), await table.getByRole("rowheader").allTextContents()]));
      // Contract §14.5: the table sits in its own box, a keyboard-scrollable region named by the grid's
      // label, and the layout follows that box's width (a container query), never the viewport's.
      check("render: the table is in its own region, named by the grid's label, focusable, a size container",
        wide.region.className === "zf-grid-scroll" && wide.region.tabIndex === 0 && wide.region.container === "zf-grid / inline-size" && wide.region.tableInside, JSON.stringify(wide.region));
      const isTable = (m) => m.table === "table" && m.headShown && m.rows.every((r) => r === "table-row") && !m.cellLabelsShown;
      const isCards = (m) => m.table === "block" && !m.headShown && m.rows.every((r) => r === "block") && m.cellLabelsShown && !m.scrolls;
      check("render: at the app's default width the grid is a table; too wide for its box, it scrolls inside it",
        wide.width >= wide.breakpoint && isTable(wide) && wide.scrolls && (await R.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), JSON.stringify(wide));
      // Either side of the 34rem breakpoint, in a panel narrower than the (unchanged) viewport.
      const N = await ctx.newPage();
      N.on("pageerror", (e) => check("render: no page errors", false, e.message));
      const above = await showGrid(N, 640);
      check("render: a box just wider than 34rem shows the table", above.width >= above.breakpoint && above.viewport === wide.viewport && isTable(above), JSON.stringify(above));
      const below = await showGrid(N, 600);
      check("render: a box just narrower than 34rem shows each row as a card, each answer labelled with its column", below.width < below.breakpoint && below.viewport === wide.viewport && isCards(below), JSON.stringify(below));
      const cards = N.getByRole("table", { name: "Substance use" });
      check("render: as cards, the row and column headers are still exposed",
        JSON.stringify(await cards.getByRole("rowheader").allTextContents()) === JSON.stringify(ROWS.map(([, l]) => l))
        && (await cards.getByRole("radiogroup", { name: "Alcohol, How often" }).count()) === 1,
        JSON.stringify(await cards.getByRole("rowheader").allTextContents()));
      await N.screenshot({ path: `${OUT}/grid-7-render-cards.png`, fullPage: true });
      await N.close();
      await R.getByRole("radiogroup", { name: "Alcohol, How often" }).getByRole("radio", { name: "Daily" }).check();
      await R.getByRole("button", { name: "Submit", exact: true }).click();
      const n = ROWS.length;
      const blocked = [`"Substance use": answer "Used in the last 30 days?" in every row (${n} missing).`, `"Substance use": answer "Age at first use" in every row (${n} missing).`];
      await R.getByText(blocked[0]).first().waitFor({ timeout: 10000 }).catch(() => {});
      check("render: required columns block submit, one summary entry per column", (await R.getByText(blocked[0]).count()) >= 1 && (await R.getByText(blocked[1]).count()) >= 1,
        (await R.locator("body").innerText()).slice(0, 800));
      await R.screenshot({ path: `${OUT}/grid-6-render-required.png`, fullPage: true });
      for (const [, row] of ROWS) {
        await R.getByRole("radiogroup", { name: `${row}, Used in the last 30 days?` }).getByRole("radio", { name: "Yes" }).check();
        await R.getByLabel(`${row}, Age at first use`, { exact: true }).selectOption({ label: "Option 2" });
      }
      const [res] = await Promise.all([
        R.waitForResponse((x) => /\/api\/submit$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 15000 }),
        R.getByRole("button", { name: "Submit", exact: true }).click(),
      ]);
      check("render: a filled grid submits (201)", res.status() === 201, String(res.status()));
      const sent = JSON.parse(res.request().postData()).answers[gridId];
      check("payload: codes only, row code → column code → cell", sent?.state === "answered" && sent.value.alcohol.frequency === "daily"
        && ROWS.every(([code]) => sent.value[code].last_30 === "yes" && sent.value[code].age_at_first_use === "option_2"), JSON.stringify(sent));
      const all = await (await fetch(new URL("api/submissions", EXTERNAL_APP.endsWith("/") ? EXTERNAL_APP : EXTERNAL_APP + "/"))).json();
      const record = all.filter((x) => x.formId === art.formId).pop();
      const value = record?.answers?.[gridId]?.value;
      check("stored: answered rows in row order, each cell { column, value } with labels (§14.2)", Array.isArray(value) && value.length === n
        && JSON.stringify(value[0]) === JSON.stringify({ row: { code: "alcohol", label: "Alcohol" }, cells: [
          { column: { code: "frequency", label: "How often" }, value: { code: "daily", label: "Daily" } },
          { column: { code: "last_30", label: "Used in the last 30 days?" }, value: { code: "yes", label: "Yes" } },
          { column: { code: "age_at_first_use", label: "Age at first use" }, value: { code: "option_2", label: "Option 2" } }] }), JSON.stringify(value));
      fs.writeFileSync(path.join(OUT, "grid-stored-record.json"), JSON.stringify(record, null, 2));
      await R.close();
    }

    // ================= labels are plain text =================
    const xssId = await create("Labels as text");
    const r = await put(xssId, { title: "Labels as text", blocks: [{ id: "g", type: "grid", label: HTML, rows: opts("Row"), columns: [
      { code: "c", label: HTML, type: "radio", options: [{ code: "o", label: HTML }] }] }] });
    check("a grid with HTML labels saves", r.status === 200);
    await P.goto(`${WEB}/app/forms/${xssId}/edit`);
    await P.getByText("All changes saved").waitFor({ timeout: 60000 });
    const xCard = P.locator('[data-block-id="g"]');
    await xCard.locator("span.truncate").first().click();
    check("canvas: the grid label shows as literal text", (await xCard.locator("span.truncate").first().textContent()) === HTML);
    check("canvas: column header and option label show as literal text", (await xCard.locator('th[scope="col"]').textContent()) === HTML && (await xCard.locator("tbody td").first().textContent()) === HTML);
    check("inspector: label, column label and option label are literal field values",
      (await P.locator("#block-label").inputValue()) === HTML && (await colLabel(0).inputValue()) === HTML && (await optLabel(0, 0).inputValue()) === HTML);
    await columnFile(0).setInputFiles(file("html.txt", `${HTML}\n`));
    await dialog.waitFor();
    check("import preview: an HTML label and the column's HTML name show as literal text",
      (await dialog.locator("tbody td").nth(2).textContent()) === HTML && (await dialog.locator("h2").textContent()).includes(HTML));
    await dialog.getByRole("button", { name: "Cancel" }).click();
    check("no element was created from a label", (await P.locator('img[src="x"]').count()) === 0);

    // ================= a wide grid scrolls inside its card =================
    const wideId = await create("Wide grid");
    const columns = Array.from({ length: 12 }, (_, k) => ({ code: `c${k}`, label: `A rather long column heading ${k + 1}`, type: ["text", "dropdown", "radio"][k % 3],
      ...(k % 3 ? { options: opts("Yes", "No") } : {}), ...(k % 4 === 0 ? { required: true } : {}) }));
    await put(wideId, { title: "Wide grid", blocks: [{ id: "w", type: "grid", label: "Wide grid", rows: opts("First row", "Second row"), columns }] });
    await P.setViewportSize({ width: 1280, height: 900 });
    await P.goto(`${WEB}/app/forms/${wideId}/edit`);
    await P.getByText("All changes saved").waitFor({ timeout: 60000 });
    const wCard = P.locator('[data-block-id="w"]');
    const wPreview = wCard.locator("[data-grid-preview]");
    const sizes = await wPreview.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, overflowX: getComputedStyle(el).overflowX }));
    const fits = await wCard.evaluate((el) => ({
      card: Math.round(el.getBoundingClientRect().right),
      parent: Math.round(el.parentElement.getBoundingClientRect().right),
      inspector: Math.round(document.querySelector("aside").getBoundingClientRect().left),
      pageScroll: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check("wide grid: the table scrolls sideways inside the block", sizes.scroll > sizes.client && sizes.overflowX === "auto", JSON.stringify(sizes));
    check("wide grid: the card stays within the canvas (no page overflow)", fits.card <= fits.parent + 1 && fits.card <= fits.inspector && fits.pageScroll <= 0, JSON.stringify(fits));
    await wPreview.evaluate((el) => { el.scrollLeft = 520; });
    await wCard.screenshot({ path: `${OUT}/grid-5-wide-scrolled.png` });
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { for (const p of browser?.contexts()[0]?.pages() ?? []) await p.screenshot({ path: `${OUT}/grid-failure.png` }); } catch {}
  } finally {
    await browser?.close();
    const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (u) {
      for (const m of u.memberships) await prisma.organization.delete({ where: { id: m.orgId } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
  let ok = true;
  for (const [name, pass, detail] of results) {
    if (!pass) ok = false;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? "   [" + detail + "]" : ""}`);
  }
  console.log(`\n  ${results.filter((r) => r[1]).length}/${results.length} passed`);
  process.exit(ok ? 0 : 1);
})();
