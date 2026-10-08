// "Save progress" (drafts) in the builder: API rules and artifact, the settings UI,
// the auto-switch when pages are removed, and the two artifacts for the end-to-end run.
const fs = require("fs");
const { OUT, API, WEB, PrismaClient, launchBrowser, saveArtifact } = require("./_setup");
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

const leaf = (id, label, extra = {}) => ({ id, type: "short", label, required: false, ...extra });
const page = (id, title, blocks) => ({ id, type: "page", title, blocks });
const TWO_PAGES = (title) => ({
  title,
  blocks: [
    page("p1", "About you", [leaf("name", "Full name", { required: true })]),
    page("p2", "Details", [leaf("notes", "Anything else?")]),
  ],
});
const FLAT = { title: "No pages", blocks: [leaf("name", "Full name"), leaf("notes", "Anything else?")] };

const SESSION_HELP = "Answers survive a page refresh, but not closing the tab.";
const DEVICE_HELP = "Answers are saved, encrypted, on the respondent's device and can be continued later. Needs setup by the developer of the app the form is used in.";
const SERVER_HELP = "Answers are saved by the app the form is used in, at each page change. Needs setup by that app's developer.";
const FALLBACK = "If the app hasn't been set up for the option chosen, the form falls back to ‘Only while the form is open’.";
const NOTE = "Saving progress on the server needs pages, so it's been switched to 'Only while the form is open'.";

