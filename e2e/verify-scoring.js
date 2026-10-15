// Scoring (contract §17) in the editor, through the real UI: a group with five
// scored choice questions and a total, plus a number question in a weighted
// formula with 2 decimals; a rename that rewrites both formulas; the delete,
// move and Repeats guards, each with its message and jump link; an option score
// cleared (save blocked, with the message) and restored; a group template with a
// score inserted twice inside the scored group, with suffixed names and its own
// formulas rewritten; and the downloaded artifact (scores and option scores, no
// names or formula text). The type-change guard has no control in the editor and
// is covered by the unit tests and verify-scoring-api.js (decision C).
//
// With E2E_EXTERNAL_APP_URL set, the download is rendered in the external test
// app (?form=builder-scoring, @zoworkhq/forms 0.23.0 or later), filled in and submitted;
// the scores shown after submit and the test app API's derived.scores are
// checked against the expected values, with one score left without a value
// because a question it uses is unanswered ("No score").
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact } = require("./_setup");
const prisma = new PrismaClient();

const EXTERNAL_APP = process.env.E2E_EXTERNAL_APP_URL;
const ARTIFACT = "builder-scoring-schema.json";
const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (url) => {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(1000); }
  throw new Error(`${url} not reachable`);
};
const walk = (blocks) => blocks.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);

// The group template inserted twice: its question names clash with the scored
// group's ("days_affected"), and with each other once both copies are in.
const moodTemplate = {
  id: "tg", type: "group", label: "Mood check",
  scores: [{ id: "mt", label: "Mood total", formulaText: "days_affected + mood", unanswered: "no-score", showToRespondent: true }],
  blocks: [
    { id: "td", type: "number", label: "Days affected", name: "days_affected", required: false },
    { id: "tm", type: "number", label: "Mood", name: "mood", required: false },
  ],
};

