// A stale tab can't overwrite newer work, and Download refuses a file the
// renderer would refuse (release fixes, items 9 and 10). In the browser: the
// editor's "This form changed since you opened it" dialog and each of its three
// choices, against a real second save through the API; and the editor's
// Download error for a stored version the renderer refuses. Screenshots, light
// and dark, in output/release-fixes/.
const fs = require("fs");
const path = require("path");
const { API, WEB, OUT, PrismaClient, launchBrowser } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = path.join(OUT, "release-fixes");
fs.mkdirSync(SHOTS, { recursive: true });
const q = (id, label) => ({ id, type: "short", label, required: false });

(async () => {
  const email = `verify-version-safety-${Date.now()}@example.test`;
  let browser;
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok && (await fetch(WEB + "/login")).ok) break; } catch {} await sleep(1000); }
    const json = { "Content-Type": "application/json" };
    const token = (await (await fetch(API + "/v1/auth/signup", { method: "POST", headers: json, body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Safety" }) })).json()).token;
    const H = { ...json, Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Version safety" }) })).json();
    const latest = async () => (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } }));
    /** Another tab saves `description` on top of the latest version. */
    const otherTabSaves = async (description) => {
      const v = (await latest()).version;
      const r = await fetch(`${API}/v1/forms/${form.id}/schema?baseVersion=${v}`, { method: "PUT", headers: H, body: JSON.stringify({ title: "Version safety", description, blocks: [q("q", "Name")] }) });
      if (!r.ok) throw new Error(`other tab's save: ${r.status} ${await r.text()}`);
      return (await r.json()).version;
    };
    await otherTabSaves("first");

    browser = await launchBrowser();
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
      await ctx.addCookies([{ name: "zoblocks-theme", value: theme, url: WEB }]);
      await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
      const page = await ctx.newPage();
      const saveBtn = page.locator("header").getByRole("button", { name: "Save", exact: true });
      const desc = page.getByPlaceholder("Add a description…");
      const dialog = page.getByRole("alertdialog", { name: "This form changed since you opened it" });
      const open = async () => {
        await page.goto(`${WEB}/app/forms/${form.id}/edit`);
        await page.locator("[data-save-state]").getByText("All changes saved").waitFor();
      };
      /** Edit here, let another tab save, then Save here: the dialog. */
      const goStale = async (mine, theirs) => {
        await desc.fill(mine);
        const base = (await latest()).version;
        const newer = await otherTabSaves(theirs);
        await saveBtn.click();
        await dialog.waitFor();
        return { base, newer };
      };

      // ---------- the dialog, and Keep editing ----------
      await open();
      let { base, newer } = await goStale(`mine (${theme})`, `theirs (${theme})`);
      const text = await dialog.innerText();
      check(`${theme}: the dialog names both versions`, text.includes(`Version ${newer} was saved after you started editing from version ${base}, in another tab or by a teammate.`), text);
      check(`${theme}: …and says what each choice does`, text.includes("Your unsaved edits here will be lost.") && text.includes(`Becomes version ${newer + 1}. The other changes stay in version history.`), text);
      check(`${theme}: nothing was saved`, (await latest()).version === newer && (await latest()).schema.description === `theirs (${theme})`);
      check(`${theme}: focus starts on Keep editing`, await dialog.getByRole("button", { name: "Keep editing" }).evaluate((b) => b === document.activeElement));
      await page.screenshot({ path: path.join(SHOTS, `stale-save-${theme}.png`) });
      await dialog.getByRole("button", { name: "Keep editing" }).click();
      await dialog.waitFor({ state: "detached" });
      check(`${theme}: Keep editing keeps the edits, unsaved`, (await desc.inputValue()) === `mine (${theme})` && (await latest()).version === newer);

      // ---------- Load the latest version ----------
      await saveBtn.click();
      await dialog.waitFor();
      await dialog.getByRole("button", { name: "Load the latest version" }).click();
      await dialog.waitFor({ state: "detached" });
      check(`${theme}: Load the latest version shows the other tab's work`, (await desc.inputValue()) === `theirs (${theme})`, await desc.inputValue());
      check(`${theme}: …and nothing was saved`, (await latest()).version === newer);

      // ---------- Save mine as a new version ----------
      ({ base, newer } = await goStale(`mine again (${theme})`, `theirs again (${theme})`));
      await dialog.getByRole("button", { name: "Save mine as a new version" }).click();
      await dialog.waitFor({ state: "detached" });
      await page.locator("[data-save-state]").getByText("All changes saved").waitFor();
      const after = await latest();
      check(`${theme}: Save mine saves these edits as the next version`, after.version === newer + 1 && after.schema.description === `mine again (${theme})`, `v${after.version} ${after.schema.description}`);
      const previous = await prisma.formVersion.findFirst({ where: { formId: form.id, version: newer } });
      check(`${theme}: …and the other tab's version stays in history`, previous.schema.description === `theirs again (${theme})`);
      await desc.fill(`next (${theme})`);
      await saveBtn.click();
      await page.locator("[data-save-state]").getByText("All changes saved").waitFor();
      check(`${theme}: the next save goes on from there, no dialog`, (await latest()).version === newer + 2 && (await dialog.count()) === 0);

      // ---------- Download refuses a file the renderer would refuse ----------
      const v = (await latest()).version;
      const broken = await prisma.formVersion.create({ data: { formId: form.id, version: v + 1, schema: { title: "Version safety", blocks: [q("dup", "One"), q("dup", "Two")] } } });
      await open();
      let downloaded = false;
      page.once("download", () => { downloaded = true; });
      await page.getByRole("button", { name: "Download", exact: true }).click();
      const error = page.getByText(/^Couldn't download: The renderer would refuse this form: /);
      await error.waitFor();
      check(`${theme}: Download of a form the renderer would refuse shows why`, /dup/.test(await error.innerText()), await error.innerText());
      await sleep(500);
      check(`${theme}: …and downloads nothing`, !downloaded);
      await page.screenshot({ path: path.join(SHOTS, `download-refused-${theme}.png`) });
      await prisma.formVersion.delete({ where: { id: broken.id } });
      await ctx.close();
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
  const passed = results.filter(([, p]) => p).length;
  for (const [name, pass, detail] of results) console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${pass || !detail ? "" : `   [${detail}]`}`);
  console.log(`\n  ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
