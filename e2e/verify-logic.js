// Conditional logic end to end (contract §3, §15): build conditions and their
// logic text in the real editor (Edge) — the Logic field a second condition
// brings, every §15.7 message, the delete guard and renumbering, save, reload
// and download in each §15.4 shape, accessibility — plus content saved before
// logic text opening clean, the delete dialogs' wording for mixed logic, the
// refusal guards, and every invalid condition through the API. With
// E2E_EXTERNAL_APP_URL set, a download using `1 OR (2 AND 3)` is rendered with
// @zoworkhq/zoforms 0.20.0 or later, and shown, hidden and submitted as the logic says.
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact, opts, noIds, hasIds } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await sleep(1000);
  }
  throw new Error("server not up: " + url);
}
const EXTERNAL_APP = process.env.E2E_EXTERNAL_APP_URL;
const ARTIFACT = "builder-logic-schema.json";

// Seed blocks (the conditions themselves are built in the UI).
const IDS = {
  intro: "b_intro001", attend: "b_attend01", guests: "b_guests01", smoker: "b_smoker01",
  consent: "b_consent1", diet: "b_diet0001", sessions: "b_sess0001",
};
const seed = {
  title: "Logic verify",
  blocks: [
    { id: IDS.intro, type: "heading", label: "Intro", required: false, level: 2 },
    { id: IDS.attend, type: "choice", label: "Attending?", required: false, options: opts("Yes", "No", "Maybe") },
    { id: IDS.guests, type: "number", label: "Guests", required: false },
    { id: IDS.smoker, type: "choice", label: "Smoker?", required: false, options: opts("Yes", "No") },
    { id: IDS.consent, type: "choice", label: "Consent?", required: false, options: opts("Yes", "No") },
    { id: IDS.diet, type: "short", label: "Dietary needs", required: false },
    { id: IDS.sessions, type: "checkbox", label: "Sessions", required: false, options: opts("A", "B") },
  ],
};
const yesNo = (id, label) => ({ id, type: "choice", label, options: opts("Yes", "No") });
const yes = (question, id) => ({ ...(id ? { id } : {}), question, operator: "=", answer: "yes" });