(async () => {
  const email = `verify-scoring-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Scoring" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const formId = (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Scoring verify" }) })).json()).id;
    const seeded = await fetch(`${API}/v1/forms/${formId}/schema`, { method: "PUT", headers: H, body: JSON.stringify({ title: "Scoring verify", blocks: [] }) });
    if (![200, 409].includes(seeded.status)) throw new Error(`seed failed ${seeded.status}`);
    const tpl = await fetch(API + "/v1/templates", { method: "POST", headers: H, body: JSON.stringify({ kind: "group", name: "Mood check", content: moodTemplate }) });
    if (tpl.status !== 201) throw new Error(`template failed ${tpl.status} ${await tpl.text()}`);
    const stored = async () => (await prisma.formVersion.findFirst({ where: { formId }, orderBy: { version: "desc" } })).schema;

    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    // Hide Next's dev-only tools indicator: it overlays part of the page and eats clicks.
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("no page errors", false, e.message));
    page.on("dialog", (d) => d.accept());
    const aside = page.locator("aside");
    const label = page.locator("#block-label");
    const cardByLabel = (text) => page.locator("[data-block-id]").filter({ has: page.getByText(text, { exact: true }) }).last();
    const selectByLabel = (text) => cardByLabel(text).click({ position: { x: 60, y: 12 } });
    const idOf = async (text) => cardByLabel(text).getAttribute("data-block-id");
    const notice = page.getByRole("alert").filter({ hasText: /Can't|Used in the score|Couldn't save/ });
    const noticeText = async () => (await notice.innerText()).trim();
    const dismiss = () => notice.getByRole("button", { name: "Dismiss" }).click();
    const saveBtn = page.getByRole("button", { name: "Save", exact: true });
    const save = async () => { await saveBtn.click(); await page.getByText("All changes saved").waitFor({ timeout: 15000 }); };
    const insert = async (query) => {
      await page.getByTitle("Insert a block").click();
      await page.getByPlaceholder("Search blocks…").fill(query);
      await page.keyboard.press("Enter");
      await label.waitFor();
    };
    /** Set the selected block's label and leave the field, which names a new question (§17.8). */
    const setLabel = async (text) => { await label.fill(text); await label.blur(); };
    const formula = (n) => aside.getByRole("textbox", { name: "Formula" }).nth(n);
    const scoreLabel = (n) => aside.getByRole("textbox", { name: "Label", exact: true }).nth(n + 1); // the group's own Label is first
    const typeFormula = async (n, text) => { await formula(n).fill(text); await formula(n).blur(); };

    await page.goto(`${WEB}/app/forms/${formId}/edit`);
    await page.getByText("All changes saved").waitFor({ timeout: 90000 });

    // ================= build: a group, five choices, a number =================
    await insert("group");
    await setLabel("PHQ-5");
    for (let k = 1; k <= 5; k += 1) {
      await insert("multiple choice");
      await setLabel(`Item ${k}`);
    }
    await insert("number");
    await setLabel("Days affected");
    const ids = {};
    for (const text of ["PHQ-5", "Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Days affected"]) ids[text] = await idOf(text);
    check("built: a group with five choices and a number inside it", Object.values(ids).every(Boolean), JSON.stringify(ids));

    // ---------- two scores ----------
    await selectByLabel("PHQ-5");
    check("the group inspector has a Scores panel", (await aside.getByRole("button", { name: "Add score" }).count()) === 1);
    await aside.getByRole("button", { name: "Add score" }).click();
    await scoreLabel(0).fill("Total");
    await typeFormula(0, "item_1 + item_2 + item_3 + item_4 + item_5");
    await aside.getByRole("switch", { name: "Show to respondent after submit" }).nth(0).click();
    await aside.getByRole("button", { name: "Add score" }).click();
    await scoreLabel(1).fill("Weighted");
    await typeFormula(1, "(item_1 + item_2) * days_affected / 7");
    await aside.getByRole("combobox", { name: "Decimal places" }).nth(1).selectOption("2");
    await aside.getByRole("switch", { name: "Show to respondent after submit" }).nth(1).click();
    await sleep(200);
    check("both formulas valid: no error shown", (await formula(0).getAttribute("aria-invalid")) === null && (await formula(1).getAttribute("aria-invalid")) === null);
    check("adding a score named the questions it can reach, from their labels",
      (await aside.getByText("Question names (6)").count()) === 1);

    // ---------- option scores, on each item ----------
    for (let k = 1; k <= 5; k += 1) {
      await selectByLabel(`Item ${k}`);
      check(`Item ${k}: Name field shows item_${k}`, (await aside.getByRole("textbox", { name: "Name" }).inputValue()) === `item_${k}`);
      for (let o = 1; o <= 3; o += 1) await aside.getByRole("spinbutton", { name: `Score for option ${o}` }).fill(String(o - 1));
    }
    await selectByLabel("PHQ-5");
    check("no missing option scores are listed", (await aside.getByText(/has no score/).count()) === 0);
    await save();
    let s = await stored();
    let group = walk(s.blocks).find((b) => b.id === ids["PHQ-5"]);
    check("saved: two scores, text only", group.scores.length === 2 && group.scores.every((x) => !("formula" in x))
      && group.scores[1].decimals === 2 && group.scores.every((x) => x.showToRespondent === true), JSON.stringify(group.scores));
    check("saved: option scores 0, 1, 2 on every item",
      [1, 2, 3, 4, 5].every((k) => walk(s.blocks).find((b) => b.id === ids[`Item ${k}`]).options.map((o) => o.score).join() === "0,1,2"));

    // ================= rename =================
    await selectByLabel("Item 1");
    const name = aside.getByRole("textbox", { name: "Name" });
    await name.fill("interest");
    await name.blur();
    await sleep(150);
    check("renaming says how many formulas were updated", (await page.locator("#block-name-status").innerText()).trim() === `2 formulas updated to use "interest".`);
    await selectByLabel("PHQ-5");
    check("…and both formulas use the new name",
      (await formula(0).inputValue()) === "interest + item_2 + item_3 + item_4 + item_5" && (await formula(1).inputValue()) === "(interest + item_2) * days_affected / 7",
      `${await formula(0).inputValue()} | ${await formula(1).inputValue()}`);

    // ================= guards =================
    // Delete a question both formulas use.
    await cardByLabel("Item 2").hover();
    await cardByLabel("Item 2").getByRole("button", { name: "Delete", exact: true }).click();
    await notice.waitFor();
    check("delete refused, with the contract's message for each score",
      (await noticeText()).startsWith(`Used in the score "Total" of "PHQ-5". Remove it from the formula first. Used in the score "Weighted" of "PHQ-5". Remove it from the formula first.`), await noticeText());
    check("…with a jump link to the group", (await notice.getByRole("button", { name: "PHQ-5 →" }).count()) === 1);
    check("…and the question is still there", (await cardByLabel("Item 2").count()) === 1);
    await notice.getByRole("button", { name: "PHQ-5 →" }).click();
    await sleep(200);
    check("the jump link selects the group", (await aside.getByRole("button", { name: "Add score" }).count()) === 1);
    await dismiss();

    // Move a used question out of the group.
    await selectByLabel("Item 3");
    const moveMenu = aside.getByRole("combobox", { name: "Move to", exact: true });
    const destinations = await moveMenu.locator("option").allTextContents();
    const topLevel = destinations.find((d) => /top level/i.test(d));
    await moveMenu.selectOption({ label: topLevel });
    await aside.getByRole("button", { name: "Move", exact: true }).click();
    await notice.waitFor();
    check("move out of the group refused, naming the scored group",
      (await noticeText()).startsWith(`Can't move "Item 3" there — these groups have scores whose formulas use a question that would be out of their reach:`), `${topLevel} | ${await noticeText()}`);
    check("…with a jump link to it", (await notice.getByRole("button", { name: "PHQ-5 →" }).count()) === 1);
    await dismiss();

    // A nested plain group holding the number question: fine. Turning Repeats on for it: refused.
    await selectByLabel("Item 5");
    await insert("group");
    await setLabel("Timing");
    await selectByLabel("Days affected");
    const inner = (await moveMenu.locator("option").allTextContents()).find((d) => /› Timing$/.test(d));
    await moveMenu.selectOption({ label: inner });
    await aside.getByRole("button", { name: "Move", exact: true }).click();
    await sleep(250);
    check("moving the number into a nested plain group is allowed (still within reach)", (await notice.count()) === 0);
    await selectByLabel("Timing");
    await aside.getByRole("switch", { name: "Repeats" }).click();
    await notice.waitFor();
    check("Repeats on for the nested group refused, naming the scored group",
      (await noticeText()).startsWith(`Can't make "Timing" repeat — these groups have scores whose formulas use a question inside it:`), await noticeText());
    check("…with a jump link, and Repeats still off",
      (await notice.getByRole("button", { name: "PHQ-5 →" }).count()) === 1 && (await aside.getByRole("switch", { name: "Repeats" }).getAttribute("aria-checked")) === "false");
    await dismiss();

    // ================= a missing option score blocks the save =================
    await selectByLabel("Item 3");
    await aside.getByRole("spinbutton", { name: "Score for option 2" }).fill("");
    await selectByLabel("PHQ-5");
    check("the Scores panel shows the missing option score live",
      (await aside.getByText(`"Item 3": Option 2 ("Option 2") has no score, but the score "Total" of "PHQ-5" uses this question. Give every option a score.`).count()) === 1);
    const versions = await prisma.formVersion.count({ where: { formId } });
    await saveBtn.click();
    await notice.waitFor();
    check("save refused, naming the question and the score",
      (await noticeText()) === `Couldn't save: Block "PHQ-5 › Item 3": Option 2 ("Option 2") has no score, but the score "Total" of "PHQ-5" uses this question. Give every option a score.`, await noticeText());
    check("…and nothing saved", (await prisma.formVersion.count({ where: { formId } })) === versions);
    await dismiss();
    await selectByLabel("Item 3");
    await aside.getByRole("spinbutton", { name: "Score for option 2" }).fill("1");
    await save();
    check("with the score restored, it saves", (await prisma.formVersion.count({ where: { formId } })) === versions + 1);

    // ================= a group template with a score, inserted twice inside the scored group =================
    for (let k = 0; k < 2; k += 1) {
      await selectByLabel("Timing");
      await page.getByTitle("Insert a block").click();
      await page.getByPlaceholder("Search blocks…").fill("from template");
      await page.keyboard.press("Enter");
      const picker = page.getByRole("dialog", { name: "Insert from a template" });
      await picker.waitFor();
      await picker.getByRole("button", { name: /Mood check/ }).click();
      await picker.getByRole("button", { name: "Insert as group" }).click();
      await picker.waitFor({ state: "detached" });
      await sleep(200);
    }
    // The copies, by id from the saved content: their cards nest inside their groups.
    await save();
    s = await stored();
    const copyGroups = walk(s.blocks).filter((b) => b.type === "group" && b.label === "Mood check");
    check("two copies inserted, inside the scored group",
      copyGroups.length === 2 && walk([walk(s.blocks).find((b) => b.id === ids["PHQ-5"])]).filter((b) => b.label === "Mood check").length === 2);
    const byId = (id) => page.locator(`[data-block-id="${id}"]`).click({ position: { x: 60, y: 12 } });
    const copyNames = [];
    const copyTexts = [];
    for (const g of copyGroups) {
      const names = [];
      for (const q of g.blocks) {
        await byId(q.id);
        names.push(await aside.getByRole("textbox", { name: "Name" }).inputValue());
      }
      copyNames.push(names);
      await byId(g.id);
      copyTexts.push(await formula(0).inputValue());
    }
    check("the copies' clashing names get suffixes", JSON.stringify(copyNames) === JSON.stringify([["days_affected_2", "mood"], ["days_affected_3", "mood_2"]]), JSON.stringify(copyNames));
    check("…and each copy's own formula is rewritten to match", JSON.stringify(copyTexts) === JSON.stringify(["days_affected_2 + mood", "days_affected_3 + mood_2"]), JSON.stringify(copyTexts));
    check("…saved that way, text only", JSON.stringify(copyGroups.map((g) => g.scores[0].formulaText)) === JSON.stringify(copyTexts) && copyGroups.every((g) => !("formula" in g.scores[0])));
    await selectByLabel("PHQ-5");
    check("the scored group's own formulas are unchanged",
      (await formula(0).inputValue()) === "interest + item_2 + item_3 + item_4 + item_5" && (await formula(1).inputValue()) === "(interest + item_2) * days_affected / 7");

    // ================= the artifact =================
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    saveArtifact(ARTIFACT, raw);
    const art = JSON.parse(raw);
    const blocks = walk(art.blocks);
    const phq = blocks.find((b) => b.id === ids["PHQ-5"]);
    const ref = (k) => ({ ref: ids[`Item ${k}`] });
    const op = (o, a, b) => ({ op: o, args: [a, b] });
    check("download: the total's tree", JSON.stringify(phq.scores[0]) === JSON.stringify({
      id: phq.scores[0].id, label: "Total",
      formula: op("+", op("+", op("+", op("+", ref(1), ref(2)), ref(3)), ref(4)), ref(5)),
      unanswered: "no-score", showToRespondent: true,
    }), JSON.stringify(phq.scores[0]));
    check("download: the weighted score's tree, decimals 2", JSON.stringify(phq.scores[1]) === JSON.stringify({
      id: phq.scores[1].id, label: "Weighted",
      formula: op("/", op("*", op("+", ref(1), ref(2)), { ref: ids["Days affected"] }), { num: 7 }),
      unanswered: "no-score", decimals: 2, showToRespondent: true,
    }), JSON.stringify(phq.scores[1]));
    check("download: option scores on every item", [1, 2, 3, 4, 5].every((k) => blocks.find((b) => b.id === ids[`Item ${k}`]).options.map((o) => o.score).join() === "0,1,2"));
    const copies = blocks.filter((b) => b.type === "group" && b.label === "Mood check");
    check("download: each copy's score refers to its own questions",
      copies.length === 2 && copies.every((g) => JSON.stringify(g.scores[0].formula) === JSON.stringify(op("+", { ref: g.blocks[0].id }, { ref: g.blocks[1].id }))));
    check("download: no name and no formulaText anywhere", !raw.includes('"name"') && !raw.includes("formulaText"));

    // ================= render in the external test app (optional) =================
    if (!EXTERNAL_APP) {
      console.log("  SKIP  render in the external test app (set E2E_EXTERNAL_APP_URL and E2E_EXTERNAL_FORMS_DIR to run it)");
    } else if (!process.env.E2E_EXTERNAL_FORMS_DIR || !fs.existsSync(path.join(process.env.E2E_EXTERNAL_FORMS_DIR, ARTIFACT))) {
      check("render: E2E_EXTERNAL_FORMS_DIR is set, so the app has this run's artifact", false, "set E2E_EXTERNAL_FORMS_DIR to the test app's src/forms");
    } else {
      const appRoot = path.join(process.env.E2E_EXTERNAL_FORMS_DIR, "..", "..");
      const installed = path.join(appRoot, "node_modules", "@zoworkhq", "forms", "package.json");
      const version = fs.existsSync(installed) ? JSON.parse(fs.readFileSync(installed, "utf8")).version : "not installed";
      // Scores need 0.23.0 or later (renamed from @yourco/forms at 0.24.0).
      const [maj, min] = version.split(".").map(Number);
      check("render: the test app has @zoworkhq/forms 0.23.0 or later", maj > 0 || min >= 23, version);
      await sleep(1500); // let the app's dev server see the new file
      const R = await ctx.newPage();
      R.on("pageerror", (e) => check("render: no page errors", false, e.message));
      await R.goto(`${EXTERNAL_APP}${EXTERNAL_APP.includes("?") ? "&" : "?"}form=builder-scoring`);
      const phqR = R.getByRole("group", { name: "PHQ-5", exact: true });
      // The app shows only forms registered in its src/App.tsx; anything else falls back to its default form.
      const registered = await phqR.waitFor({ timeout: 15000 }).then(() => true, () => false);
      check("render: the test app shows ?form=builder-scoring", registered,
        "register it in the test app's src/App.tsx, as the other builder exports are: import ./forms/builder-scoring-schema.json and add a 'builder-scoring' entry");
      if (registered) {
        check("render: no score is shown while filling in", (await R.locator(".yf-scores").count()) === 0);
        // Item k → option: scores 2, 1, 0, 2, 1 → total 6.
        const picks = [3, 2, 1, 3, 2];
        for (let k = 1; k <= 5; k += 1) {
          await phqR.getByRole("group", { name: `Item ${k}`, exact: true }).getByRole("radio", { name: `Option ${picks[k - 1]}`, exact: true }).check();
        }
        // The copies went in after the selected Timing group's contents, so Timing's own question comes first.
        await R.getByRole("group", { name: "Timing", exact: true }).getByLabel("Days affected", { exact: true }).first().fill("3");
        const moodR = R.getByRole("group", { name: "Mood check", exact: true });
        // Copy 1: Mood left unanswered, so its "No score" total has no value and isn't shown.
        await moodR.nth(0).getByLabel("Days affected", { exact: true }).fill("4");
        await moodR.nth(1).getByLabel("Days affected", { exact: true }).fill("5");
        await moodR.nth(1).getByLabel("Mood", { exact: true }).fill("3");
        const [res] = await Promise.all([
          R.waitForResponse((x) => /\/api\/submit$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 15000 }),
          R.getByRole("button", { name: "Submit", exact: true }).click(),
        ]);
        check("render: submits (201)", res.status() === 201, String(res.status()));
        const sent = JSON.parse(res.request().postData());
        // 0.23.0 sends an empty `derived: {}`; what matters (§17.5) is that no score is in it.
        check("payload: the browser sends no scores", !JSON.stringify(sent).includes("scores"), JSON.stringify(sent.derived));
        await R.locator(".yf-success").waitFor({ timeout: 10000 });
        const shown = (await R.locator(".yf-scores li").allInnerTexts()).map((t) => t.trim());
        check("after submit: the shown scores, rounded, without the one that has no value",
          JSON.stringify(shown) === JSON.stringify(["Total: 6", "Weighted: 1.29", "Mood total: 8"]), JSON.stringify(shown));
        check("after submit: focus on the success message", await R.evaluate(() => document.activeElement?.classList.contains("yf-success")));
        await R.screenshot({ path: `${OUT}/scoring-render.png`, fullPage: true });

        // The test app's API: what prepareSubmission calculated, stored and logged.
        const expected = [
          { groupId: ids["PHQ-5"], label: "Total", value: 6 },
          { groupId: ids["PHQ-5"], label: "Weighted", value: 1.29 },
          { groupId: copies[0].id, label: "Mood total", value: null, reason: "unanswered" },
          { groupId: copies[1].id, label: "Mood total", value: 8 },
        ];
        const same = (scores) => Array.isArray(scores) && scores.length === expected.length && expected.every((e, k) =>
          scores[k].groupId === e.groupId && scores[k].label === e.label && scores[k].value === e.value && scores[k].reason === e.reason);
        const all = await (await fetch(new URL("api/submissions", EXTERNAL_APP.endsWith("/") ? EXTERNAL_APP : EXTERNAL_APP + "/"))).json();
        const record = (Array.isArray(all) ? all : all.submissions ?? []).find((x) => x.idempotencyKey === sent.idempotencyKey);
        check("API: the stored record's derived.scores, in reading order, with the unanswered one null",
          same(record?.derived?.scores), JSON.stringify(record?.derived));
        const logFile = path.join(appRoot, "api-requests.log");
        const logged = fs.existsSync(logFile)
          ? fs.readFileSync(logFile, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } })
            .filter((e) => e?.body?.idempotencyKey === sent.idempotencyKey && e.derivedScores).pop()
          : undefined;
        check("API: the logged derivedScores match", same(logged?.derivedScores), JSON.stringify(logged?.derivedScores));
        fs.writeFileSync(path.join(OUT, "scoring-stored-record.json"), JSON.stringify(record, null, 2));
      }
      await R.close();
    }
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    if (browser) await browser.close();
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
