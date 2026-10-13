// Numeric answers for ordering operators + country conditions as a fixed dropdown,
// checked in the real editor (Edge) and directly against the API.
const fs = require("fs");
const { API, WEB, PrismaClient, launchBrowser, noIds, hasIds } = require("./_setup");
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

const COUNTRIES = ["United States", "United Kingdom", "Canada", "Australia", "India", "Germany", "France",
  "Netherlands", "Spain", "Italy", "Brazil", "Mexico", "Japan", "Singapore", "United Arab Emirates", "Other"];
const IDS = { country: "b_country1", guests: "b_guests01", follow: "b_follow01" };
const seed = {
  title: "Country + numeric",
  blocks: [
    { id: IDS.country, type: "country", label: "Country", required: false },
    { id: IDS.guests, type: "number", label: "Guests", required: false },
    { id: IDS.follow, type: "short", label: "Follow-up", required: false },
  ],
};
const withCond = (cond) => {
  const s = JSON.parse(JSON.stringify(seed));
  s.blocks[2].enableWhen = [cond];
  return s;
};

(async () => {
  const email = `verify-cn-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "CN" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "CN" }) })).json();
    const put = (schema) => fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    if ((await put(seed)).status !== 200) throw new Error("seed failed");
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });

    // ---------- API, sent directly ----------
    const before = await rows();
    for (const [name, cond, re] of [
      ["> with a string answer", { question: IDS.guests, operator: ">", answer: "abc" }, /Block "Follow-up": the operator ">" needs a number as its answer, but got "abc"/],
      ["<= with a numeric string", { question: IDS.guests, operator: "<=", answer: "3" }, /the operator "<=" needs a number/],
      ["country answer outside the list", { question: IDS.country, operator: "=", answer: "Narnia" }, /Block "Follow-up": the answer "Narnia" isn't one of the options of "Country"/],
      ["country answer with wrong case", { question: IDS.country, operator: "!=", answer: "india" }, /the answer "india" isn't one of the options/],
    ]) {
      const r = await put(withCond(cond));
      const msg = (await r.json()).message;
      check(`API rejects: ${name}`, r.status === 400 && re.test(msg), `${r.status} ${msg}`);
    }
    check("API rejections created no versions", (await rows()) === before);
    const okNum = await put(withCond({ question: IDS.guests, operator: ">", answer: 2 }));
    check("API accepts > with a number", okNum.status === 200, String(okNum.status));
    const okCountry = await put(withCond({ question: IDS.country, operator: "=", answer: "United Arab Emirates" }));
    check("API accepts a listed country", okCountry.status === 200, String(okCountry.status));
    if ((await put(seed)).status !== 200) throw new Error("reset failed"); // back to no conditions

    // ---------- editor ----------
    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    await ctx.addInitScript(() => {
      const style = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.documentElement) style(); else document.addEventListener("DOMContentLoaded", style);
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check("no page errors", false, e.message));
    const card = (id) => page.locator(`[data-block-id="${id}"]`);
    const select = (id) => card(id).click({ position: { x: 60, y: 12 } });
    const qSel = page.getByRole("combobox", { name: "Question" });
    const opSel = page.getByRole("combobox", { name: "operator" });
    const ansSel = page.getByRole("combobox", { name: "Answer" });

    await page.goto(`${WEB}/app/forms/${form.id}/edit`);
    await page.getByText("All changes saved").waitFor();

    // Country condition: only the fixed dropdown, exactly the list.
    await select(IDS.follow);
    await page.getByRole("button", { name: "Add condition" }).click();
    await qSel.first().selectOption(IDS.country);
    await opSel.first().selectOption("=");
    const listed = await ansSel.first().locator("option").allTextContents();
    check("country condition offers exactly the country list", JSON.stringify(listed) === JSON.stringify(COUNTRIES), listed.join(" | "));
    check("country condition has no free-text answer box",
      (await page.getByRole("textbox", { name: "Answer" }).count()) === 0 && (await page.getByRole("spinbutton", { name: "Answer" }).count()) === 0);
    await ansSel.first().selectOption("India");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("All changes saved").waitFor();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    const art = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    check("country condition saved and downloaded",
      JSON.stringify(noIds(art.blocks[2].enableWhen)) === `[{"question":"${IDS.country}","operator":"=","answer":"India"}]` && hasIds(art.blocks[2].enableWhen),
      JSON.stringify(art.blocks[2].enableWhen));

    // Non-numeric answer on a greater-than condition: the editor's UI can't produce
    // one, so serve a form containing it (as imported or older data might) and check
    // the editor flags it inline and the API refuses to save it.
    await page.route(`**/v1/forms/${form.id}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const body = await res.json();
      body.versions[0].schema.blocks[2].enableWhen = [{ question: IDS.guests, operator: ">", answer: "abc" }];
      await route.fulfill({ response: res, json: body });
    });
    await page.reload();
    await page.getByText("All changes saved").waitFor();
    await select(IDS.follow);
    const inline = page.getByText('the operator ">" needs a number as its answer, but got "abc".');
    check("editor shows the numeric rule inline", await inline.isVisible());
    check("number box shows empty, not a misleading 0", (await page.getByRole("spinbutton", { name: "Answer" }).inputValue()) === "");
    const desc = page.getByPlaceholder("Add a description…");
    await desc.click();
    await desc.pressSequentially("x");
    const versionsBefore = await rows();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const banner = page.getByRole("alert").filter({ hasText: /needs a number/ });
    await banner.waitFor({ timeout: 5000 });
    check("saving it from the editor is rejected by the API with the same message",
      /Couldn't save: Block "Follow-up": the operator ">" needs a number as its answer, but got "abc"/.test(await banner.innerText()) && (await rows()) === versionsBefore,
      await banner.innerText());
    // Fixing it in the box clears the inline problem (reselect: editing the description deselected it).
    await page.getByRole("button", { name: "Dismiss" }).click(); // the save banner repeats the same sentence
    await select(IDS.follow);
    await page.getByRole("spinbutton", { name: "Answer" }).fill("4");
    check("entering a number clears the inline problem", (await inline.count()) === 0);
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
