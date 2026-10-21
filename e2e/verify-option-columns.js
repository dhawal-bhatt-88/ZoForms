// The option editor's Score column (contract §17.9): a third column after code
// and label, with a SCORE heading like theirs, in every option editor that shows
// scores — choice, dropdown, checkbox and multiselect options, and a matrix's
// columns — with the settings pane at 720px, about 400px and 280px. Code and
// score are fixed-width columns, and the label is the only field that narrows;
// each heading sits over its column; nothing is cut off or scrolls sideways; tab
// order code → label → score → remove. Lists without scores (a matrix's rows, a
// question not within reach of a scored group) have no Score column, and a
// question out of reach keeps its stored scores. Builder only.
const { API, WEB, OUT, PrismaClient, launchBrowser } = require("./_setup");
const path = require("path");
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

const VIEWPORT = { width: 1440, height: 1100 };
const LONG_LABEL = "A very long option label that is much wider than the label field at any pane width";
const LONG_CODE = "a_very_long_option_code_indeed";
const CODE_WIDTH = 96; // w-24
const SCORE_WIDTH = 56; // w-14, 3.5rem
const scored = (labels) => [
  ...labels.map((label, k) => ({ code: `o${k + 1}`, label, score: k * 10 })),
  { code: LONG_CODE, label: LONG_LABEL, score: -12.5 },
];
// Each option editor that shows Score: [block id, its list's id prefix, the noun in its names, what to call it].
const EDITORS = [
  ["radio", "options", "Option", "choice (radio) options"],
  ["drop", "options", "Option", "dropdown options"],
  ["check", "options", "Option", "checkbox options"],
  ["multi", "options", "Option", "multiselect options"],
  ["mx", "columns", "Column", "matrix columns"],
];
// The pane at its widest, about 400px and its narrowest.
const WIDTHS = [["End", "widest"], [400, "about 400px"], ["Home", "narrowest"]];

