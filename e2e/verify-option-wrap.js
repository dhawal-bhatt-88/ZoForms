// The option editor's rows with a Score field (contract §17.9) at the settings
// pane's narrowest and widest: Score on the label's line when there is room and
// below the label when there isn't, with no fixed breakpoint; nothing cut off or
// scrolled sideways at any width; tab order code → label → score → remove. For
// every option editor that shows Score: choice, dropdown, checkbox and
// multiselect options, and a matrix's columns. Builder only.
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

const VIEWPORT = { width: 1440, height: 1000 };
const LONG_LABEL = "A very long option label that is much wider than the label field at any pane width";
const LONG_CODE = "a_very_long_option_code_indeed";
const scored = (labels) => [
  ...labels.map((label, k) => ({ code: `o${k + 1}`, label, score: k * 10 })),
  { code: LONG_CODE, label: LONG_LABEL, score: -12.5 },
];
// Each option editor that shows Score: [block id, its list's id prefix, what to call it].
const EDITORS = [
  ["radio", "options", "choice (radio) options"],
  ["drop", "options", "dropdown options"],
  ["check", "options", "checkbox options"],
  ["multi", "options", "multiselect options"],
  ["mx", "columns", "matrix columns"],
];

(async () => {
  const email = `verify-option-wrap-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Wrap" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Wrap" }) })).json();
    const schema = {
      title: "Wrap",
      blocks: [{
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
      }],
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

    const pane = P.locator("#settings-pane");
    const handle = P.getByRole("separator", { name: "Field settings" });
    const select = async (id) => {
      await P.locator(`[data-block-id="${id}"]`).first().click({ position: { x: 60, y: 12 } });
      await P.locator("#block-label").waitFor();
    };
    const setPane = async (key) => {
      await handle.focus();
      await P.keyboard.press(key);
      await sleep(150);
    };

    // Every row of one list, measured: its boxes, and whether anything spills out of the pane.
    const measure = (prefix) => P.evaluate((prefix) => {
      const pane = document.getElementById("settings-pane");
      const content = pane.getBoundingClientRect();
      const right = content.left + pane.clientLeft + pane.clientWidth - parseFloat(getComputedStyle(pane).paddingRight);
      const rows = [];
      for (let i = 0; document.getElementById(`${prefix}-${i}-code`); i++) {
        const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        const code = document.getElementById(`${prefix}-${i}-code`);
        const label = document.getElementById(`${prefix}-${i}-label`);
        const score = document.getElementById(`${prefix}-${i}-score`);
        const scoreText = score?.closest("[data-score]")?.querySelector("label");
        const remove = label.closest(".flex.items-start").querySelector("button");
        rows.push({ code: box(code), label: box(label), score: score && box(score), scoreText: scoreText && box(scoreText), remove: box(remove) });
      }
      return { rows, right, scrolls: pane.scrollWidth > pane.clientWidth };
    }, prefix);
    const sameLine = (row) => Math.abs(row.score.y - row.label.y) < 2 && row.score.x >= row.label.r;
    // Below the label and lined up with it: the "Score" text starts where the label does.
    const below = (row) => row.score.y >= row.label.b && Math.abs(row.scoreText.x - row.label.x) < 1 && row.score.r <= row.label.r + 1;
    const inside = (m) => !m.scrolls && m.rows.every((row) => [row.code, row.label, row.score, row.scoreText, row.remove].every((b) => b && b.x >= 0 && b.r <= m.right + 0.5));
    const tabOrder = async (prefix) => {
      const seen = [];
      await P.locator(`#${prefix}-0-code`).focus();
      for (let k = 0; k < 4; k++) {
        seen.push(await P.evaluate(() => document.activeElement.id || document.activeElement.getAttribute("aria-label")));
        await P.keyboard.press("Tab");
      }
      // Leaving the label generates nothing here: every option already has a code.
      return seen;
    };

    for (const [id, prefix, what] of EDITORS) {
      await select(id);
      const count = await P.locator(`[id^="${prefix}-"][id$="-score"]`).count();
      check(`${what}: every option has a Score field`, count === 3, `${count}`);

      // Widest: Score on the label's line.
      await setPane("End");
      let m = await measure(prefix);
      check(`${what}, pane at its widest (720px): Score on the same line as the label, after it`, m.rows.every(sameLine), JSON.stringify(m.rows[0]));
      check(`${what}, widest: code, label and remove share one line, the fields the same height`, m.rows.every((row) => Math.abs(row.code.y - row.label.y) < 1 && row.code.h === row.label.h && Math.abs((row.remove.y + row.remove.b) / 2 - (row.code.y + row.code.b) / 2) < 1.5), JSON.stringify(m.rows[0]));
      check(`${what}, widest: the label fills the space (wider than its 8rem minimum)`, m.rows.every((row) => row.label.w > 128 * 1.5), `${m.rows[0].label.w}`);
      check(`${what}, widest: nothing cut off or scrolling sideways`, inside(m), JSON.stringify({ right: m.right, scrolls: m.scrolls }));
      const wideScore = m.rows[0].score.w;
      let order = await tabOrder(prefix);
      check(`${what}, widest: tab order code → label → score → remove`, JSON.stringify(order) === JSON.stringify([`${prefix}-0-code`, `${prefix}-0-label`, `${prefix}-0-score`, order[3]]) && /^Remove /.test(order[3]), JSON.stringify(order));
      if (id === "radio") await P.screenshot({ path: path.join(OUT, "option-wrap-wide.png"), clip: await pane.boundingBox() });

      // Narrowest: Score below the label.
      await setPane("Home");
      m = await measure(prefix);
      check(`${what}, pane at its narrowest (280px): Score below the label, lined up with it`, m.rows.every(below), JSON.stringify(m.rows[0]));
      check(`${what}, narrowest: code and remove stay on the label's line`, m.rows.every((row) => Math.abs(row.code.y - row.label.y) < 1 && row.remove.b <= row.score.y + 1));
      check(`${what}, narrowest: nothing cut off or scrolling sideways`, inside(m), JSON.stringify({ right: m.right, scrolls: m.scrolls, row: m.rows[2] }));
      check(`${what}: the score field keeps its fixed width`, m.rows.every((row) => Math.abs(row.score.w - wideScore) < 0.5), `${wideScore} ${m.rows[0].score.w}`);
      check(`${what}: the code field keeps its fixed width`, m.rows.every((row) => Math.abs(row.code.w - 96) < 0.5), `${m.rows[0].code.w}`);
      order = await tabOrder(prefix);
      check(`${what}, narrowest: tab order unchanged`, JSON.stringify(order.slice(0, 3)) === JSON.stringify([`${prefix}-0-code`, `${prefix}-0-label`, `${prefix}-0-score`]) && /^Remove /.test(order[3]), JSON.stringify(order));
      if (id === "radio") await P.screenshot({ path: path.join(OUT, "option-wrap-narrow.png"), clip: await pane.boundingBox() });
    }

    // Long values are kept whole in their fields at the narrowest width.
    await select("radio");
    await setPane("Home");
    check("a long code is kept whole at the narrowest width", (await P.locator("#options-2-code").inputValue()) === LONG_CODE);
    check("a long label is kept whole at the narrowest width", (await P.locator("#options-2-label").inputValue()) === LONG_LABEL);
    check("a score is kept whole", (await P.locator("#options-2-score").inputValue()) === "-12.5");

    // No breakpoint: stepping the pane from widest to narrowest, Score moves below the label once,
    // exactly when the label would otherwise go under its 8rem minimum.
    await setPane("End");
    const steps = [];
    for (let k = 0; k < 40; k++) {
      const m = await measure("options");
      const row = m.rows[0];
      steps.push({ pane: Number(await handle.getAttribute("aria-valuenow")), same: sameLine(row), below: below(row), label: Math.round(row.label.w), room: Math.round(row.score.r - row.label.x) });
      if (steps.at(-1).pane === 280) break;
      await P.keyboard.press("ArrowRight");
      await sleep(30);
    }
    const flips = steps.filter((s, k) => k > 0 && s.same !== steps[k - 1].same).length;
    check("going narrower, Score moves below the label once and stays there", flips === 1 && steps.every((s) => s.same || s.below) && !steps.at(-1).same, JSON.stringify(steps.map((s) => `${s.pane}:${s.same ? "same" : "below"}`)));
    check("on the label's line, the label is never under its 8rem minimum", steps.filter((s) => s.same).every((s) => s.label >= 128), JSON.stringify(steps.filter((s) => s.same).map((s) => s.label)));
    const first = steps.find((s) => !s.same);
    check("it wraps where the label and score no longer fit side by side, not at a set pane width", first && first.pane > 280 && first.pane < 720, JSON.stringify(first));

    // A list without scores is unchanged: a matrix's rows.
    await select("mx");
    await setPane("Home");
    const rows = await measure("options");
    check("a matrix's rows have no Score field", rows.rows.every((row) => row.score === null));
    check("a matrix's rows keep code, label and remove on one line at the narrowest width", rows.rows.every((row) => Math.abs(row.code.y - row.label.y) < 1 && Math.abs(row.remove.y - row.label.y) < 2) && inside({ ...rows, rows: rows.rows.map((row) => ({ ...row, score: row.code, scoreText: row.code })) }));
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
