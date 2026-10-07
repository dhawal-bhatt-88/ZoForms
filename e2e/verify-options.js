// Coded options and option import (contract §13): the save rules through the API, every
// coded type built in the editor (matrix rows and columns included), codes generated on
// leaving a label, a code change carrying its condition, the refused removal, imports
// (.csv with codes, .txt, a file with errors; Add, Replace, a refused Replace),
// "Answer every row" / "Rank every option", and the artifact. With E2E_EXTERNAL_APP_URL
// set, the download is rendered in the external test app, submitted, and the stored
// record checked for { code, label } values.
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact, opts } = require("./_setup");
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
const walk = function* (bs) { for (const b of bs) { yield b; if (b.blocks) yield* walk(b.blocks); } };
const o = (code, label) => ({ code, label });
const HTML = "<img src=x onerror=alert(1)>";
const EXTERNAL_APP = process.env.E2E_EXTERNAL_APP_URL;
const ARTIFACT = "builder-options-schema.json";
const file = (name, text) => ({ name, mimeType: name.endsWith(".csv") ? "text/csv" : "text/plain", buffer: Buffer.from(text, "utf8") });

(async () => {
  const email = `verify-options-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Options" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;
    const remove = (id) => fetch(`${API}/v1/forms/${id}`, { method: "DELETE", headers: H });

    // ================= API =================
    const apiId = await create("API checks");
    const q = (id, type, label, extra = {}) => ({ id, type, label, required: false, ...extra });
    const valid = () => ({
      title: "Options",
      blocks: [
        q("dx", "choice", "Diagnosis", { options: [{ label: " Not applicable " }, o("", "Sí"), o("F32.1", "Depression"), o(" ", HTML)] }),
        q("tags", "checkbox", "Tags", { options: [o("", "Other!"), o("other", "Other")] }),
        q("dd", "dropdown", "Dropdown", { options: [o("", "焦虑"), o("", "A")] }),
        q("ms", "multiselect", "Multi", { options: [o("", "Red")] }),
        q("rk", "ranking", "Rank", { options: [o("", "First"), o("", "Second")], completeRequired: true }),
        q("mx", "matrix", "Grid", { options: [o("", "Row A")], columns: [o("", "Col 1"), o("", "Col 2")], completeRequired: false }),
        q("follow", "short", "Follow-up", { enableWhen: [{ question: "dx", operator: "=", answer: "si" }] }),
      ],
    });
    let r = await put(apiId, valid());
    let body = await r.json();
    check("API: empty codes save (200); conditions are checked after the codes are filled", r.status === 200, JSON.stringify(body).slice(0, 300));
    check("API: the save response returns the stored content, codes generated",
      JSON.stringify(body.schema?.blocks?.[0]?.options) === JSON.stringify([o("not_applicable", "Not applicable"), o("si", "Sí"), o("F32.1", "Depression"), o("img_srcx_onerroralert1", HTML)]));
    const s0 = await stored(apiId);
    check("API: stored with generated codes; typed codes reserved first (other_2); option_{n}", JSON.stringify(s0.blocks[1].options) === JSON.stringify([o("other_2", "Other!"), o("other", "Other")])
      && s0.blocks[2].options[0].code === "option_1" && s0.blocks[5].columns.map((c) => c.code).join() === "col_1,col_2");
    check("API: completeRequired kept as true on a ranking, false dropped on a matrix", s0.blocks[4].completeRequired === true && !("completeRequired" in s0.blocks[5]));
    let art = await (await fetch(`${API}/v1/forms/${apiId}/artifact`, { headers: H })).json();
    check("API: an HTML label is stored and exported unchanged, as data", art.blocks[0].options[3].label === HTML);
    check("API: every exported option is exactly { code, label }", art.blocks.flatMap((b) => [...(b.options ?? []), ...(b.columns ?? [])]).every((x) => Object.keys(x).join() === "code,label"));
    r = await put(apiId, valid());
    check("API: the same content with empty codes is no change (409)", r.status === 409 && (await r.json()).code === "NO_CHANGES");
    const refusals = [
      ["plain-string options", (s) => { s.blocks[0].options = ["Yes", "No"]; }, 'Block "Diagnosis" (options.0): each option must be an object with a code and a label'],
      ["plain-string matrix rows, named as rows", (s) => { s.blocks[5].options = ["Row"]; }, 'Block "Grid" (rows.0): each option must be an object with a code and a label'],
      ["a missing list", (s) => { delete s.blocks[3].options; }, 'Block "Multi": it needs at least one option.'],
      ["a matrix without columns", (s) => { s.blocks[5].columns = []; }, 'Block "Grid": it needs at least one column.'],
      ["a blank label", (s) => { s.blocks[4].options[1] = o("second", "   "); }, 'Block "Rank": option 2 (code "second") needs a label.'],
      ["an invalid code", (s) => { s.blocks[1].options[1] = o("other one", "Other"); }, 'Block "Tags": the code "other one" of option "Other" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.'],
      ["duplicate codes, ignoring case", (s) => { s.blocks[0].options[1] = o("f32.1", "Sí"); s.blocks[6].enableWhen = []; }, 'Block "Diagnosis": the code "F32.1" is used by more than one option ("Sí" and "Depression"). Codes must be unique, ignoring case.'],
      ["duplicate labels, ignoring case and spaces", (s) => { s.blocks[3].options.push(o("x", " RED ")); }, 'Block "Multi": the label "RED" is used by more than one option. Labels must be unique, ignoring case.'],
      ["a condition answer that's a label", (s) => { s.blocks[6].enableWhen[0].answer = "Sí"; }, 'Block "Follow-up": the answer "Sí" isn\'t the code of any option of "Diagnosis".'],
      ["a numeric answer for a numeric code", (s) => { s.blocks[0].options[2] = o("44054006", "Diabetes"); s.blocks[6].enableWhen[0].answer = 44054006; }, 'Block "Follow-up": the answer 44054006 isn\'t the code of any option of "Diagnosis".'],
      ["an ordering operator on a coded source", (s) => { s.blocks[6].enableWhen[0] = { question: "dx", operator: ">", answer: 1 }; }, 'Block "Follow-up": the operator ">" can\'t be used with "Diagnosis" (a choice question). Allowed: exists, =, !=.'],
      ["= on a multiple-answer source", (s) => { s.blocks[6].enableWhen[0] = { question: "tags", operator: "=", answer: "other" }; }, 'Block "Follow-up": the operator "=" can\'t be used with "Tags" (a checkbox question). Allowed: exists, contains.'],
    ];
    const versionsBefore = await prisma.formVersion.count({ where: { formId: apiId } });
    for (const [name, mutate, expected] of refusals) {
      const s = valid(); mutate(s);
      const res = await put(apiId, s);
      const b = await res.json();
      check(`API refuses ${name} (400)`, res.status === 400 && b.message === expected, `${res.status} ${b.message}`);
    }
    check("API: no version stored for any refused save", (await prisma.formVersion.count({ where: { formId: apiId } })) === versionsBefore);
    await remove(apiId);

    // ================= editor =================
    await waitFor(WEB + "/login");
    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1400 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    P.on("dialog", (d) => { check("no dialogs (an alert would mean a label ran as HTML)", false, d.message()); d.dismiss(); });
    const aside = P.locator("aside");
    const cards = P.locator("[data-block-id]");
    const cardOf = (label) => cards.filter({ has: P.locator("span.truncate", { hasText: new RegExp(`^${label.replace(/[?()[\]]/g, "\\$&")}$`) }) }).first();
    const idOf = (label) => cardOf(label).getAttribute("data-block-id");
    const select = async (label) => { await cardOf(label).locator("span.truncate").first().click(); await P.locator("#block-label").waitFor(); };
    const add = async (name) => { await P.getByTitle("Insert a block").click(); await P.getByRole("button", { name, exact: true }).click(); };
    const rename = (label) => P.locator("#block-label").fill(label);
    const deselect = () => P.locator('input[placeholder="Add a description…"]').click();
    const label = (list, i) => P.locator(`#${list}-${i}-label`);
    const code = (list, i) => P.locator(`#${list}-${i}-code`);
    const codes = (list = "options") => aside.locator(`input[id^="${list}-"][id$="-code"]`).evaluateAll((els) => els.map((e) => e.value));
    const labels = (list = "options") => aside.locator(`input[id^="${list}-"][id$="-label"]`).evaluateAll((els) => els.map((e) => e.value));
    /** Type each label and leave the field, as an author does; removes placeholders beyond them. */
    const setLabels = async (list, ...values) => {
      for (let i = 0; i < values.length; i++) {
        if (!(await label(list, i).count())) await aside.getByRole("button", { name: list === "columns" ? "Add column" : /^Add (option|row)$/ }).click();
        await label(list, i).fill(values[i]);
        await label(list, i).press("Tab");
      }
      while (await label(list, values.length).count()) {
        await aside.getByRole("button", { name: new RegExp(`^Remove ${list === "columns" ? "column" : "(option|row)"} ${values.length + 1}$`) }).click();
      }
    };
    const status = (n = 0) => aside.locator('[role="status"]').nth(n).textContent();
    const banner = P.getByRole("alert").filter({ hasText: /^Can't/ });
    const dismiss = () => P.getByRole("button", { name: "Dismiss" }).click();
    const dialog = P.getByRole("dialog");
    const apply = () => dialog.getByRole("button", { name: /^(Add|Replace with) \d+$/ });
    const importFile = async (f, mode, which = 0) => {
      await aside.locator('input[type="file"]').nth(which).setInputFiles(f);
      await dialog.waitFor();
      if (mode === "replace") await dialog.getByLabel(/^Replace all /).check();
    };

    const formId = await create("Clinic intake");
    await P.goto(`${WEB}/app/forms/${formId}/edit`);
    await P.getByText("All changes saved").waitFor({ timeout: 60000 });

    // ---------- choice: codes generated on leaving each label ----------
    await add("Multiple choice"); await rename("Diagnosis");
    check("a new option list starts with empty codes", JSON.stringify(await codes()) === '["","",""]');
    await label("options", 0).fill("Depression");
    check("no code while still typing in the label", (await code("options", 0).inputValue()) === "");
    await label("options", 0).press("Tab");
    check("leaving the label fills the code", (await code("options", 0).inputValue()) === "depression");

    // Code first, then label (contract §13.8): the same in the DOM, on screen and in tab order.
    const focused = () => P.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("aria-label"));
    const order = async (list, i) => ({
      dom: await code(list, i).evaluate((c, id) => !!(c.compareDocumentPosition(document.getElementById(id)) & Node.DOCUMENT_POSITION_FOLLOWING), `${list}-${i}-label`),
      screen: (await code(list, i).boundingBox()).x < (await label(list, i).boundingBox()).x,
    });
    check("each option shows its code first, then its label", JSON.stringify(await order("options", 1)) === '{"dom":true,"screen":true}');
    check("the column headings read Code, then Label", JSON.stringify(await aside.locator("fieldset div[aria-hidden] span").allTextContents()) === '["Code","Label"]');
    check("the accessible names are unchanged", (await aside.getByLabel("Option 2 code").count()) === 1 && (await aside.getByLabel("Option 2 label").count()) === 1);
    // First the label (leaving it fills the code), then a walk that passes only filled codes.
    const boxes = async () => JSON.stringify(await Promise.all([code("options", 1).boundingBox(), label("options", 1).boundingBox(), label("options", 2).boundingBox()]));
    const layoutBefore = await boxes();
    await label("options", 1).fill("Anxiety");
    await P.keyboard.press("Tab");
    check("leaving the label fills the code without moving focus: Tab goes on to Remove", (await code("options", 1).inputValue()) === "anxiety" && (await focused()) === "Remove option 2");
    check("and without shifting the layout", (await boxes()) === layoutBefore);
    await code("options", 1).focus();
    const tabs = [];
    for (let k = 0; k < 3; k++) { await P.keyboard.press("Tab"); tabs.push(await focused()); }
    check("tab order follows the visual order: code, label, remove, then the next code",
      JSON.stringify(tabs) === JSON.stringify(["options-1-label", "Remove option 2", "options-2-code"]), JSON.stringify(tabs));
    await setLabels("options", "Depression", "Anxiety", "F32.1 Major depressive disorder");
    check("each code from its own label", JSON.stringify(await codes()) === '["depression","anxiety","f32.1_major_depressive_disorder"]', JSON.stringify(await codes()));

    // ---------- checkbox: a .txt import, Replace ----------
    await deselect(); await add("Checkboxes"); await rename("Symptoms");
    await importFile(file("symptoms.txt", "﻿Low mood\r\n\r\nPoor sleep\nSí\n"), "replace");
    check(".txt preview: one label per non-blank line, codes generated", (await dialog.locator("tbody tr").count()) === 3 && (await apply().textContent()) === "Replace with 3");
    await apply().click();
    check(".txt replaced the placeholders", JSON.stringify(await codes()) === '["low_mood","poor_sleep","si"]' && (await status()) === "Replaced the options with 3 from the file.");

    // ---------- dropdown: a .csv with codes, quoted values, then Add ----------
    await deselect(); await add("Dropdown"); await rename("Clinic");
    await importFile(file("clinics.csv", 'code,label\r\nLDN-01,"London, Central"\r\nMAN-02,Manchester\r\n,"The ""Old"" Surgery"\r\n'), "replace");
    const rows = await dialog.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].slice(1, 3).map((td) => td.textContent)));
    check(".csv preview: codes as given or generated; quoted commas and quotes kept", JSON.stringify(rows) === JSON.stringify([["LDN-01", "London, Central"], ["MAN-02", "Manchester"], ["the_old_surgery(generated)", 'The "Old" Surgery']]), JSON.stringify(rows));
    await apply().click();
    await importFile(file("more.csv", "BHM-03,Birmingham\n"), "add");
    await apply().click();
    check("Add appends in file order", JSON.stringify(await codes()) === '["LDN-01","MAN-02","the_old_surgery","BHM-03"]');
    await importFile(file("bad.csv", "x,One\nX,Two\nbad code,Three\ny,\nz,one\nLDN-01,Leeds\n"), "add");
    check("a file with errors: every flagged row marked, Apply disabled", (await dialog.locator("tbody tr[data-flagged]").count()) === 5 && (await apply().isDisabled())
      && (await dialog.getByText("5 rows are flagged. Fix the file, then choose it again.").count()) === 1);
    check("…including a code already in the list", (await dialog.getByText('The code "LDN-01" is already used by the option "London, Central".').count()) === 1);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await aside.locator('input[type="file"]').first().setInputFiles(file("broken.csv", 'a,"Unclosed\nb,B\n'));
    check("an unclosed quote refuses the file, naming the line", (await dialog.getByRole("alert").textContent()) === "Line 1: a quoted value is never closed. Check the quotes on that line.");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // ---------- multi-select: one renamed, one untouched, one HTML ----------
    await deselect(); await add("Multi-select"); await rename("Languages");
    await label("options", 0).fill("English"); await label("options", 0).press("Tab");
    await label("options", 2).fill(HTML); await label("options", 2).press("Tab");
    check("an untouched placeholder keeps an empty code until Save", JSON.stringify(await codes()) === '["english","","img_srcx_onerroralert1"]', JSON.stringify(await codes()));
    check("canvas: the HTML label is literal text, and no img element exists", (await cardOf("Languages").innerText()).includes(HTML) && (await P.locator('img[src="x"]').count()) === 0);

    // ---------- ranking and matrix: complete answers ----------
    await deselect(); await add("Ranking"); await rename("Priorities");
    await setLabels("options", "Cost", "Speed", "Quality");
    const requiredSwitch = aside.getByRole("switch", { name: "Required" });
    const rankAll = aside.getByRole("switch", { name: "Rank every option" });
    check("a ranking offers 'Rank every option'", (await rankAll.count()) === 1 && (await rankAll.getAttribute("aria-checked")) === "false");
    await rankAll.click();
    check("turning it on shows Required as on and locks it, saying why",
      (await requiredSwitch.getAttribute("aria-checked")) === "true" && (await requiredSwitch.isDisabled())
      && (await aside.getByText("Respondents must rank every option. This also makes the question required.").isVisible()));
    check("the canvas marks it required", (await cardOf("Priorities").locator("span.text-red", { hasText: "*" }).count()) === 1);
    await deselect(); await add("Matrix"); await rename("Sleep");
    check("Matrix is in the insert menu, with Rows and Columns", (await aside.getByText("Rows", { exact: true }).count()) === 1 && (await aside.getByText("Columns", { exact: true }).count()) === 1);
    await setLabels("options", "Weekdays", "Weekends");
    await setLabels("columns", "Never", "Sometimes", "Always");
    check("matrix rows and columns get codes from their labels; the same code in both lists would be fine",
      JSON.stringify([await codes("options"), await codes("columns")]) === JSON.stringify([["weekdays", "weekends"], ["never", "sometimes", "always"]]));
    check("matrix rows and columns show the code first too", JSON.stringify([await order("options", 0), await order("columns", 2)]) === '[{"dom":true,"screen":true},{"dom":true,"screen":true}]');
    await code("columns", 0).focus();
    const colTabs = [];
    for (let k = 0; k < 3; k++) { await P.keyboard.press("Tab"); colTabs.push(await focused()); }
    check("…and tab the same way", JSON.stringify(colTabs) === JSON.stringify(["columns-0-label", "Remove column 1", "columns-1-code"]), JSON.stringify(colTabs));
    await aside.getByRole("switch", { name: "Answer every row" }).click();
    check("a matrix offers 'Answer every row'", (await aside.getByRole("switch", { name: "Answer every row" }).getAttribute("aria-checked")) === "true");
    await deselect(); await add("Short answer"); await rename("Short");
    check("other types have neither setting", (await aside.getByRole("switch", { name: /every/ }).count()) === 0);
    await cardOf("Short").getByRole("button", { name: "Delete" }).click();

    // ---------- conditions: labels shown, codes stored ----------
    const ids = {};
    for (const [k, l] of [["dx", "Diagnosis"], ["sym", "Symptoms"], ["rank", "Priorities"], ["grid", "Sleep"]]) ids[k] = await idOf(l);
    await deselect(); await add("Short answer"); await rename("Follow-up");
    await aside.getByRole("button", { name: "Add condition" }).click();
    await aside.getByRole("combobox", { name: "Question" }).last().selectOption(ids.dx);
    check("a single-choice source offers is answered / is / is not", JSON.stringify(await aside.getByRole("combobox", { name: "Condition" }).last().locator("option").allTextContents()) === '["is answered","is","is not"]');
    await aside.getByRole("combobox", { name: "Condition" }).last().selectOption("=");
    await aside.getByRole("combobox", { name: "Answer" }).last().selectOption({ label: "Depression" });
    check("the answer picker lists labels", JSON.stringify(await aside.getByRole("combobox", { name: "Answer" }).last().locator("option").allTextContents()) === '["Depression","Anxiety","F32.1 Major depressive disorder"]');
    await deselect(); await add("Short answer"); await rename("Sleep note");
    await aside.getByRole("button", { name: "Add condition" }).click();
    await aside.getByRole("combobox", { name: "Question" }).last().selectOption(ids.sym);
    check("a multi-answer source offers is answered / includes", JSON.stringify(await aside.getByRole("combobox", { name: "Condition" }).last().locator("option").allTextContents()) === '["is answered","includes"]');
    await aside.getByRole("combobox", { name: "Condition" }).last().selectOption("contains");
    await aside.getByRole("combobox", { name: "Answer" }).last().selectOption({ label: "Poor sleep" });
    check("the picker can't offer a matrix as a source", !(await aside.getByRole("combobox", { name: "Question" }).last().locator("option").evaluateAll((os) => os.map((x) => x.value))).includes(ids.grid));

    // ---------- a code change carries its condition; removal refused ----------
    await select("Diagnosis");
    await code("options", 0).fill("F32.0");
    await code("options", 0).press("Enter");
    await sleep(100);
    check("changing a used code: the status says how many conditions followed", (await status()) === '1 condition updated to use "F32.0".', await status());
    check("the standing note sits under the code fields", await aside.getByText("Changing a code after the form is in use will not match answers already stored under the old code.").first().isVisible());
    // A cleared code that no condition uses stays empty: neither leaving it nor tabbing past
    // an unchanged label generates one (contract §13.3). Changing the label does.
    await code("options", 1).fill("");
    await P.keyboard.press("Tab");
    check("clearing an unused code and leaving it leaves it empty", (await code("options", 1).inputValue()) === "" && (await focused()) === "options-1-label");
    await P.keyboard.press("Tab");
    check("tabbing past the unchanged label generates nothing", (await code("options", 1).inputValue()) === "" && (await focused()) === "Remove option 2");
    await label("options", 1).fill("Anxiety disorder");
    await P.keyboard.press("Tab");
    check("changing the label and leaving generates the code", (await code("options", 1).inputValue()) === "anxiety_disorder");
    // A cleared code that a condition uses is regenerated from the current label at once,
    // and the condition follows, so a save can't be left pointing at a code that's gone.
    await code("options", 0).fill("");
    await P.keyboard.press("Tab");
    await sleep(100);
    check("clearing a used code and tabbing out regenerates it from the label, without moving focus",
      (await code("options", 0).inputValue()) === "depression" && (await focused()) === "options-0-label" && (await label("options", 0).inputValue()) === "Depression");
    check("…and the condition follows, with the status message", (await status()) === '1 condition updated to use "depression".', await status());
    await P.keyboard.press("Tab"); // past the untouched label
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await P.getByText("All changes saved").waitFor({ timeout: 15000 });
    const afterClear = await stored(formId);
    const dx = afterClear.blocks.find((b) => b.label === "Diagnosis");
    const fu = afterClear.blocks.find((b) => b.label === "Follow-up");
    check("Save succeeds, with the regenerated code and the condition on it",
      // Postgres reorders stored keys, so compare fields, not strings.
      dx.options[0].code === "depression" && fu.enableWhen.length === 1
      && fu.enableWhen[0].question === dx.id && fu.enableWhen[0].operator === "=" && fu.enableWhen[0].answer === "depression", JSON.stringify(fu.enableWhen));
    await select("Diagnosis");
    await code("options", 0).fill("F32.0");
    await code("options", 0).press("Enter");
    await code("options", 1).fill("anxiety");
    await code("options", 1).press("Enter");
    // A new option: tab through it without typing, come back, rename it, leave.
    await aside.getByRole("button", { name: "Add option" }).click();
    await code("options", 3).focus();
    await P.keyboard.press("Tab");
    check("a new option: Tab from its empty code reaches the label", (await focused()) === "options-3-label" && (await label("options", 3).inputValue()) === "Option 4");
    await P.keyboard.press("Tab");
    check("tabbing past the untouched placeholder generates nothing", (await code("options", 3).inputValue()) === "" && (await focused()) === "Remove option 4");
    await P.keyboard.press("Shift+Tab");
    check("Shift+Tab comes back to the label", (await focused()) === "options-3-label");
    await P.keyboard.press("Control+A");
    await P.keyboard.type("Daily");
    await P.keyboard.press("Tab");
    check("renaming it to Daily and leaving gives the code daily", (await code("options", 3).inputValue()) === "daily", await code("options", 3).inputValue());
    await aside.getByRole("button", { name: "Remove option 4" }).click();
    await aside.getByRole("button", { name: "Remove option 1" }).click();
    check("removing an option a condition uses is refused, with a jump link", (await banner.innerText()).startsWith('Can\'t remove "Depression" — these blocks have conditions that use it:') && (await banner.getByRole("button", { name: "Follow-up →" }).count()) === 1);
    await banner.getByRole("button", { name: "Follow-up →" }).click();
    check("the jump link selects the dependent", (await P.locator("#block-label").inputValue()) === "Follow-up");
    await dismiss();
    await select("Diagnosis");
    await importFile(file("replace.csv", "anx,Anxiety\nnew,Something new\n"), "replace");
    await apply().click();
    check("Replace is refused while a condition uses a code that isn't in the file", (await banner.innerText()).startsWith("Can't replace the options — these blocks have conditions that use a code that isn't in the file:")
      && (await banner.getByRole("button", { name: "Follow-up →" }).count()) === 1 && (await labels()).length === 3);
    await dismiss();
    await importFile(file("replace.csv", "F32.0,Depression\nanxiety,Anxiety\nF32.1,Major depressive disorder\nF41.1,Generalised anxiety\n"), "replace");
    await apply().click();
    check("Replace with the used code in the file is allowed", JSON.stringify(await codes()) === '["F32.0","anxiety","F32.1","F41.1"]' && (await banner.count()) === 0);
    await select("Follow-up");
    check("the condition still shows its label", (await aside.getByRole("combobox", { name: "Answer" }).last().locator("option:checked").textContent()) === "Depression");

    // ---------- save, adopt, download ----------
    await deselect();
    await P.screenshot({ path: `${OUT}/options-1-canvas.png` });
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await P.getByText("All changes saved").waitFor({ timeout: 15000 });
    await select("Languages");
    check("after Save the editor shows the code the save generated", (await code("options", 1).inputValue()) === "option_2");
    await P.screenshot({ path: `${OUT}/options-2-inspector.png` });
    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    art = JSON.parse(raw);
    const byLabel = (l) => [...walk(art.blocks)].find((b) => b.label === l);
    check("artifact: choice", JSON.stringify(byLabel("Diagnosis").options) === JSON.stringify([o("F32.0", "Depression"), o("anxiety", "Anxiety"), o("F32.1", "Major depressive disorder"), o("F41.1", "Generalised anxiety")]));
    check("artifact: checkbox", JSON.stringify(byLabel("Symptoms").options) === JSON.stringify(opts("Low mood", "Poor sleep").concat([o("si", "Sí")])));
    check("artifact: dropdown", JSON.stringify(byLabel("Clinic").options.map((x) => x.code)) === '["LDN-01","MAN-02","the_old_surgery","BHM-03"]' && byLabel("Clinic").options[2].label === 'The "Old" Surgery');
    check("artifact: multiselect, the placeholder filled at save, the HTML label as data", JSON.stringify(byLabel("Languages").options) === JSON.stringify([o("english", "English"), o("option_2", "Option 2"), o("img_srcx_onerroralert1", HTML)]));
    check("artifact: ranking with completeRequired", JSON.stringify(byLabel("Priorities").options) === JSON.stringify(opts("Cost", "Speed", "Quality")) && byLabel("Priorities").completeRequired === true && byLabel("Priorities").required === false);
    check("artifact: matrix rows, columns and completeRequired", JSON.stringify([byLabel("Sleep").options, byLabel("Sleep").columns]) === JSON.stringify([opts("Weekdays", "Weekends"), opts("Never", "Sometimes", "Always")]) && byLabel("Sleep").completeRequired === true);
    check("artifact: condition answers are codes", JSON.stringify(byLabel("Follow-up").enableWhen) === JSON.stringify([{ question: ids.dx, operator: "=", answer: "F32.0" }])
      && JSON.stringify(byLabel("Sleep note").enableWhen) === JSON.stringify([{ question: ids.sym, operator: "contains", answer: "poor_sleep" }]));
    check("artifact: no completeRequired on other types, schemaVersion still 2", [...walk(art.blocks)].filter((b) => !["ranking", "matrix"].includes(b.type)).every((b) => !("completeRequired" in b)) && art.schemaVersion === 2);
    saveArtifact(ARTIFACT, raw);
    await remove(formId);

    // ================= render (optional) =================
    if (!EXTERNAL_APP) {
      console.log("  SKIP  render in the external test app (set E2E_EXTERNAL_APP_URL and E2E_EXTERNAL_FORMS_DIR to run it)");
    } else if (!process.env.E2E_EXTERNAL_FORMS_DIR || !fs.existsSync(path.join(process.env.E2E_EXTERNAL_FORMS_DIR, ARTIFACT))) {
      check("render: E2E_EXTERNAL_FORMS_DIR is set, so the app has this run's artifact", false, "set E2E_EXTERNAL_FORMS_DIR to the test app's src/forms");
    } else {
      await sleep(1500); // let the app's dev server see the new file
      const R = await ctx.newPage();
      R.on("pageerror", (e) => check("render: no page errors", false, e.message));
      await R.goto(`${EXTERNAL_APP}${EXTERNAL_APP.includes("?") ? "&" : "?"}form=builder-options`);
      const group = (name) => R.getByRole("group", { name, exact: true });
      await group("Diagnosis").waitFor({ timeout: 15000 });
      check("render: labels as text, codes as values", (await group("Diagnosis").getByRole("radio", { name: "Depression" }).getAttribute("value")) === "F32.0");
      check("render: the HTML label is literal text; no img element", (await group("Languages").innerText()).includes(HTML) && (await R.locator('img[src="x"]').count()) === 0);
      await group("Diagnosis").getByRole("radio", { name: "Depression" }).check();
      await R.getByLabel("Follow-up").fill("Seen by GP");
      await group("Symptoms").getByRole("checkbox", { name: "Poor sleep" }).check();
      await group("Symptoms").getByRole("checkbox", { name: "Sí" }).check();
      await R.getByLabel("Sleep note").fill("Wakes at 4am");
      await R.getByLabel("Clinic").selectOption({ label: "London, Central" });
      await group("Languages").getByRole("checkbox", { name: "English" }).check();
      for (const name of ["Quality", "Cost"]) await group("Priorities").getByRole("button", { name }).click();
      await R.getByRole("radiogroup", { name: "Weekdays" }).getByRole("radio", { name: "Sometimes" }).check();
      await R.getByRole("button", { name: "Submit", exact: true }).click();
      check("render: incomplete ranking and matrix are refused, with the renderer's messages",
        (await R.getByText('Rank every option in "Priorities".').first().isVisible()) && (await R.getByText('Answer every row of "Sleep".').first().isVisible()));
      await group("Priorities").getByRole("button", { name: "Speed" }).click();
      await R.getByRole("radiogroup", { name: "Weekends" }).getByRole("radio", { name: "Never" }).check();
      const [res] = await Promise.all([
        R.waitForResponse((x) => /\/api\/submit$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 15000 }),
        R.getByRole("button", { name: "Submit", exact: true }).click(),
      ]);
      check("render: the submit is stored (201)", res.status() === 201, String(res.status()));
      const sent = JSON.parse(res.request().postData()).answers;
      check("payload: the browser sends codes only", JSON.stringify(sent[ids.dx]) === '{"state":"answered","value":"F32.0"}' && JSON.stringify(sent[ids.sym].value) === '["poor_sleep","si"]');
      const all = await (await fetch(new URL("api/submissions", EXTERNAL_APP.endsWith("/") ? EXTERNAL_APP : EXTERNAL_APP + "/"))).json();
      const record = all.filter((s) => s.formId === art.formId).pop();
      const v = (id) => record?.answers?.[id]?.value;
      check("stored: a single choice as { code, label }", JSON.stringify(v(ids.dx)) === JSON.stringify(o("F32.0", "Depression")), JSON.stringify(v(ids.dx)));
      check("stored: checkboxes as [{ code, label }], in the submitted order", JSON.stringify(v(ids.sym)) === JSON.stringify([o("poor_sleep", "Poor sleep"), o("si", "Sí")]));
      check("stored: the ranking in rank order", JSON.stringify(v(ids.rank)) === JSON.stringify([o("quality", "Quality"), o("cost", "Cost"), o("speed", "Speed")]));
      check("stored: the matrix as row/column pairs, in row order", JSON.stringify(v(ids.grid)) === JSON.stringify([{ row: o("weekdays", "Weekdays"), column: o("sometimes", "Sometimes") }, { row: o("weekends", "Weekends"), column: o("never", "Never") }]), JSON.stringify(v(ids.grid)));
      fs.writeFileSync(path.join(OUT, "options-stored-record.json"), JSON.stringify(record, null, 2));
      await R.close();
    }
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { for (const p of browser?.contexts()[0]?.pages() ?? []) await p.screenshot({ path: `${OUT}/options-failure-${p.url().includes("external") ? "render" : "editor"}.png` }); } catch {}
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
