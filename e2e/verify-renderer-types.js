// Every block type the builder offers is one the renderer knows. The types are
// the schema's own (`BlockType`, plus group and page), so a new type is
// included without editing this suite. The editor's insert menu must offer
// exactly those leaf types, except `hidden`: the renderer neither shows it nor
// collects a value yet, so it isn't offered, though it still saves and renders
// (it is in the form below). A paged form with one block of each type is saved
// and downloaded through the API, and the download passes the external test
// app's installed @zoworkhq/forms (`KNOWN_TYPES`, `assertSchemaIntegrity`).
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { ROOT, OUT, API, WEB, PrismaClient, launchBrowser, RENDERER_CORE } = require("./_setup");
const { BlockType, newBlock } = require(path.join(ROOT, "packages/form-schema/dist"));
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
const walk = function* (bs) { for (const b of bs) { yield b; if (b.blocks) yield* walk(b.blocks); } };

const LEAF_TYPES = BlockType.options;
const ALL_TYPES = [...LEAF_TYPES, "group", "page"];
// Only what a type's save rules need beyond `newBlock`'s defaults.
const CONTENT = {
  image: "/images/sample.png",
  video: "https://youtu.be/dQw4w9WgXcQ",
  audio: "/audio/sample.mp3",
};

(async () => {
  const email = `verify-renderer-types-${Date.now()}@example.test`;
  let browser;
  try {
    await waitFor(API + "/health");
    await waitFor(WEB + "/login");
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Renderer types" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const create = async (title) => (await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title }) })).json()).id;

    // ---------- the renderer ----------
    let core;
    try { core = await import(pathToFileURL(RENDERER_CORE).href); } catch (e) { check("the external app's @zoworkhq/forms loads", false, `${RENDERER_CORE}: ${e.message}`); }
    if (core) {
      const version = require(path.join(path.dirname(RENDERER_CORE), "../../package.json")).version;
      check(`the external app's @zoworkhq/forms loads (${version})`, true);
      const unknown = ALL_TYPES.filter((t) => !core.KNOWN_TYPES.has(t));
      check(`every builder type (${ALL_TYPES.length}) is in the renderer's KNOWN_TYPES`, unknown.length === 0, `unknown to the renderer: ${unknown.join(", ")}`);
    }

    // ---------- the insert menu ----------
    browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), token);
    const P = await ctx.newPage();
    P.on("pageerror", (e) => check("no page errors", false, e.message));
    const menuForm = await create("Insert menu");
    await P.goto(`${WEB}/app/forms/${menuForm}/edit`);
    await P.getByTitle("Insert a block").click();
    const offered = [...new Set(await P.locator("[data-block-type]").evaluateAll((els) => els.map((e) => e.dataset.blockType)))].filter((t) => t !== "group");
    const NOT_OFFERED = ["hidden"];
    const missing = LEAF_TYPES.filter((t) => !offered.includes(t) && !NOT_OFFERED.includes(t));
    const extra = offered.filter((t) => !LEAF_TYPES.includes(t) || NOT_OFFERED.includes(t));
    check(`the insert menu offers exactly the schema's ${LEAF_TYPES.length} leaf types but Hidden field`, !missing.length && !extra.length,
      `not offered: ${missing.join(", ") || "none"}; not in the schema: ${extra.join(", ") || "none"}`);
    check("…and groups", (await P.locator('[data-block-type="group"]').count()) === 1);
    await browser.close();
    browser = undefined;

    // ---------- one block of every type, saved and downloaded ----------
    const leaves = LEAF_TYPES.map((type) => newBlock(type, { id: `b_${type}`, ...(CONTENT[type] ? { content: CONTENT[type] } : {}) }));
    const schema = {
      title: "Every block type",
      blocks: [{ id: "p_all", type: "page", title: "Every type", blocks: [{ id: "g_all", type: "group", label: "Every leaf type", blocks: leaves }] }],
    };
    const formId = await create("Every block type");
    const r = await fetch(`${API}/v1/forms/${formId}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    check("a form with one block of every type saves (200)", r.status === 200, `${r.status} ${await r.clone().text()}`);
    const dl = await fetch(`${API}/v1/forms/${formId}/artifact`, { headers: H });
    const text = await dl.text();
    check("…downloads (200)", dl.status === 200, `${dl.status} ${text.slice(0, 300)}`);
    let artifact;
    try { artifact = JSON.parse(text); } catch (e) { check("…the download is JSON", false, e.message); }
    if (artifact) {
      fs.writeFileSync(path.join(OUT, "renderer-types.json"), text);
      const counts = {};
      for (const b of walk(artifact.blocks)) counts[b.type] = (counts[b.type] || 0) + 1;
      const notOnce = ALL_TYPES.filter((t) => counts[t] !== 1);
      check(`…holding each of the ${ALL_TYPES.length} types exactly once`, notOnce.length === 0 && Object.keys(counts).length === ALL_TYPES.length, JSON.stringify(counts));
      if (core) {
        let integrity = null;
        try { core.assertSchemaIntegrity(artifact); } catch (e) { integrity = e.message; }
        check("…and passes the renderer's assertSchemaIntegrity", integrity === null, integrity);
      }
    }
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
  let ok = true;
  for (const [name, pass, detail] of results) {
    if (!pass) ok = false;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? "   [" + detail + "]" : ""}`);
  }
  console.log(`\n  ${results.filter((r) => r[1]).length}/${results.length} passed`);
  process.exit(ok ? 0 : 1);
})();
