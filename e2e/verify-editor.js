// Drives the real editor in a browser against the running API + web dev server
// and the live dev database, checking the explicit Save/Cancel/Download model.
const fs = require("fs");
const { API, WEB, PrismaClient, launchBrowser } = require("./_setup");
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

(async () => {
  const email = `verify-ui-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");

    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "UI" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "UI verify" }) })).json();
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });
    const latestId = async () => (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } })).id;
    const latestVersion = async () => (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } })).version;

    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    const page = await ctx.newPage();
    let schemaPuts = 0;
    page.on("request", (r) => { if (r.method() === "PUT" && r.url().endsWith("/schema")) schemaPuts++; });

    const status = page.locator("header span.text-faint").first();
    const saveBtn = page.getByRole("button", { name: "Save", exact: true });
    const cancelBtn = page.getByRole("button", { name: "Cancel", exact: true });
    const downloadBtn = page.getByRole("button", { name: "Download", exact: true });
    const desc = page.getByPlaceholder("Add a description…");

    async function download(trigger) {
      const [dl] = await Promise.all([page.waitForEvent("download"), trigger()]);
      return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), "utf8") };
    }

    // --- load: clean state ---
    await page.goto(`${WEB}/app/forms/${form.id}/edit`);
    await status.getByText("All changes saved").waitFor();
    check("loads clean: 'All changes saved'", true);
    check("Save disabled when not dirty", await saveBtn.isDisabled());
    check("Cancel disabled when not dirty", await cancelBtn.isDisabled());
    check("Download enabled when not dirty", await downloadBtn.isEnabled());
    check("no Publish button", (await page.getByRole("button", { name: /Publish/ }).count()) === 0);

    // --- typing without saving creates no versions ---
    const v1Id = await latestId();
    await desc.click();
    await desc.press("End"); await desc.pressSequentially("Hello", { delay: 60 });
    await sleep(1500); // well past the old 650ms autosave debounce
    check("typing creates no versions", (await rows()) === 1 && schemaPuts === 0, `rows=${await rows()} puts=${schemaPuts}`);
    check("shows 'Unsaved changes'", await status.getByText("Unsaved changes").isVisible());
    check("Save enabled when dirty", await saveBtn.isEnabled());
    check("Download still enabled when dirty", await downloadBtn.isEnabled());

    // --- editing back to the saved content is not dirty (content compare, not "touched") ---
    for (let i = 0; i < 5; i++) await desc.press("Backspace");
    check("reverting an edit by hand -> not dirty", await saveBtn.isDisabled());
    await desc.press("End"); await desc.pressSequentially("Hello", { delay: 30 });

    // --- edit without saving -> Download returns the previous saved version ---
    const d1 = await download(() => downloadBtn.click());
    const a1 = JSON.parse(d1.text);
    // The name comes from Content-Disposition, which CORS must expose to the web app; else it would be form.json.
    check("download named from title and version, read from the response across origins", d1.name === "ui-verify-v1.json", d1.name);
    check("unsaved edit NOT in download", a1.description === undefined, JSON.stringify(a1.description));
    check("download is the saved version (formVersionId)", a1.formVersionId === v1Id);
    const d2 = await download(() => downloadBtn.click());
    check("download twice -> identical", d1.text === d2.text);
    check("downloads create no versions", (await rows()) === 1 && schemaPuts === 0);

    // --- Save creates exactly one version, becomes the new baseline ---
    await saveBtn.click();
    await status.getByText("All changes saved").waitFor();
    check("save creates exactly one version", (await rows()) === 2 && schemaPuts === 1, `rows=${await rows()} puts=${schemaPuts}`);
    check("Save disabled again after save", await saveBtn.isDisabled());
    const d3 = JSON.parse((await download(() => downloadBtn.click())).text);
    check("download now has saved edit", d3.description === "Hello");
    check("formVersionId changed after save", d3.formVersionId !== a1.formVersionId && d3.formVersionId === (await latestId()));

    // --- Cancel: confirmation, dismiss keeps edits, accept reverts ---
    await desc.press("End"); await desc.pressSequentially(" world", { delay: 30 });
    let dialogMsg = "";
    page.once("dialog", (d) => { dialogMsg = d.message(); d.dismiss(); });
    await cancelBtn.click();
    await sleep(200);
    check("Cancel asks for confirmation", dialogMsg === "Discard unsaved changes? This cannot be undone.", dialogMsg);
    check("dismissing keeps edits", (await desc.inputValue()) === "Hello world");
    page.once("dialog", (d) => d.accept());
    await cancelBtn.click();
    await status.getByText("All changes saved").waitFor();
    check("accepting reverts to latest saved version", (await desc.inputValue()) === "Hello");
    check("Cancel created no version", (await rows()) === 2);

    // --- 409 NO_CHANGES is a no-op; VERSION_CONFLICT keeps edits and asks to reload ---
    await desc.press("End"); await desc.pressSequentially("!", { delay: 30 });
    await page.route("**/v1/forms/*/schema", (r) => r.fulfill({ status: 409, contentType: "application/json",
      body: JSON.stringify({ statusCode: 409, message: "No changes to save.", code: "NO_CHANGES" }) }));
    await saveBtn.click();
    await status.getByText("All changes saved").waitFor();
    check("409 NO_CHANGES -> treated as saved, no error", (await page.locator("text=Couldn't save").count()) === 0);
    await page.unroute("**/v1/forms/*/schema");

    await desc.press("End"); await desc.pressSequentially("?", { delay: 30 });
    const conflictMsg = "This form was saved elsewhere. Reload to get the latest version.";
    await page.route("**/v1/forms/*/schema", (r) => r.fulfill({ status: 409, contentType: "application/json",
      body: JSON.stringify({ statusCode: 409, message: conflictMsg, code: "VERSION_CONFLICT" }) }));
    await saveBtn.click();
    await page.getByText(conflictMsg).waitFor();
    check("409 VERSION_CONFLICT -> shows reload message", true);
    check("conflict keeps unsaved edits", (await desc.inputValue()) === "Hello!?" && (await saveBtn.isEnabled()), await desc.inputValue());
    await page.unroute("**/v1/forms/*/schema");

    // --- real 409s from the API carry the codes the editor relies on ---
    const same = await fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H,
      body: JSON.stringify({ title: "UI verify", description: "Hello", blocks: [] }) });
    check("API 409 body carries code NO_CHANGES", same.status === 409 && (await same.json()).code === "NO_CHANGES");

    // --- in-app navigation guard + beforeunload while dirty ---
    let leaveMsg = "";
    page.once("dialog", (d) => { leaveMsg = d.message(); d.dismiss(); });
    await page.getByRole("link", { name: "Back" }).click();
    await sleep(500);
    check("in-app link while dirty asks to confirm", leaveMsg.startsWith("Leave without saving?"), leaveMsg);
    check("dismiss keeps you in the editor", page.url().endsWith("/edit"));

    let unloadType = "";
    page.once("dialog", (d) => { unloadType = d.type(); d.dismiss(); });
    await page.close({ runBeforeUnload: true });
    await sleep(800);
    check("closing tab while dirty -> beforeunload warning", unloadType === "beforeunload", unloadType);

    // --- dashboard Download works ---
    const page2 = await ctx.newPage();
    await page2.goto(`${WEB}/app`);
    await page2.getByRole("button", { name: /^More actions for "/ }).first().click();
    const [dl] = await Promise.all([page2.waitForEvent("download"), page2.getByRole("menuitem", { name: "Download" }).click()]);
    const dash = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    check("dashboard Download -> latest saved artifact", dash.formId === form.id && dash.formVersionId === (await latestId()) && dl.suggestedFilename() === `ui-verify-v${await latestVersion()}.json`, dl.suggestedFilename());

    // --- versions page: copy, current disabled, restore creates version + editor shows it ---
    await page2.goto(`${WEB}/app/forms/${form.id}/versions`);
    await page2.getByText("Saved versions").waitFor();
    check("versions copy updated", (await page2.getByText(/Published snapshots|publish/i).count()) === 0);
    const restoreBtns = page2.getByRole("button", { name: "Restore" });
    check("restore disabled on current version", await restoreBtns.nth(0).isDisabled());
    const before = await rows();
    await restoreBtns.nth(1).click(); // v1: empty description
    await page2.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();
    await page2.waitForURL(`**/app/forms/${form.id}/edit`);
    await page2.getByText("All changes saved").waitFor();
    const top = await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } });
    check("restore created a new version", (await rows()) === before + 1 && top.label === "Restored from v1", top.label);
    check("editor shows restored version", (await page2.getByPlaceholder("Add a description…").inputValue()) === "");
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