(async () => {
  const email = `verify-logic-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Logic" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const putTo = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;
    const formId = await create("Logic verify");
    const put = (schema) => putTo(formId, schema);
    const seeded = await put(seed);
    if (seeded.status !== 200) throw new Error("seed failed " + seeded.status + " " + (await seeded.text()));
    const rows = () => prisma.formVersion.count({ where: { formId } });

    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    const page = await ctx.newPage();
    // Hide Next's dev-only tools indicator: it overlays part of the page and eats clicks.
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const notFound = [];
    page.on("response", (r) => { if (r.status() === 404) notFound.push(r.url()); });
    page.on("pageerror", (e) => check("no page errors", false, e.message));
    page.on("dialog", (d) => d.accept()); // only the editor's own "leave without saving?" guard
    const card = (id) => page.locator(`[data-block-id="${id}"]`);
    const alert = page.getByRole("alert").filter({ hasText: /Can't/ }); // not Next's empty route announcer
    const select = (id) => card(id).click({ position: { x: 60, y: 12 } });
    const aside = page.locator("aside");
    const saveBtn = page.getByRole("button", { name: "Save", exact: true });
    // Blocked with a reason (aria-disabled), not disabled: it stays focusable.
    const saveBlocked = async () => (await saveBtn.getAttribute("aria-disabled")) === "true";
    const logic = page.getByRole("textbox", { name: "Logic", exact: true });
    const error = page.locator(`#logic-text-${IDS.diet}-error`);
    const errorText = async () => (await error.innerText()).trim();
    const numbered = () => aside.getByText(/^Condition \d+$/).allTextContents();
    const named = (n, what) => what === "answer number"
      ? page.getByRole("spinbutton", { name: `Condition ${n} answer`, exact: true })
      : page.getByRole("combobox", { name: `Condition ${n} ${what}`, exact: true });
    const remove = (n) => page.getByRole("button", { name: `Remove condition ${n}`, exact: true });
    const add = page.getByRole("button", { name: "Add condition" });
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.id || "");
    /** Type the logic text and leave the field, which checks it at once. */
    const typeLogic = async (text) => { await logic.fill(text); await logic.blur(); };
    const save = async () => { await saveBtn.click(); await page.getByText("All changes saved").waitFor({ timeout: 15000 }); };
    const download = async () => {
      const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
      const raw = fs.readFileSync(await dl.path(), "utf8");
      return { raw, art: JSON.parse(raw) };
    };

    await page.goto(`${WEB}/app/forms/${formId}/edit`);
    await page.getByText("All changes saved").waitFor();

    // ================= build conditions in the UI =================
    await select(IDS.diet);
    await page.getByText("Show this question only when…").waitFor();
    await add.click();
    const sourceChoices = await named(1, "question").locator("option").allTextContents();
    check("source list = only eligible questions above (no heading, nothing below)",
      JSON.stringify(sourceChoices) === JSON.stringify(["1. Attending?", "2. Guests", "3. Smoker?", "4. Consent?"]) /* only answerable questions are numbered (contract §4) */, sourceChoices.join(" | "));
    check("new condition defaults to nearest question, 'is answered'",
      (await named(1, "question").inputValue()) === IDS.consent && (await named(1, "operator").inputValue()) === "exists");
    check("one condition: no Logic field", (await logic.count()) === 0);

    await named(1, "question").selectOption(IDS.attend);
    const opText = await named(1, "operator").locator("option").allTextContents();
    check("choice source offers is answered / is / is not", JSON.stringify(opText) === JSON.stringify(["is answered", "is", "is not"]), opText.join(" | "));
    await named(1, "operator").selectOption("=");
    const ansChoices = await named(1, "answer").locator("option").allTextContents();
    check("choice answer is an options dropdown", JSON.stringify(ansChoices) === JSON.stringify(["Yes", "No", "Maybe"]), ansChoices.join(" | "));
    await named(1, "answer").selectOption("Yes");

    // ---------- the second condition brings the Logic field ----------
    await add.click();
    check("a second condition brings the Logic field, pre-filled with 1 AND 2", (await logic.inputValue()) === "1 AND 2", await logic.inputValue());
    await named(2, "question").selectOption(IDS.guests);
    const numOps = await named(2, "operator").locator("option").allTextContents();
    check("number source adds greater/less comparisons", numOps.includes("is greater than") && numOps.includes("is at most"), numOps.join(" | "));
    await named(2, "operator").selectOption(">");
    await named(2, "answer number").fill("2");
    check("'Conditional' badge on the block", await card(IDS.diet).getByText("Conditional").isVisible());
    check("the All/Any choice is gone", (await aside.getByRole("button", { name: /^(All|Any)$/ }).count()) === 0 && (await aside.getByText("of these are true").count()) === 0);
    check("conditions are numbered, each card's only button is Remove (no move controls)",
      JSON.stringify(await numbered()) === '["Condition 1","Condition 2"]'
      && JSON.stringify(await aside.locator("[data-condition]").evaluateAll((cards) => cards.flatMap((c) => [...c.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")))))
        === '["Remove condition 1","Remove condition 2"]');

    // ---------- accessibility ----------
    const describedBy = ((await logic.getAttribute("aria-describedby")) ?? "").split(" ");
    check("the field is labelled Logic, with the hint and the error as its description",
      describedBy.length === 2 && (await page.locator(`[id="${describedBy[0]}"]`).innerText()) === "Use condition numbers, AND, OR and brackets, e.g. 1 AND (2 OR 3)"
      && describedBy[1] === `logic-text-${IDS.diet}-error`, describedBy.join(" "));
    check("the error sits in a polite live region", (await error.getAttribute("aria-live")) === "polite");
    check("valid text: no aria-invalid, no message", (await logic.getAttribute("aria-invalid")) === null && (await errorText()) === "");

    // ---------- more conditions: the text is left alone ----------
    await add.click();
    check("adding a third condition leaves the text and says it isn't used",
      (await logic.inputValue()) === "1 AND 2" && (await errorText()) === "Condition 3 isn't used.", await errorText());
    check("an error sets aria-invalid, shows an icon and a red border, not colour alone",
      (await logic.getAttribute("aria-invalid")) === "true" && (await error.locator("svg").count()) === 1 && (await logic.getAttribute("class")).includes("border-fail"));
    await named(3, "question").selectOption(IDS.smoker);
    await named(3, "operator").selectOption("=");
    await named(3, "answer").selectOption("Yes");
    await add.click(); // condition 4: Consent? is answered (the default)
    check("a fourth: both unused conditions named", (await errorText()) === "Conditions 3 and 4 aren't used.", await errorText());

    // ---------- the check waits for a pause in typing ----------
    await logic.fill("1 AND (2");
    check("no new message while typing", (await errorText()) === "Conditions 3 and 4 aren't used.", await errorText());
    await sleep(900);
    check("after a pause the text is checked", (await errorText()) === "A bracket isn't closed.", await errorText());

    // ---------- every §15.7 invalid row, word for word ----------
    const invalid = [
      ["1 AND 2 OR 3 AND 4", "Add brackets to show whether AND or OR comes first."],
      ["1 AND (2 OR 3", "A bracket isn't closed."],
      ["1 AND 2) OR 3", "There's a closing bracket without an opening one."],
      ["1 AND 2 AND 3", "Condition 4 isn't used."],
      ["1 AND 2 AND 3 AND 5", "There's no condition 5."],
      ["1 AND 02 AND 3 AND 4", "There's no condition 02."],
      ["1 XOR 2", '"XOR" isn\'t allowed. Use condition numbers, AND, OR and brackets.'],
      ["1 2 AND 3 AND 4", "Add AND or OR between 1 and 2."],
      ["1 AND () AND 3", "Brackets can't be empty."],
      ["1AND2 AND 3 AND 4", '"1AND2" isn\'t allowed. Use condition numbers, AND, OR and brackets.'],
    ];
    for (const [text, message] of invalid) {
      await typeLogic(text);
      check(`§15.7 ${text} → ${message}`, (await errorText()) === message && (await logic.getAttribute("aria-invalid")) === "true", await errorText());
    }
    await typeLogic("1 OR (2 AND (3 OR 4))");
    check("a valid mixed text clears the error", (await errorText()) === "" && (await logic.getAttribute("aria-invalid")) === null);

    // ---------- an empty field: shown, and save refused ----------
    const beforeEmpty = await rows();
    await typeLogic("");
    check("clearing the field entirely: Enter how the conditions combine", (await errorText()) === "Enter how the conditions combine, e.g. 1 AND 2.", await errorText());
    await saveBtn.click();
    const notice = page.getByText(/^Couldn't save:/);
    await notice.waitFor({ timeout: 10000 });
    check("save refused with the same message, naming the block",
      (await notice.innerText()).includes('Couldn\'t save: Block "Dietary needs": Enter how the conditions combine, e.g. 1 AND 2.'), await notice.innerText());
    await typeLogic("1 AND (2 OR 3");
    await saveBtn.click();
    await page.getByText('Couldn\'t save: Block "Dietary needs": A bracket isn\'t closed.').waitFor({ timeout: 10000 }).catch(() => {});
    check("save refused while invalid: inline message and save message agree",
      (await errorText()) === "A bracket isn't closed." && (await page.getByText('Couldn\'t save: Block "Dietary needs": A bracket isn\'t closed.').count()) === 1);
    check("refused saves created no versions", (await rows()) === beforeEmpty);

    // ---------- deleting a condition the text uses ----------
    await typeLogic("1 OR (2 AND (3 OR 4))");
    await remove(2).click();
    const refusal = aside.getByText("Condition 2 is used in the logic. Remove it from the logic first.");
    check("deleting a condition the text uses is refused", await refusal.isVisible());
    check("…nothing changes", JSON.stringify(await numbered()) === '["Condition 1","Condition 2","Condition 3","Condition 4"]' && (await logic.inputValue()) === "1 OR (2 AND (3 OR 4))");
    check("…focus stays on its Remove button", (await focused()) === "Remove condition 2", await focused());
    const region = refusal.locator("xpath=ancestor::*[@aria-live='polite'][1]");
    check("…the message is in a polite live region that describes the button",
      (await region.count()) === 1 && (await remove(2).getAttribute("aria-describedby")) === (await region.getAttribute("id")));
    await typeLogic("1AND2 OR (3");
    await remove(2).click();
    check("…also when the text has other errors", await refusal.isVisible() && (await numbered()).length === 4);

    await typeLogic("1 OR (3 AND 4)");
    check("condition 2 now unused", (await errorText()) === "Condition 2 isn't used.");
    await remove(2).click();
    check("an allowed delete renumbers the text: 1 OR (3 AND 4) → 1 OR (2 AND 3)", (await logic.inputValue()) === "1 OR (2 AND 3)", await logic.inputValue());
    check("…and the conditions renumber", JSON.stringify(await numbered()) === '["Condition 1","Condition 2","Condition 3"]'
      && (await named(2, "question").inputValue()) === IDS.smoker && (await named(3, "question").inputValue()) === IDS.consent);
    check("…the text is valid again, the refusal gone", (await errorText()) === "" && (await refusal.count()) === 0);

    // ---------- save, reload: the text exactly as typed ----------
    const exact = "((1)) or  (2 AND 3)";
    await typeLogic(exact);
    const beforeSave = await rows();
    await save();
    check("save accepted, one new version", (await rows()) === beforeSave + 1);
    check("stored: the text exactly as typed, spacing and redundant brackets included",
      (await stored(formId)).blocks.find((b) => b.id === IDS.diet).enableLogicText === exact);
    await page.reload();
    await page.getByText("All changes saved").waitFor();
    await select(IDS.diet);
    check("after reload: the text exactly as typed", (await logic.inputValue()) === exact, await logic.inputValue());
    check("after reload: conditions as built",
      (await named(1, "question").inputValue()) === IDS.attend && (await named(1, "operator").inputValue()) === "="
      && (await named(1, "answer").locator("option:checked").textContent()) === "Yes"
      && (await named(2, "question").inputValue()) === IDS.smoker && (await named(3, "question").inputValue()) === IDS.consent);
    check("after reload: Save is disabled (nothing changed)", await saveBlocked());

    // ---------- download: the §15.4 shapes ----------
    const ids = (await stored(formId)).blocks.find((b) => b.id === IDS.diet).enableWhen.map((c) => c.id);
    let { art } = await download();
    let diet = art.blocks.find((b) => b.id === IDS.diet);
    check("download: the conditions, with their stored ids",
      JSON.stringify(noIds(diet.enableWhen)) === JSON.stringify([
        { question: IDS.attend, operator: "=", answer: "yes" }, { question: IDS.smoker, operator: "=", answer: "yes" }, { question: IDS.consent, operator: "exists" },
      ]) && hasIds(diet.enableWhen) && JSON.stringify(diet.enableWhen.map((c) => c.id)) === JSON.stringify(ids), JSON.stringify(diet.enableWhen));
    check("download: mixed logic as a tree", JSON.stringify(diet.enableLogic) === JSON.stringify({ any: [ids[0], { all: [ids[1], ids[2]] }] }) && !("enableBehavior" in diet),
      JSON.stringify(diet.enableLogic));
    check("download: never the logic text", !JSON.stringify(art).includes("enableLogicText"));
    check("download: blocks without conditions carry no logic", art.blocks.filter((b) => b.id !== IDS.diet).every((b) => !["enableWhen", "enableBehavior", "enableLogic"].some((k) => k in b)));

    await typeLogic("1 and 2 and 3");
    await save();
    diet = (await download()).art.blocks.find((b) => b.id === IDS.diet);
    check("download: all-AND exports neither enableLogic nor enableBehavior", !("enableLogic" in diet) && !("enableBehavior" in diet));
    await typeLogic("3 OR 2 OR 1");
    await save();
    diet = (await download()).art.blocks.find((b) => b.id === IDS.diet);
    check("download: all-OR exports enableBehavior any", diet.enableBehavior === "any" && !("enableLogic" in diet));

    // ---------- down to one condition ----------
    await typeLogic("1");
    await remove(3).click();
    await remove(2).click();
    check("one condition left: the Logic field is gone", (await logic.count()) === 0 && JSON.stringify(await numbered()) === '["Condition 1"]');
    await save();
    const one = (await stored(formId)).blocks.find((b) => b.id === IDS.diet);
    check("saved with one condition: no text", one.enableWhen.length === 1 && !("enableLogicText" in one));
    art = (await download()).art;
    diet = art.blocks.find((b) => b.id === IDS.diet);
    check("download with one condition: the condition only",
      JSON.stringify(noIds(diet.enableWhen)) === JSON.stringify([{ question: IDS.attend, operator: "=", answer: "yes" }]) && hasIds(diet.enableWhen)
      && !["enableBehavior", "enableLogic", "enableLogicText"].some((k) => k in diet), JSON.stringify(diet));

    // ================= blocked actions =================
    const refused = async (re) => {
      await alert.waitFor({ timeout: 3000 });
      const text = await alert.innerText();
      return re.test(text) && text.includes("Dietary needs →") ? text : null;
    };
    const dismiss = () => page.getByRole("button", { name: "Dismiss" }).click();

    // (a) delete a source
    await card(IDS.attend).hover();
    await card(IDS.attend).getByRole("button", { name: "Delete" }).click();
    const delText = await refused(/Can't delete "Attending\?"/);
    check("delete source -> refused, dependents named", delText && (await card(IDS.attend).count()) === 1, delText ?? await alert.innerText().catch(() => ""));
    await page.getByRole("button", { name: "Dietary needs →" }).click();
    check("'jump to' selects the dependent", (await page.locator("aside input").first().inputValue()) === "Dietary needs");
    await dismiss();

    // (b) moves — first prove drag works at all with an allowed move.
    // A pointer near the canvas's top or bottom edge makes dnd-kit scroll it, by an amount that
    // depends on timing, which moves the target away from where it was measured. So both cards
    // are brought to the middle of the canvas first, and the target is measured again once the
    // card is picked up, and on every small step towards it.
    // Resolves once the card has kept still for 10 animation frames running (or after ~5s).
    const still = (id) => page.evaluate((id) => new Promise((resolve) => {
      const el = document.querySelector(`[data-block-id="${id}"]`);
      let last = null, same = 0, frames = 0;
      const tick = () => {
        const y = el.getBoundingClientRect().top;
        same = y === last ? same + 1 : 0;
        last = y;
        if (same >= 10 || ++frames > 300) resolve(y);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), id);
    // Scrolls the canvas so the span from one card to the other sits at its middle.
    async function centre(fromId, toId) {
      await page.evaluate(([a, b]) => {
        const els = [a, b].map((id) => document.querySelector(`[data-block-id="${id}"]`));
        let s = els[0].parentElement;
        while (s && !(/auto|scroll/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight)) s = s.parentElement;
        s = s ?? document.scrollingElement;
        const box = s === document.scrollingElement ? { top: 0, height: innerHeight } : s.getBoundingClientRect();
        const rects = els.map((e) => e.getBoundingClientRect());
        const mid = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
        s.scrollTop += mid - (box.top + box.height / 2);
      }, [fromId, toId]);
      await still(fromId);
      await still(toId);
    }
    async function drag(fromId, toId) {
      await centre(fromId, toId);
      await card(fromId).hover();
      const g = await card(fromId).getByRole("button", { name: "Drag to reorder" }).boundingBox();
      const x = g.x + g.width / 2;
      let y = g.y + g.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      y += 12;
      await page.mouse.move(x, y, { steps: 4 }); // past the 5px activation distance: picked up
      await still(toId);
      // Aim past the target's near edge in the direction of travel, so the dragged
      // card's centre (the grip is at its top) clearly passes the target.
      const goingUp = (await card(toId).boundingBox()).y < y;
      for (let i = 0; i < 200; i++) {
        const t = await card(toId).boundingBox();
        const aim = goingUp ? t.y - 4 : t.y + t.height + 30;
        if (Math.abs(aim - y) < 1) break;
        y += Math.sign(aim - y) * Math.min(4, Math.abs(aim - y));
        await page.mouse.move(x, y);
      }
      await sleep(150);
      await page.mouse.up();
      await sleep(400);
    }
    const order = () => page.locator("[data-block-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-block-id")));
    await drag(IDS.sessions, IDS.diet);
    const o1 = await order();
    check("allowed move works (Sessions above Dietary)", o1.indexOf(IDS.sessions) < o1.indexOf(IDS.diet), o1.join(","));

    await drag(IDS.diet, IDS.attend); // dependent above its source
    const up = await refused(/Can't move "Dietary needs" there/);
    check("move dependent above its source -> refused, dependent named", up && JSON.stringify(await order()) === JSON.stringify(o1), up ?? "");
    await dismiss();

    await drag(IDS.attend, IDS.diet); // source below its dependent
    const down = await refused(/Can't move "Attending\?" there/);
    check("move source below its dependent -> refused, dependent named", down && JSON.stringify(await order()) === JSON.stringify(o1), down ?? "");
    await dismiss();

    // (c) rename / remove an option used as an answer. Conditions store the code (contract §13.4),
    // so renaming the label is always allowed; removing the option is still refused.
    await select(IDS.attend);
    await page.locator("#options-0-label").press("End");
    await page.locator("#options-0-label").press("!");
    await page.locator("#options-0-label").blur();
    check("rename an option used as an answer -> allowed; its code stays",
      (await page.locator("#options-0-label").inputValue()) === "Yes!" && (await page.locator("#options-0-code").inputValue()) === "yes" && (await alert.count()) === 0);
    await page.getByRole("button", { name: "Remove option 1" }).click(); // "Yes!"
    const rem = await refused(/Can't remove "Yes!" — these blocks have conditions that use it:/);
    check("remove an option used as an answer -> refused", rem && (await page.locator("#options-0-label").inputValue()) === "Yes!", rem ?? "");
    await dismiss();
    await page.getByRole("button", { name: "Remove option 2" }).click(); // "No" — unused
    check("removing an unused option is allowed", (await page.locator('aside input[value="No"]').count()) === 0 && (await alert.count()) === 0);
    await select(IDS.diet);
    check("the condition shows the renamed label", (await named(1, "answer").locator("option:checked").textContent()) === "Yes!");

    // ================= content saved before logic text opens clean =================
    const legacyBlocks = [yesNo("a", "Smokes?"), yesNo("b", "Drinks?"),
      { id: "d", type: "short", label: "Support", enableWhen: [yes("a"), yes("b")], enableBehavior: "any" }];
    const apiFormId = await create("Through the API");
    await putTo(apiFormId, { title: "Through the API", blocks: legacyBlocks });
    await page.goto(`${WEB}/app/forms/${apiFormId}/edit`);
    await page.getByText("All changes saved").waitFor();
    await select("d");
    check("created through the API (2 conditions, no ids or text, enableBehavior any): Logic shows 1 OR 2, Save disabled",
      (await logic.inputValue()) === "1 OR 2" && await saveBlocked(), await logic.inputValue());

    // A version stored before this change, never saved through the new API: no ids, no text.
    const legacyFormId = await create("Stored before logic text");
    await putTo(legacyFormId, { title: "Stored before logic text", blocks: [yesNo("a", "Smokes?")] });
    await prisma.formVersion.create({ data: { formId: legacyFormId, version: (await prisma.formVersion.count({ where: { formId: legacyFormId } })) + 1, schema: { title: "Stored before logic text", blocks: legacyBlocks } } });
    await page.goto(`${WEB}/app/forms/${legacyFormId}/edit`);
    await page.getByText("All changes saved").waitFor();
    await select("d");
    check("stored without ids or text: opens with Logic 1 OR 2 and Save disabled", (await logic.inputValue()) === "1 OR 2" && await saveBlocked(), await logic.inputValue());
    const legacyArt = (await download()).art.blocks.find((b) => b.id === "d");
    check("…and downloads with ids c1, c2 and enableBehavior any",
      JSON.stringify(legacyArt.enableWhen.map((c) => c.id)) === '["c1","c2"]' && legacyArt.enableBehavior === "any", JSON.stringify(legacyArt));

    // ================= the delete dialogs describe mixed logic =================
    const pagesId = await create("Delete wording");
    const three = [yes("a", "c1"), yes("b", "c2"), yes("c", "c3")];
    const pagesSaved = await putTo(pagesId, { title: "Delete wording", blocks: [
      { id: "p1", type: "page", title: "Screening", blocks: [yesNo("a", "Smokes?"), yesNo("b", "Drinks?"), yesNo("c", "Under 18?")] },
      { id: "p2", type: "page", title: "Extra", enableWhen: three, enableLogicText: "1 OR (2 AND 3)", blocks: [
        { id: "x", type: "short", label: "Notes" },
        { id: "g", type: "group", label: "Habits", enableWhen: three, enableLogicText: "(1 OR 2) AND 3", blocks: [{ id: "y", type: "short", label: "Details" }] },
      ] },
      { id: "p3", type: "page", title: "Last", enableWhen: three, enableLogicText: "1 AND (2 OR 3)", blocks: [{ id: "z", type: "short", label: "Comments" }] },
    ] });
    check("a paged form with mixed logic on two pages and a group saves", pagesSaved.status === 200, await pagesSaved.clone().text());
    await page.goto(`${WEB}/app/forms/${pagesId}/edit`);
    await page.getByText("All changes saved").waitFor();
    const dialog = page.getByRole("dialog");
    const A = "Smokes? is Yes", B = "Drinks? is Yes", C = "Under 18? is Yes";

    await card("p3").getByRole("button", { name: "Delete page" }).click();
    await dialog.waitFor();
    let text = await dialog.innerText();
    check("delete page: its own mixed logic, in words",
      text.includes(`The conditions 'Show when ${A}' and ('Show when ${B}' or 'Show when ${C}') will no longer apply to this question.`), text);
    check("delete page: the logic of the page its contents move into, in words",
      text.includes(`This question will move to 'Extra' and will only show when ${A} or (${B} and ${C}).`), text);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await card("g").getByRole("button", { name: "Delete group" }).click();
    await dialog.waitFor();
    text = await dialog.innerText();
    check("delete group: its mixed logic, in words",
      text.includes(`The conditions ('Show when ${A}' or 'Show when ${B}') and 'Show when ${C}' will no longer apply to this question.`), text);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await select("g");
    await typeLogic("1 OR (2");
    await card("g").getByRole("button", { name: "Delete group" }).click();
    await dialog.waitFor();
    text = await dialog.innerText();
    check("delete group with logic text that doesn't parse: the conditions listed, with the text as typed",
      text.includes(`The conditions 'Show when ${A}', 'Show when ${B}', 'Show when ${C}' (combined as "1 OR (2") will no longer apply to this question.`), text);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // ================= render with @zoworkhq/zoforms (optional) =================
    const renderId = await create("Builder logic");
    await putTo(renderId, { title: "Builder logic", blocks: [
      yesNo("smokes", "Smokes?"), yesNo("drinks", "Drinks?"), yesNo("minor", "Under 18?"),
      { id: "support", type: "short", label: "Support needed", enableWhen: [yes("smokes"), yes("drinks"), yes("minor")], enableLogicText: "1 OR (2 AND 3)" },
      { id: "anything", type: "short", label: "Anything else" },
    ] });
    await page.goto(`${WEB}/app/forms/${renderId}/edit`);
    await page.getByText("All changes saved").waitFor();
    const renderDl = await download();
    const support = renderDl.art.blocks.find((b) => b.id === "support");
    const sIds = support.enableWhen.map((c) => c.id);
    check("render form: downloaded with 1 OR (2 AND 3) as a tree", JSON.stringify(support.enableLogic) === JSON.stringify({ any: [sIds[0], { all: [sIds[1], sIds[2]] }] }));
    saveArtifact(ARTIFACT, renderDl.raw);

    if (!EXTERNAL_APP) {
      console.log("  SKIP  render in the external test app (set E2E_EXTERNAL_APP_URL and E2E_EXTERNAL_FORMS_DIR to run it)");
    } else if (!process.env.E2E_EXTERNAL_FORMS_DIR || !fs.existsSync(path.join(process.env.E2E_EXTERNAL_FORMS_DIR, ARTIFACT))) {
      check("render: E2E_EXTERNAL_FORMS_DIR is set, so the app has this run's artifact", false, "set E2E_EXTERNAL_FORMS_DIR to the test app's src/forms");
    } else {
      // Condition ids and enableLogic need 0.20.0 or later. Anything older: say so and don't render.
      const appRoot = path.join(process.env.E2E_EXTERNAL_FORMS_DIR, "..", "..");
      const installed = path.join(appRoot, "node_modules", "@zoworkhq", "zoforms", "package.json");
      const version = fs.existsSync(installed) ? JSON.parse(fs.readFileSync(installed, "utf8")).version : "not installed";
      const [maj, min] = version.split(".").map(Number);
      const recent = maj > 0 || min >= 20;
      check("render: the test app has @zoworkhq/zoforms 0.20.0 or later", recent, version);
      if (recent) {
        // Restart the test app's API: it runs under `node --watch`, which restarts on a change to its entry file.
        const server = path.join(appRoot, "server", "index.mjs");
        const now = new Date();
        fs.utimesSync(server, now, now);
        await sleep(2500);
        const submissions = new URL("api/submissions", EXTERNAL_APP.endsWith("/") ? EXTERNAL_APP : EXTERNAL_APP + "/");
        let up = false;
        for (let i = 0; i < 30 && !up; i++) { try { up = (await fetch(submissions)).ok; } catch {} if (!up) await sleep(1000); }
        check("render: the test app's API restarted and answers", up);

        const R = await ctx.newPage();
        R.on("pageerror", (e) => check("render: no page errors", false, e.message));
        await R.goto(`${EXTERNAL_APP}${EXTERNAL_APP.includes("?") ? "&" : "?"}form=builder-logic`);
        const answer = (question, option) => R.getByRole("group", { name: question, exact: true }).getByRole("radio", { name: option, exact: true }).check();
        await R.getByRole("group", { name: "Smokes?", exact: true }).waitFor({ timeout: 15000 });
        const supportBox = R.getByLabel("Support needed", { exact: true });
        const shown = async () => (await supportBox.count()) > 0 && await supportBox.isVisible();
        check("render: the form loads, Support needed hidden at first", !(await shown()));
        await answer("Drinks?", "Yes");
        check("render: 2 alone → hidden", !(await shown()));
        await answer("Under 18?", "Yes");
        await supportBox.waitFor({ timeout: 5000 }).catch(() => {});
        check("render: 2 AND 3 → shown", await shown());
        await supportBox.fill("Needs a counsellor");
        await answer("Under 18?", "No");
        await sleep(300);
        check("render: 3 false again → hidden", !(await shown()));
        await answer("Smokes?", "Yes");
        await supportBox.waitFor({ timeout: 5000 }).catch(() => {});
        check("render: 1 alone → shown, the answer kept", await shown() && (await supportBox.inputValue()) === "Needs a counsellor");
        await R.screenshot({ path: `${OUT}/logic-6-render.png`, fullPage: true });
        await answer("Smokes?", "No");
        await sleep(300);
        check("render: all false → hidden", !(await shown()));
        await R.getByLabel("Anything else", { exact: true }).fill("No");
        const [res] = await Promise.all([
          R.waitForResponse((x) => /\/api\/submit$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 15000 }),
          R.getByRole("button", { name: "Submit", exact: true }).click(),
        ]);
        check("render: submits (201)", res.status() === 201, String(res.status()));
        const sent = JSON.parse(res.request().postData()).answers;
        check("payload: the hidden answer is not submitted", !("support" in sent) && "smokes" in sent && "anything" in sent, JSON.stringify(sent));
        await R.close();
      }
    }

    // ================= the API rejects every invalid condition =================
    const clone = () => JSON.parse(JSON.stringify(seed));
    const withCond = (blockId, cond, mutate) => {
      const s = clone();
      if (mutate) mutate(s);
      s.blocks.find((b) => b.id === blockId).enableWhen = [cond];
      return s;
    };
    const cases = [
      ["unknown block id", withCond(IDS.diet, { question: "b_nope", operator: "exists" }), /Block "Dietary needs": .*isn't in this form/],
      ["source below dependent", withCond(IDS.attend, { question: IDS.diet, operator: "exists" }), /Block "Attending\?": .*comes after it/],
      ["self-reference", withCond(IDS.diet, { question: IDS.diet, operator: "exists" }), /Block "Dietary needs": .*itself/],
      ["layout source (heading)", withCond(IDS.diet, { question: IDS.intro, operator: "exists" }), /"Intro" is a heading block/],
      ["matrix source", withCond(IDS.diet, { question: "b_matrix01", operator: "exists" }, (s) =>
        s.blocks.splice(1, 0, { id: "b_matrix01", type: "matrix", label: "Grid", required: false, options: opts("r"), columns: opts("c") })), /"Grid" is a matrix block/],
      ["hidden source", withCond(IDS.diet, { question: "b_hidden01", operator: "exists" }, (s) =>
        s.blocks.splice(1, 0, { id: "b_hidden01", type: "hidden", label: "Ref", required: false })), /"Ref" is a hidden block/],
      ["operator not allowed", withCond(IDS.diet, { question: IDS.attend, operator: ">", answer: "Yes" }), /operator ">" can't be used with "Attending\?"/],
      ["contains on a single choice", withCond(IDS.diet, { question: IDS.attend, operator: "contains", answer: "Yes" }), /operator "contains"/],
      ["answer not an option", withCond(IDS.diet, { question: IDS.attend, operator: "=", answer: "Perhaps" }), /answer "Perhaps" isn't the code of any option of "Attending\?"/],
      ["exists with an answer", withCond(IDS.diet, { question: IDS.attend, operator: "exists", answer: "Yes" }), /^Block "Dietary needs" \(enableWhen\.0\.answer\): "exists" takes no answer/],
      ["= without an answer", withCond(IDS.diet, { question: IDS.attend, operator: "=" }), /^Block "Dietary needs" \(enableWhen\.0\.answer\)/],
      ["duplicate block ids", (() => { const s = clone(); s.blocks[6].id = IDS.diet; return s; })(), /same id "b_diet0001"/],
    ];
    const rowsBefore = await rows();
    for (const [name, body, re] of cases) {
      const res = await put(body);
      const msg = (await res.json()).message;
      check(`API rejects: ${name}`, res.status === 400 && re.test(msg), `${res.status} ${msg}`);
    }
    check("rejected saves created no versions", (await rows()) === rowsBefore);
    console.log("  404s seen:", [...new Set(notFound)].join(", ") || "none");
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
