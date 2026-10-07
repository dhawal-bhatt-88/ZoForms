// progressStyle: the Navigation settings UI, then Save + Download with "Bar and text".
const fs = require("fs");
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

const leaf = (id, label, type = "short", extra = {}) => ({ id, type, label, required: false, ...extra });
const page = (id, title, blocks, extra = {}) => ({ id, type: "page", title, blocks, ...extra });
const YN = { options: opts("Yes", "No") };
const PAGED = {
  title: "Progress style",
  blocks: [
    page("p1", "About you", [leaf("name", "Full name", "short", { required: true }), leaf("meds", "Do you take any regular medication?", "choice", { ...YN, required: true })]),
    page("p2", "Medication", [leaf("drug", "Medication name")], { enableWhen: [{ question: "meds", operator: "=", answer: "yes" }] }),
    page("p3", "Lifestyle", [leaf("smoke", "Do you smoke?", "choice", YN)]),
  ],
};

(async () => {
  const email = `verify-progress-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Progress" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const make = async (schema) => {
      const f = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: schema.title }) })).json();
      const r = await fetch(`${API}/v1/forms/${f.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
      if (!r.ok) throw new Error(`save: ${r.status} ${await r.text()}`);
      return f.id;
    };
    const pagedId = await make(PAGED);
    const unpagedId = await make({ title: "No pages", blocks: [leaf("q", "Question")] });

    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    P.on("dialog", (d) => d.accept());
    const deselect = () => P.locator('input[placeholder="Add a description…"]').click();
    const open = async (id) => { await P.goto(`${WEB}/app/forms/${id}/edit`); await P.getByText("All changes saved").waitFor(); await deselect(); };
    const progress = () => P.getByRole("checkbox", { name: /Show progress/ });
    const styleGroup = () => P.getByRole("group", { name: "Progress style" });
    const textOnly = () => P.getByRole("radio", { name: "Text only (“Step 2 of 5”)" });
    const bar = () => P.getByRole("radio", { name: "Bar and text" });
    const clean = () => P.getByText("All changes saved").isVisible();

    // ---------- settings UI ----------
    await open(unpagedId);
    check("no Progress style on a form without pages", (await styleGroup().count()) === 0);

    await open(pagedId);
    check("Progress style sits in Navigation, with two choices", await styleGroup().isVisible() && await textOnly().isVisible() && await bar().isVisible());
    check('the default is "Text only"', await textOnly().isChecked() && !(await bar().isChecked()));
    check("enabled while Show progress is on", await progress().isChecked() && await textOnly().isEnabled() && await bar().isEnabled());
    check("help text says the client's app can override it", await P.getByText("The client's app can override this with its own setting.").isVisible());

    await bar().check();
    check('choosing "Bar and text" is an unsaved change', !(await clean()));
    await textOnly().check();
    check("…and choosing the default again leaves the form unchanged (defaults aren't stored)", await clean());

    await bar().check();
    await progress().uncheck();
    check("disabled when Show progress is off", await bar().isDisabled() && await textOnly().isDisabled());
    check("…keeping the author's choice", await bar().isChecked());
    await P.locator("aside").getByText("Navigation", { exact: true }).scrollIntoViewIfNeeded();
    await sleep(200);
    await P.screenshot({ path: `${OUT}/progress-1-disabled.png` });
    await progress().check();
    check("enabled again when progress is back on, still Bar and text", await bar().isEnabled() && await bar().isChecked());
    await sleep(200);
    await P.screenshot({ path: `${OUT}/progress-2-bar-and-text.png` });

    // ---------- Save + Download ----------
    await P.getByRole("button", { name: "Save", exact: true }).click();
    await P.getByText("All changes saved").waitFor({ timeout: 10000 });
    const stored = (await prisma.formVersion.findFirst({ where: { formId: pagedId }, orderBy: { version: "desc" } })).schema.navigation;
    check('stored: only the non-default value, { progressStyle: "bar" }', JSON.stringify(stored) === '{"progressStyle":"bar"}', JSON.stringify(stored));
    const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    const art = JSON.parse(raw);
    check('artifact navigation: { showProgress: true, progressStyle: "bar", reviewPage: false }',
      JSON.stringify(art.navigation) === '{"showProgress":true,"progressStyle":"bar","reviewPage":false}' && art.schemaVersion === 2, JSON.stringify(art.navigation));
    saveArtifact("phase7-progress-bar-schema.json", raw);
    await P.reload();
    await P.getByText("All changes saved").waitFor();
    await deselect();
    check("the choice survives a reload", await bar().isChecked());
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/progress-failure.png` }); } catch {}
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