(async () => {
  const email = `verify-drafts-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Drafts" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;
    const put = (id, schema) => fetch(`${API}/v1/forms/${id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const artifact = async (id) => (await fetch(`${API}/v1/forms/${id}/artifact`, { headers: H })).json();
    // Forms are deleted once checked.
    const remove = (id) => fetch(`${API}/v1/forms/${id}`, { method: "DELETE", headers: H });
    const stored = async (id) => (await prisma.formVersion.findFirst({ where: { formId: id }, orderBy: { version: "desc" } })).schema;

    // ---------- API: save rules and artifact output ----------
    const apiForm = await create("Drafts API");
    for (const mode of ["session", "device", "server"]) {
      const r = await put(apiForm, { ...TWO_PAGES("Drafts API"), drafts: { mode } });
      const art = await artifact(apiForm);
      check(`API: "${mode}" on a paged form saves`, r.status === 200, `${r.status} ${await r.text()}`);
      check(`API: artifact for "${mode}"`, mode === "session" ? !("drafts" in art) : JSON.stringify(art.drafts) === JSON.stringify({ mode }), JSON.stringify(art.drafts));
    }
    const bad = await put(apiForm, { ...TWO_PAGES("Drafts API"), drafts: { mode: "cloud" } });
    const badMsg = (await bad.json()).message;
    check("API: any other mode is rejected (400)", bad.status === 400 && /drafts\.mode/.test(badMsg), `${bad.status} ${badMsg}`);
    const flatForm = await create("No pages");
    const noPages = await put(flatForm, { ...FLAT, drafts: { mode: "server" } });
    const noPagesMsg = (await noPages.json()).message;
    check("API: server mode on a form without pages is rejected with a clear message", noPages.status === 400 &&
      noPagesMsg === `Save progress "On the app's server" needs a form with pages, because it saves at each page change. Add pages, or choose another Save progress option.`, `${noPages.status} ${noPagesMsg}`);
    const flatDevice = await put(flatForm, { ...FLAT, drafts: { mode: "device" } });
    check("API: device mode on a form without pages is fine", flatDevice.status === 200);
    await remove(apiForm);
    await remove(flatForm);

    // ---------- editor ----------
    browser = await launchBrowser();
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1300 } });
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
    const section = () => P.getByRole("group", { name: "Save progress" });
    const opt = (name) => section().getByRole("radio", { name: new RegExp(`^${name.replace(/[’']/g, ".")}`) });
    const SESSION = "Only while the form is open", DEVICE = "On this device", SERVER = "On the app's server";
    const clean = () => P.getByText("All changes saved").isVisible();
    const save = async () => { await P.getByRole("button", { name: "Save", exact: true }).click(); await P.getByText("All changes saved").waitFor({ timeout: 10000 }); };
    const download = async (file) => {
      const [dl] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Download", exact: true }).click()]);
      const raw = fs.readFileSync(await dl.path(), "utf8");
      if (file) saveArtifact(file, raw);
      return JSON.parse(raw);
    };

    // A form without pages: server disabled, with the reason.
    const unpagedId = await create("Survey");
    await put(unpagedId, { ...FLAT, title: "Survey" });
    await open(unpagedId);
    check("editor: Save progress section with three choices", await section().isVisible() && await opt(SESSION).isVisible() && await opt(DEVICE).isVisible() && await opt(SERVER).isVisible());
    check("editor: each choice has its help text, and the fallback line is shown",
      await section().getByText(SESSION_HELP).isVisible() && await section().getByText(DEVICE_HELP).isVisible() && await section().getByText(SERVER_HELP).isVisible() && await section().getByText(FALLBACK).isVisible());
    check('editor: default is "Only while the form is open"', await opt(SESSION).isChecked());
    check("editor: without pages, server is disabled with the reason shown",
      await opt(SERVER).isDisabled() && await section().getByText("Available for forms with pages").isVisible() && await opt(DEVICE).isEnabled());
    await section().scrollIntoViewIfNeeded();
    await sleep(200);
    await P.screenshot({ path: `${OUT}/drafts-1-no-pages.png` });
    await remove(unpagedId);

    // A paged form: every choice; defaults not stored; survives save and reload.
    const serverId = await create("Intake (server drafts)");
    await put(serverId, TWO_PAGES("Intake (server drafts)"));
    await open(serverId);
    check("editor: with pages, server is enabled and no reason is shown", await opt(SERVER).isEnabled() && (await section().getByText("Available for forms with pages").count()) === 0);
    await opt(DEVICE).check();
    check("editor: choosing On this device is an unsaved change", await opt(DEVICE).isChecked() && !(await clean()));
    await opt(SESSION).check();
    check("editor: choosing the default again leaves the form unchanged (the default isn't stored)", await clean());
    await opt(SERVER).check();
    await section().scrollIntoViewIfNeeded();
    await sleep(200);
    await P.screenshot({ path: `${OUT}/drafts-2-server-chosen.png` });
    await save();
    check("editor: stored as { mode: \"server\" }", JSON.stringify((await stored(serverId)).drafts) === '{"mode":"server"}', JSON.stringify((await stored(serverId)).drafts));
    await P.reload(); await P.getByText("All changes saved").waitFor(); await deselect();
    check("editor: the choice survives save and reload", await opt(SERVER).isChecked());
    const serverArt = await download("builder-drafts-server-schema.json");
    check('artifact: drafts: { mode: "server" }', JSON.stringify(serverArt.drafts) === '{"mode":"server"}', JSON.stringify(serverArt.drafts));

    const deviceId = await create("Intake (device drafts)");
    await put(deviceId, TWO_PAGES("Intake (device drafts)"));
    await open(deviceId);
    await opt(DEVICE).check();
    await save();
    await P.reload(); await P.getByText("All changes saved").waitFor(); await deselect();
    check("editor: On this device survives save and reload", await opt(DEVICE).isChecked());
    const deviceArt = await download("builder-drafts-device-schema.json");
    check('artifact: drafts: { mode: "device" }', JSON.stringify(deviceArt.drafts) === '{"mode":"device"}', JSON.stringify(deviceArt.drafts));

    // Removing pages from a server-mode form: switched to session, with the note.
    const oneId = await create("One page (server drafts)");
    await put(oneId, { title: "One page (server drafts)", blocks: [page("p1", "About you", [leaf("name", "Full name")])], drafts: { mode: "server" } });
    await open(oneId);
    check("editor: a saved server-mode form loads with server chosen", await opt(SERVER).isChecked());
    await P.getByRole("button", { name: "Remove pages" }).first().click();
    const note = P.getByRole("status").filter({ hasText: "Saving progress on the server" });
    check("remove pages: the note appears", (await note.innerText()).trim() === NOTE, await note.innerText().catch(() => "(none)"));
    await deselect();
    check("remove pages: switched to Only while the form is open; server now disabled",
      await opt(SESSION).isChecked() && await opt(SERVER).isDisabled());
    await section().scrollIntoViewIfNeeded();
    await sleep(200);
    await P.screenshot({ path: `${OUT}/drafts-3-pages-removed.png` });
    await save();
    const afterRemove = await download("builder-drafts-removed-pages-schema.json");
    check("remove pages: saved, and the artifact has no drafts (and no pages or navigation)",
      !("drafts" in afterRemove) && !("navigation" in afterRemove) && afterRemove.blocks.every((b) => b.type !== "page"), Object.keys(afterRemove).join());
    // Saving clears notices, the note included.
    check("remove pages: the note clears on the next save", (await P.getByRole("status").filter({ hasText: "Saving progress on the server" }).count()) === 0);
    // The author can re-add pages and choose server again.
    await P.getByRole("button", { name: "Add page", exact: true }).click();
    await P.getByRole("dialog").getByRole("button", { name: "Add pages" }).click();
    await deselect();
    check("re-adding pages enables server again", await opt(SERVER).isEnabled());
    await opt(SERVER).check();
    check("…and it can be chosen again", await opt(SERVER).isChecked());
    // (Page 2 is empty, so this form isn't saved again.)
  } catch (e) {
    check("script ran without error", false, e.stack);
    try { const p = browser?.contexts()[0]?.pages()[0]; if (p) await p.screenshot({ path: `${OUT}/drafts-failure.png` }); } catch {}
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
