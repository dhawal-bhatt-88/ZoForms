// Conditional logic end to end: build a condition in the real editor (Edge),
// save/reload/download it, exercise the refusal guards, and hit the API directly
// with every invalid case.
const fs = require("fs");
const { API, WEB, PrismaClient, launchBrowser, opts } = require("./_setup");
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

// Seed blocks (the condition itself is built in the UI).
const IDS = { intro: "b_intro001", attend: "b_attend01", guests: "b_guests01", diet: "b_diet0001", sessions: "b_sess0001" };
const seed = {
  title: "Logic verify",
  blocks: [
    { id: IDS.intro, type: "heading", label: "Intro", required: false, level: 2 },
    { id: IDS.attend, type: "choice", label: "Attending?", required: false, options: opts("Yes", "No", "Maybe") },
    { id: IDS.guests, type: "number", label: "Guests", required: false },
    { id: IDS.diet, type: "short", label: "Dietary needs", required: false },
    { id: IDS.sessions, type: "checkbox", label: "Sessions", required: false, options: opts("A", "B") },
  ],
};

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
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Logic verify" }) })).json();
    const put = (schema) => fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const seeded = await put(seed);
    if (seeded.status !== 200) throw new Error("seed failed " + seeded.status + " " + (await seeded.text()));
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });

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
    const card = (id) => page.locator(`[data-block-id="${id}"]`);
    const alert = page.getByRole("alert").filter({ hasText: /Can't/ }); // not Next's empty route announcer
    const select = (id) => card(id).click({ position: { x: 60, y: 12 } });

    await page.goto(`${WEB}/app/forms/${form.id}/edit`);
    await page.getByText("All changes saved").waitFor();

    // ---------- build a condition in the UI ----------
    await select(IDS.diet);
    await page.getByText("Show this question only when…").waitFor();
    await page.getByRole("button", { name: "Add condition" }).click();
    const qSel = page.getByRole("combobox", { name: "Question" });
    const opSel = page.getByRole("combobox", { name: "Condition" });
    const sourceChoices = await qSel.first().locator("option").allTextContents();
    check("source list = only eligible questions above (no heading, nothing below)",
      JSON.stringify(sourceChoices) === JSON.stringify(["1. Attending?", "2. Guests"]) /* only answerable questions are numbered (contract §4) */, sourceChoices.join(" | "));
    check("new condition defaults to nearest question, 'is answered'",
      (await qSel.first().inputValue()) === IDS.guests && (await opSel.first().inputValue()) === "exists");

    await qSel.first().selectOption(IDS.attend);
    const opText = await opSel.first().locator("option").allTextContents();
    check("choice source offers is answered / is / is not", JSON.stringify(opText) === JSON.stringify(["is answered", "is", "is not"]), opText.join(" | "));
    await opSel.first().selectOption("=");
    const ansSel = page.getByRole("combobox", { name: "Answer" });
    const ansChoices = await ansSel.first().locator("option").allTextContents();
    check("choice answer is an options dropdown", JSON.stringify(ansChoices) === JSON.stringify(["Yes", "No", "Maybe"]), ansChoices.join(" | "));
    await ansSel.first().selectOption("Yes");

    await page.getByRole("button", { name: "Add condition" }).click();
    await qSel.nth(1).selectOption(IDS.guests);
    const numOps = await opSel.nth(1).locator("option").allTextContents();
    check("number source adds greater/less comparisons", numOps.includes("is greater than") && numOps.includes("is at most"), numOps.join(" | "));
    await opSel.nth(1).selectOption(">");
    const numBox = page.getByRole("spinbutton", { name: "Answer" });
    await numBox.fill("2");
    await page.getByRole("button", { name: "Any", exact: true }).click();
    check("'Conditional' badge on the block", await card(IDS.diet).getByText("Conditional").isVisible());

    // ---------- save, reload, download ----------
    const beforeSave = await rows();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("All changes saved").waitFor();
    check("save accepted, one new version", (await rows()) === beforeSave + 1);

    await page.reload();
    await page.getByText("All changes saved").waitFor();
    await select(IDS.diet);
    check("condition survives reload",
      (await qSel.nth(0).inputValue()) === IDS.attend && (await opSel.nth(0).inputValue()) === "=" &&
      (await ansSel.first().locator("option:checked").textContent()) === "Yes" && (await qSel.nth(1).inputValue()) === IDS.guests &&
      (await opSel.nth(1).inputValue()) === ">" && (await numBox.inputValue()) === "2");
    check("All/Any survives reload", (await page.getByRole("button", { name: "Any", exact: true }).getAttribute("class")).includes("bg-ink"));

    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    const art = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    const diet = art.blocks.find((b) => b.id === IDS.diet);
    const expected = `[{"question":"${IDS.attend}","operator":"=","answer":"yes"},{"question":"${IDS.guests}","operator":">","answer":2}]`;
    check("artifact enableWhen exactly as specified", JSON.stringify(diet.enableWhen) === expected, JSON.stringify(diet.enableWhen));
    check("artifact enableBehavior 'any'", diet.enableBehavior === "any");
    check("blocks without conditions carry no enableWhen", art.blocks.filter((b) => b.id !== IDS.diet).every((b) => !("enableWhen" in b) && !("enableBehavior" in b)));

    // ---------- blocked actions ----------
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

    // (b) moves — first prove drag works at all with an allowed move
    async function drag(fromId, toId) {
      await card(fromId).hover();
      const g = await card(fromId).getByRole("button", { name: "Drag to reorder" }).boundingBox();
      const t = await card(toId).boundingBox();
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + 12, { steps: 4 });
      // Aim past the target's near edge in the direction of travel, so the dragged
      // card's centre (the grip is at its top) clearly passes the target.
      const goingUp = t.y < g.y;
      await page.mouse.move(t.x + t.width / 2, goingUp ? t.y - 4 : t.y + t.height + 30, { steps: 25 });
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
    check("the condition shows the renamed label", (await page.getByRole("combobox", { name: "Answer" }).first().locator("option:checked").textContent()) === "Yes!");

    // ---------- API rejects every invalid case directly ----------
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
      ["duplicate block ids", (() => { const s = clone(); s.blocks[4].id = IDS.diet; return s; })(), /same id "b_diet0001"/],
    ];
    const rowsBefore = await rows();
    for (const [name, body, re] of cases) {
      const r = await put(body);
      const msg = (await r.json()).message;
      check(`API rejects: ${name}`, r.status === 400 && re.test(msg), `${r.status} ${msg}`);
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
