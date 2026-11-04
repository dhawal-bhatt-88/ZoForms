// Multi-select, no longer in the insert menu (docs/briefs/BUILDER-BRIEF-RENDERER-0.28.1.md,
// item 5): a form that already has one still opens; the block can be selected, edited and
// deleted; its inspector says it's no longer offered (a Checkboxes question's doesn't); the
// form saves and downloads with the type unchanged, a condition on it and its option scores
// kept. The menu offers no Multi-select, by browsing or by search. With E2E_EXTERNAL_APP_URL
// set, the download is rendered in the external test app, answered and submitted; it borrows
// the app's ?form=builder-options slot, which verify-options.js writes again after it.
// apps/web/src/lib/multiselect-legacy.test.tsx renders and submits one with the real
// FormRenderer on every unit run.
const fs = require("fs");
const path = require("path");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact } = require("./_setup");
const prisma = new PrismaClient();

const EXTERNAL_APP = process.env.E2E_EXTERNAL_APP_URL;
const ARTIFACT = "builder-options-schema.json";
const NOT_OFFERED = "Multi-select is no longer offered. This question still works for respondents, the same as Checkboxes. For new questions, use Checkboxes.";

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
const o = (code, label, score) => ({ code, label, ...(score === undefined ? {} : { score }) });

