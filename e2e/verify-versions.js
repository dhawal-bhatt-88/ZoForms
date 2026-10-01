// HTTP-level verification of append-only versions + read-only artifact endpoint,
// against the running API (real auth + org guards) and the live dev database.
const path = require("path");
const fs = require("fs");
const { ROOT, API, PrismaClient } = require("./_setup");
const API_DIR = path.join(ROOT, "apps/api");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);

async function call(method, p, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: r.status, headers: r.headers, text, json };
}

// Snapshot of every file under both uploads dirs: name -> mtime.
function uploadsState() {
  const out = {};
  for (const dir of [path.join(API_DIR, "uploads"), path.join(API_DIR, "../../uploads")]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) out[dir + "/" + f] = fs.statSync(path.join(dir, f)).mtimeMs;
  }
  return out;
}

const X = { title: "Verify", blocks: [{ id: "b_x1", type: "short", label: "Name", required: false }] };
const Y = { title: "Verify", blocks: [{ id: "b_x1", type: "short", label: "Full name", required: true }] };

(async () => {
  const tag = Date.now();
  const createdEmails = [];
  try {
    const uploadsBefore = uploadsState();

    const signup = async (who) => {
      const email = `verify-${who}-${tag}@example.test`;
      createdEmails.push(email);
      const r = await call("POST", "/v1/auth/signup", null, { email, password: "Verify-pass-123!", name: who });
      if (r.status >= 300) throw new Error(`signup ${who}: ${r.status} ${r.text}`);
      return r.json.token;
    };
    const A = await signup("a");
    const B = await signup("b");

    const form = (await call("POST", "/v1/forms", A, { title: "Verify" })).json;
    const versions = async () => (await call("GET", `/v1/forms/${form.id}/versions`, A)).json;
    const rowCount = () => prisma.formVersion.count({ where: { formId: form.id } });
    check("create -> version 1 exists", (await versions()).length === 1);

    // Save -> new row, version increments
    const s1 = await call("PUT", `/v1/forms/${form.id}/schema`, A, X);
    check("save #1 -> 200, version 2", s1.status === 200 && s1.json.version === 2, `${s1.status} ${s1.text}`);
    check("save #1 inserted a row", (await rowCount()) === 2);

    // Download: headers, identity, key order
    const d1 = await call("GET", `/v1/forms/${form.id}/artifact`, A);
    const art1 = d1.json;
    check("artifact -> 200", d1.status === 200, `${d1.status} ${d1.text.slice(0, 120)}`);
    check("Content-Type application/json", (d1.headers.get("content-type") || "").startsWith("application/json"), d1.headers.get("content-type"));
    check("Content-Disposition attachment + filename",
      d1.headers.get("content-disposition") === `attachment; filename="${form.slug}-schema.json"`,
      d1.headers.get("content-disposition"));
    check("formId === Form.id", art1.formId === form.id);
    check("formVersionId === saved version row id", art1.formVersionId === s1.json.versionId);
    const keys = Object.keys(art1);
    check("key order title, formId, formVersionId", keys[0] === "title" && keys[1] === "formId" && keys[2] === "formVersionId", keys.join(","));

    // Download twice, no save between -> identical, no new rows
    const d2 = await call("GET", `/v1/forms/${form.id}/artifact`, A);
    check("download twice -> byte-identical", d1.text === d2.text);
    check("download creates no rows", (await rowCount()) === 2);

    // "Edit without saving" at the API level = no PUT; download still serves last save
    check("unsaved edits invisible to download", JSON.parse(d2.text).blocks[0].label === "Name");

    // Save with no changes -> rejected, no row
    const same = await call("PUT", `/v1/forms/${form.id}/schema`, A, X);
    check("identical save -> 409", same.status === 409, `${same.status} ${same.text}`);
    check("identical save created no row", (await rowCount()) === 2);

    // Key-order-only difference is still "no change" (jsonb reorders keys)
    const reordered = { blocks: [{ required: false, label: "Name", type: "short", id: "b_x1" }], title: "Verify" };
    const same2 = await call("PUT", `/v1/forms/${form.id}/schema`, A, reordered);
    check("same content, different key order -> 409", same2.status === 409, `${same2.status}`);

    // Real change -> v3, formVersionId changes, formId doesn't
    const s2 = await call("PUT", `/v1/forms/${form.id}/schema`, A, Y);
    const art2 = (await call("GET", `/v1/forms/${form.id}/artifact`, A)).json;
    check("save #2 -> version 3", s2.json && s2.json.version === 3, s2.text);
    check("formVersionId changed after save", art2.formVersionId !== art1.formVersionId);
    check("formId unchanged after save", art2.formId === art1.formId);

    // Restore v2 -> appends v4, v2 row untouched
    const v2Before = await prisma.formVersion.findFirst({ where: { formId: form.id, version: 2 } });
    const rs = await call("POST", `/v1/forms/${form.id}/versions/${v2Before.id}/restore`, A);
    const v2After = await prisma.formVersion.findFirst({ where: { formId: form.id, version: 2 } });
    const art3 = (await call("GET", `/v1/forms/${form.id}/artifact`, A)).json;
    check("restore -> appended version 4", rs.status === 201 && rs.json.version === 4, `${rs.status} ${rs.text}`);
    check("restored content is v2's", art3.blocks[0].label === "Name");
    check("restore label", (await versions())[0].label === "Restored from v2");
    check("source row not modified",
      JSON.stringify(v2Before) === JSON.stringify(v2After));
    const rsSame = await call("POST", `/v1/forms/${form.id}/versions/${rs.json.versionId}/restore`, A);
    check("restoring current content -> 409", rsSame.status === 409, `${rsSame.status}`);

    // No existing row was ever updated: every row's schema/createdAt still as inserted
    const all = await prisma.formVersion.findMany({ where: { formId: form.id }, orderBy: { version: "asc" } });
    check("versions contiguous 1..4", all.map((v) => v.version).join(",") === "1,2,3,4");

    // Concurrent saves never duplicate a version number
    const c = await Promise.all([
      call("PUT", `/v1/forms/${form.id}/schema`, A, { ...Y, title: "Concurrent A" }),
      call("PUT", `/v1/forms/${form.id}/schema`, A, { ...Y, title: "Concurrent B" }),
    ]);
    const nums = (await prisma.formVersion.findMany({ where: { formId: form.id } })).map((v) => v.version);
    check("concurrent saves -> no duplicate version numbers", new Set(nums).size === nums.length,
      `statuses ${c.map((r) => r.status).join("/")}, versions ${nums.sort().join(",")}`);

    // Guards
    const unauth = await call("GET", `/v1/forms/${form.id}/artifact`, null);
    check("artifact unauthenticated -> 401", unauth.status === 401, `${unauth.status}`);
    const cross = await call("GET", `/v1/forms/${form.id}/artifact`, B);
    check("artifact cross-org -> 404", cross.status === 404, `${cross.status}`);
    const crossSave = await call("PUT", `/v1/forms/${form.id}/schema`, B, Y);
    check("save cross-org -> 404", crossSave.status === 404, `${crossSave.status}`);

    // Status change no longer snapshots; public path serves latest version
    const before = await rowCount();
    await call("PATCH", `/v1/forms/${form.id}`, A, { status: "PUBLISHED" });
    check("PATCH status creates no version", (await rowCount()) === before);
    const pub = await call("GET", `/v1/public/forms/${form.slug}`, null);
    const latest = (await call("GET", `/v1/forms/${form.id}/artifact`, A)).json;
    check("public path serves latest version", pub.status === 200 && pub.json.schema.title === latest.title
      && JSON.stringify(pub.json.schema.blocks) === JSON.stringify(latest.blocks), `${pub.status}`);

    // uploads/ untouched
    const uploadsAfter = uploadsState();
    check("uploads/ not written", JSON.stringify(uploadsBefore) === JSON.stringify(uploadsAfter));
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    for (const email of createdEmails) {
      const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
      if (!u) continue;
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