(async () => {
  const email = `verify-option-columns-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Columns" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Columns" }) })).json();
    const schema = {
      title: "Columns",
      blocks: [
        {
          id: "g", type: "group", label: "Scored",
          scores: [{ id: "total", label: "Total", formulaText: "radio + drop + check + multi + mx", unanswered: "no-score" }],
          blocks: [
            { id: "radio", type: "choice", label: "Radio question", name: "radio", options: scored(["Never", "Sometimes"]) },
            { id: "drop", type: "dropdown", label: "Dropdown question", name: "drop", options: scored(["Low", "High"]) },
            { id: "check", type: "checkbox", label: "Checkbox question", name: "check", options: scored(["Red", "Blue"]) },
            { id: "multi", type: "multiselect", label: "Multiselect question", name: "multi", options: scored(["Tea", "Coffee"]) },
            { id: "mx", type: "matrix", label: "Matrix question", name: "mx",
              options: [{ code: "am", label: "Morning" }, { code: "pm", label: "Evening" }],
              columns: scored(["Rarely", "Often"]) },
          ],
        },
        // Not within reach of the scored group: its scores are kept, not shown.
        { id: "plain", type: "choice", label: "Not in reach", options: scored(["Yes", "No"]) },
      ],
    };
    const r = await fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    if (!r.ok) throw new Error(`save: ${r.status} ${await r.text()}`);

    browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    P.on("dialog", (d) => d.accept());
    await P.goto(`${WEB}/app/forms/${form.id}/edit`);
    await P.getByText("All changes saved").waitFor();

    const aside = P.locator("#settings-pane");
    const handle = P.locator('[role="separator"][aria-controls="settings-pane"]');
    const paneWidth = async () => Number(await handle.getAttribute("aria-valuenow"));
    const select = async (id) => {
      await P.locator(`[data-block-id="${id}"]`).first().click({ position: { x: 60, y: 12 } });
      await P.locator("#block-label").waitFor();
    };
    // "End" and "Home" go to the pane's widest and narrowest; a number widens from the narrowest until it's reached.
    const setPane = async (to) => {
      await handle.focus();
      await P.keyboard.press(typeof to === "string" ? to : "Home");
      if (typeof to === "number") for (let k = 0; k < 100 && (await paneWidth()) < to; k++) await P.keyboard.press("ArrowLeft");
      await sleep(150);
      return paneWidth();
    };

    // Every row of one list and its headings, measured, and whether anything spills out of the pane.
    const measure = (prefix) => P.evaluate((prefix) => {
      const pane = document.getElementById("settings-pane");
      const content = pane.getBoundingClientRect();
      const right = content.left + pane.clientLeft + pane.clientWidth - parseFloat(getComputedStyle(pane).paddingRight);
      const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const rows = [];
      for (let i = 0; document.getElementById(`${prefix}-${i}-code`); i++) {
        const code = document.getElementById(`${prefix}-${i}-code`);
        rows.push({
          code: box(code),
          label: box(document.getElementById(`${prefix}-${i}-label`)),
          score: box(document.getElementById(`${prefix}-${i}-score`)),
          remove: box(code.parentElement.querySelector("button")),
          // Any visible "Score" text in the row itself (the inline text is gone).
          scoreText: [...code.parentElement.querySelectorAll("label, span")].some((el) => /score/i.test(el.textContent)),
        });
      }
      const fieldset = document.getElementById(`${prefix}-0-code`).closest("fieldset");
      const headingRow = fieldset.querySelector("div[aria-hidden]");
      const headings = [...headingRow.children].map((el) => ({ text: el.textContent, ...box(el), hidden: !!el.closest('[aria-hidden="true"]'), focusable: el.tabIndex >= 0 }));
      return { rows, headings, right, scrolls: pane.scrollWidth > pane.clientWidth };
    }, prefix);
    const oneLine = (row) => [row.label, row.score, row.remove].every((b) => Math.abs((b.y + b.b) / 2 - (row.code.y + row.code.b) / 2) < 1.5);
    const order = (row) => row.code.r <= row.label.x && row.label.r <= row.score.x && row.score.r <= row.remove.x;
    const inside = (m) => !m.scrolls && m.rows.every((row) => [row.code, row.label, row.score, row.remove].every((b) => b && b.x >= 0 && b.r <= m.right + 0.5));
    // Each heading starts where its column does: code over code, label over label, score over score.
    const headingsAligned = (m) => {
      const [code, label, score] = m.headings;
      return m.rows.every((row) => Math.abs(code.x - row.code.x) < 1 && Math.abs(code.w - row.code.w) < 1
        && Math.abs(label.x - row.label.x) < 1 && Math.abs(label.w - row.label.w) < 1
        && Math.abs(score.x - row.score.x) < 1 && Math.abs(score.w - row.score.w) < 1);
    };
    const tabOrder = async (prefix, i) => {
      const seen = [];
      await P.locator(`#${prefix}-${i}-code`).focus();
      for (let k = 0; k < 4; k++) {
        seen.push(await P.evaluate(() => document.activeElement.id || document.activeElement.getAttribute("aria-label")));
        await P.keyboard.press("Tab");
      }
      // Leaving the label generates nothing here: every option already has a code.
      return seen;
    };

    for (const [id, prefix, Noun, what] of EDITORS) {
      await select(id);
      const count = await P.locator(`[id^="${prefix}-"][id$="-score"]`).count();
      check(`${what}: every option has a score field`, count === 3, `${count}`);
      let named = true;
      for (let i = 1; i <= 3; i++) named &&= (await aside.getByRole("spinbutton", { name: `${Noun} ${i} score`, exact: true }).count()) === 1;
      check(`${what}: each score field is named like code and label ("${Noun} 1 score")`, named);
      check(`${what}: the score field has no <label> of its own`, (await P.locator(`#${prefix}-0-score`).evaluate((el) => el.labels.length)) === 0);

      const labelWidths = [];
      for (const [to, where] of WIDTHS) {
        const pane = await setPane(to);
        const m = await measure(prefix);
        const at = `${what}, pane ${where} (${pane}px)`;
        check(`${at}: headings read Code, Label, Score`, JSON.stringify(m.headings.map((h) => h.text)) === '["Code","Label","Score"]', JSON.stringify(m.headings.map((h) => h.text)));
        check(`${at}: headings hidden from assistive technology and not focusable`, m.headings.every((h) => h.hidden && !h.focusable));
        check(`${at}: each heading sits over its column`, headingsAligned(m), JSON.stringify({ headings: m.headings, row: m.rows[0] }));
        check(`${at}: code, label, score and remove on one line, in that order`, m.rows.every((row) => oneLine(row) && order(row)), JSON.stringify(m.rows[0]));
        check(`${at}: the fields are one height`, m.rows.every((row) => row.code.h === row.label.h && row.label.h === row.score.h), JSON.stringify(m.rows[0]));
        check(`${at}: code and score keep their fixed widths (${CODE_WIDTH}px, ${SCORE_WIDTH}px)`, m.rows.every((row) => Math.abs(row.code.w - CODE_WIDTH) < 0.5 && Math.abs(row.score.w - SCORE_WIDTH) < 0.5), `${m.rows[0].code.w} ${m.rows[0].score.w}`);
        check(`${at}: no inline "Score" text in the rows`, m.rows.every((row) => !row.scoreText));
        check(`${at}: nothing cut off or scrolling sideways`, inside(m), JSON.stringify({ right: m.right, scrolls: m.scrolls, row: m.rows[2] }));
        const orders = [];
        for (let i = 0; i < 3; i++) orders.push(await tabOrder(prefix, i));
        check(`${at}: tab order code → label → score → remove in every row`, orders.every((o, i) => JSON.stringify(o.slice(0, 3)) === JSON.stringify([`${prefix}-${i}-code`, `${prefix}-${i}-label`, `${prefix}-${i}-score`]) && o[3] === `Remove ${Noun.toLowerCase()} ${i + 1}`), JSON.stringify(orders));
        labelWidths.push(m.rows[0].label.w);
        if (id === "radio" || id === "mx") {
          const fieldset = P.locator(`#${prefix}-0-code`).locator("xpath=ancestor::fieldset[1]");
          await fieldset.scrollIntoViewIfNeeded();
          await fieldset.screenshot({ path: path.join(OUT, `option-columns-${id}-${pane}.png`) });
        }
      }
      check(`${what}: only the label narrows with the pane`, labelWidths[0] > labelWidths[1] && labelWidths[1] > labelWidths[2] && labelWidths[2] > 0, JSON.stringify(labelWidths));
    }

    // Long values are kept whole in their fields at the narrowest width.
    await select("radio");
    await setPane("Home");
    check("a long code is kept whole at the narrowest width", (await P.locator("#options-2-code").inputValue()) === LONG_CODE);
    check("a long label is kept whole at the narrowest width", (await P.locator("#options-2-label").inputValue()) === LONG_LABEL);
    check("a score is kept whole", (await P.locator("#options-2-score").inputValue()) === "-12.5");

    // A matrix's rows aren't scored: no Score column.
    await select("mx");
    const rows = await measure("options");
    check("a matrix's rows: no score fields", rows.rows.every((row) => row.score === null));
    check("a matrix's rows: headings read Code, Label", JSON.stringify(rows.headings.map((h) => h.text)) === '["Code","Label"]', JSON.stringify(rows.headings.map((h) => h.text)));
    check("a matrix's rows: code, label and remove on one line at the narrowest width", rows.rows.every((row) => Math.abs(row.code.y - row.label.y) < 1 && Math.abs((row.remove.y + row.remove.b) / 2 - (row.code.y + row.code.b) / 2) < 1.5) && !rows.scrolls);

    // A question not within reach of a scored group: no Score column; its scores are kept.
    await select("plain");
    const pane = await setPane(400);
    const plain = await measure("options");
    check("not in reach: no score fields", plain.rows.every((row) => row.score === null));
    check("not in reach: headings read Code, Label", JSON.stringify(plain.headings.map((h) => h.text)) === '["Code","Label"]', JSON.stringify(plain.headings.map((h) => h.text)));
    await P.locator("#options-0-code").locator("xpath=ancestor::fieldset[1]").screenshot({ path: path.join(OUT, `option-columns-not-in-reach-${pane}.png`) });
    await P.locator("#options-0-label").fill("Yes, often");
    await P.locator("#options-0-label").press("Tab");
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await P.getByText("All changes saved").waitFor();
    let plainStored;
    for (let k = 0; k < 60; k++) {
      const stored = (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } })).schema;
      plainStored = stored.blocks.find((b) => b.id === "plain");
      if (plainStored.options[0].label === "Yes, often") break;
      await sleep(250);
    }
    check("not in reach: an edit saves, and the stored scores are kept", plainStored.options[0].label === "Yes, often" && JSON.stringify(plainStored.options.map((o) => o.score)) === "[0,10,-12.5]", JSON.stringify(plainStored.options));
    await ctx.close();
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    if (browser) await browser.close().catch(() => {});
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