(async () => {
  const email = `verify-multiselect-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Multi-select" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;

    // ---------- API: a form saved before Multi-select left the menu ----------
    const formId = await create("Languages");
    const r = await put(formId, { title: "Languages", blocks: [
      { id: "b_group001", type: "group", label: "About you",
        scores: [{ id: "s_langs001", label: "Languages score", formulaText: "langs", unanswered: "no-score" }],
        blocks: [
          { id: "b_langs001", type: "multiselect", label: "Which languages do you speak?", name: "langs", required: true,
            options: [o("english", "English", 1), o("french", "French", 2), o("spanish", "Spanish", 4)] },
          { id: "b_where001", type: "short", label: "Where did you learn French?", required: false,
            enableWhen: [{ question: "b_langs001", operator: "contains", answer: "french" }] },
        ] },
      { id: "b_diet0001", type: "multiselect", label: "Dietary needs", required: false, options: [o("vegetarian", "Vegetarian"), o("halal", "Halal")] },
      { id: "b_allerg01", type: "checkbox", label: "Allergies", required: false, options: [o("nuts", "Nuts"), o("gluten", "Gluten")] },
    ] });
    check("API: a form with two Multi-selects, one scored and one a condition's source, saves", r.status === 200, `${r.status} ${JSON.stringify(await r.json()).slice(0, 300)}`);

    // ---------- editor ----------
    browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    const card = (id) => P.locator(`[data-block-id="${id}"]`);
    const selectCard = async (id) => { await card(id).locator("span.truncate").first().click(); await P.locator("#block-label").waitFor(); };
    const note = () => P.locator("aside [data-not-offered]");
    const openMenu = async () => { await P.getByTitle("Insert a block").click(); await P.getByPlaceholder("Search blocks…").waitFor(); };
    const menuOptions = () => P.locator('[data-block-menu] [role="option"] [data-label]').allTextContents();
    const search = async (q) => { await P.getByPlaceholder("Search blocks…").fill(q); await sleep(100); return menuOptions(); };
    const save = async () => { await P.getByRole("button", { name: "Save", exact: true }).click(); await P.getByText("All changes saved").waitFor({ timeout: 10000 }); };
    const shot = async (name) => {
      for (const theme of ["light", "dark"]) {
        await P.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
        await sleep(250);
        await P.screenshot({ path: `${OUT}/multiselect-${name}-${theme}.png` });
      }
      await P.evaluate(() => document.documentElement.classList.remove("dark"));
    };

    await P.goto(`${WEB}/app/forms/${formId}/edit`);
    await P.getByText("All changes saved").waitFor();

    // The insert menu.
    await openMenu();
    const everything = await menuOptions();
    check("menu: Multi-select isn't offered", everything.includes("Checkboxes") && !everything.includes("Multi-select"), JSON.stringify(everything));
    for (const q of ["multi-select", "multiselect", "tags"]) {
      const found = await search(q);
      check(`menu: "${q}" matches nothing`, found.length === 0 && await P.getByText(`No blocks match “${q}”.`).isVisible(), JSON.stringify(found));
    }
    check('menu: "check" finds Checkboxes alone', JSON.stringify(await search("check")) === '["Checkboxes"]');
    check('menu: "multi" finds Multiple choice alone', JSON.stringify(await search("multi")) === '["Multiple choice"]');
    await P.keyboard.press("Escape");

    // The block opens as it did: its card previews checkboxes with its options.
    const langs = card("b_langs001");
    check("canvas: the Multi-select shows its label and its three options",
      await langs.getByText("Which languages do you speak?").first().isVisible() && (await Promise.all(["English", "French", "Spanish"].map((t) => langs.getByText(t, { exact: true }).isVisible()))).every(Boolean));

    // Selected: the inspector says it's no longer offered; a Checkboxes question's doesn't.
    await selectCard("b_langs001");
    check("inspector: a Multi-select says it's no longer offered, once", (await note().count()) === 1 && (await note().textContent()).replace(/\s+/g, " ").trim() === NOT_OFFERED, await note().textContent().catch(() => ""));
    check("inspector: its options are editable, with their scores", await P.locator("#options-2-label").isEditable() && (await P.locator("#options-2-label").inputValue()) === "Spanish");
    await shot("1-inspector");
    await selectCard("b_allerg01");
    check("inspector: a Checkboxes question says nothing about it", (await note().count()) === 0);

    // Edited and saved.
    await selectCard("b_langs001");
    await P.locator("#block-label").fill("Which languages do you use?");
    await P.locator("#options-2-label").fill("Spanish (Castilian)");
    await P.locator("#options-2-label").press("Tab");
    await save();
    let blocks = [...walk((await stored(formId)).blocks)];
    const saved = blocks.find((b) => b.id === "b_langs001");
    check("save: the edited Multi-select is still a multiselect, label and option changed, code and score kept",
      saved?.type === "multiselect" && saved.label === "Which languages do you use?"
        && JSON.stringify(saved.options) === JSON.stringify([o("english", "English", 1), o("french", "French", 2), o("spanish", "Spanish (Castilian)", 4)]),
      JSON.stringify(saved));
    check("save: the condition on it and the group's score are kept",
      blocks.find((b) => b.id === "b_where001")?.enableWhen?.[0]?.question === "b_langs001" && blocks.find((b) => b.id === "b_group001")?.scores?.[0]?.formulaText === "langs");

    // The other one is deleted.
    await selectCard("b_diet0001");
    await card("b_diet0001").getByRole("button", { name: "Delete", exact: true }).click();
    await save();
    blocks = [...walk((await stored(formId)).blocks)];
    check("delete: the deleted Multi-select is gone, the other stays", !blocks.some((b) => b.id === "b_diet0001") && blocks.some((b) => b.id === "b_langs001"));

    // Reopened: still there, still a Multi-select.
    await P.reload();
    await P.getByText("All changes saved").waitFor();
    await selectCard("b_langs001");
    check("reopened: it opens again, with the note", (await note().count()) === 1);

    // Download: the renderer's checks pass (Download refuses a file it would refuse).
    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    const art = JSON.parse(raw);
    const exported = [...walk(art.blocks)].find((b) => b.label === "Which languages do you use?");
    check("download: the Multi-select is exported as multiselect, with its codes and scores", exported?.type === "multiselect"
      && JSON.stringify(exported.options) === JSON.stringify([o("english", "English", 1), o("french", "French", 2), o("spanish", "Spanish (Castilian)", 4)]), JSON.stringify(exported));
    check("download: the score's tree refers to it", JSON.stringify(art.blocks[0].scores?.[0]?.formula) === JSON.stringify({ ref: "b_langs001" }), JSON.stringify(art.blocks[0].scores));
    // Here only: the test app gets a copy below, in a slot it already has.
    fs.writeFileSync(path.join(OUT, "builder-multiselect-schema.json"), raw);

    // ---------- render (optional) ----------
    if (!EXTERNAL_APP) {
      console.log("  SKIP  render in the external test app (set E2E_EXTERNAL_APP_URL and E2E_EXTERNAL_FORMS_DIR to run it)");
    } else if (!process.env.E2E_EXTERNAL_FORMS_DIR) {
      check("render: E2E_EXTERNAL_FORMS_DIR is set", false, "set E2E_EXTERNAL_FORMS_DIR to the test app's src/forms");
    } else {
      saveArtifact(ARTIFACT, raw);
      await sleep(1500); // let the app's dev server see the new file
      const R = await ctx.newPage();
      R.on("pageerror", (e) => check("render: no page errors", false, e.message));
      await R.goto(`${EXTERNAL_APP}${EXTERNAL_APP.includes("?") ? "&" : "?"}form=builder-options`);
      const group = R.getByRole("group", { name: "Which languages do you use?", exact: false });
      await group.waitFor({ timeout: 15000 });
      check("render: the condition hides the follow-up at first", (await R.getByLabel(/^Where did you learn French/).count()) === 0);
      await group.getByRole("checkbox", { name: "Spanish (Castilian)" }).check();
      await group.getByRole("checkbox", { name: "French" }).check();
      await R.getByLabel(/^Where did you learn French/).fill("At school");
      const [res] = await Promise.all([
        R.waitForResponse((x) => /\/api\/submit$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 15000 }),
        R.getByRole("button", { name: "Submit", exact: true }).click(),
      ]);
      check("render: submits (2xx)", res.status() >= 200 && res.status() < 300, String(res.status()));
      const sent = JSON.parse(res.request().postData());
      check("render: the body has the codes, in the order ticked",
        JSON.stringify(sent.answers.b_langs001) === JSON.stringify({ state: "answered", value: ["spanish", "french"] }), JSON.stringify(sent.answers));
      await R.getByText("Form submitted successfully.").waitFor({ timeout: 10000 });
      const all = await (await fetch(new URL("api/submissions", EXTERNAL_APP.endsWith("/") ? EXTERNAL_APP : EXTERNAL_APP + "/"))).json();
      const record = (Array.isArray(all) ? all : all.submissions ?? []).find((x) => x.idempotencyKey === sent.idempotencyKey);
      check("render: the test app stored it, with labels", JSON.stringify(record).includes('"label":"Spanish (Castilian)"'), JSON.stringify(record)?.slice(0, 400));
      await R.screenshot({ path: `${OUT}/multiselect-render.png`, fullPage: true });
      await R.close();
    }
    await fetch(`${API}/v1/forms/${formId}`, { method: "DELETE", headers: H });
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/multiselect-failure.png` }); } catch {}
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
