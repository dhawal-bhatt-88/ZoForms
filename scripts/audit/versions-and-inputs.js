// Release audit, areas 2, 4 and 5: ids, request body limits, deeply nested JSON,
// and form versions (every save inserts one; concurrent and stale saves; restore;
// Download reads the latest and writes nothing).
//
// Usage: node scripts/audit/versions-and-inputs.js   (API on AUDIT_API_URL, default :4100)
const { call, signup, check, note, run, short, prisma } = require("./_lib");

const q = (id, label) => ({ id, type: "short", label, required: false });
const ok = (r) => r.status >= 200 && r.status < 300;

/** `levels` groups, each inside the last, with one question at the bottom. */
function nestedGroups(levels) {
  let block = q("leaf", "Deepest question");
  for (let i = levels; i > 0; i--) block = { id: `g${i}`, type: "group", label: `Group ${i}`, blocks: [block] };
  return block;
}
/** A plain object nested `levels` deep. */
function nestedObject(levels) {
  let o = { end: true };
  for (let i = 0; i < levels; i++) o = { a: o };
  return o;
}

run("Versions and inputs", async () => {
  const a = await signup("versions", "Versions");
  const T = a.token;
  const form = (await call("POST", "/v1/forms", T, { title: "V" })).json;
  const rows = () => prisma.formVersion.findMany({ where: { formId: form.id }, orderBy: { version: "asc" } });

  // ---------- ids ----------
  const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const sample = [form.id, form.workspaceId, (await rows())[0].id, a.id];
  check("ids of forms, workspaces, versions and users are random v4 UUIDs", sample.every((id) => v4.test(id)), sample.join(" "));

  // ---------- every save inserts one ----------
  let n = (await rows()).length;
  let r = await call("PUT", `/v1/forms/${form.id}/schema`, T, { title: "V", blocks: [q("a", "One")] });
  check("a save inserts one version", ok(r) && (await rows()).length === n + 1, short(r));
  n = (await rows()).length;
  r = await call("PUT", `/v1/forms/${form.id}/schema`, T, { title: "V", blocks: [q("a", "One")] });
  check("an identical save → 409 NO_CHANGES and no row", r.status === 409 && r.json?.code === "NO_CHANGES" && (await rows()).length === n, short(r));

  // ---------- concurrent saves (two tabs at the same moment) ----------
  n = (await rows()).length;
  const burst = await Promise.all(
    Array.from({ length: 8 }, (_, i) => call("PUT", `/v1/forms/${form.id}/schema`, T, { title: "V", blocks: [q("a", `Tab ${i}`)] })),
  );
  const codes = burst.map((x) => (ok(x) ? 200 : `${x.status}:${x.json?.code}`));
  const after = await rows();
  const nums = after.map((x) => x.version);
  check("8 simultaneous saves: no 500, versions unique and gapless",
    !burst.some((x) => x.status >= 500) && new Set(nums).size === nums.length && nums.every((v, i) => v === i + 1),
    `results ${codes.join(", ")}; ${after.length - n} rows added`);

  // ---------- stale save (two tabs, one behind) ----------
  const base = (await call("GET", `/v1/forms/${form.id}`, T)).json.versions[0];
  r = await call("PUT", `/v1/forms/${form.id}/schema`, T, { title: "V", blocks: [q("a", "Tab 1's careful edit"), q("b", "Added in tab 1")] });
  const tab1 = r.json?.version;
  // Tab 2 opened at `base` and now saves its own change, with no idea tab 1 saved.
  r = await call("PUT", `/v1/forms/${form.id}/schema`, T, { title: "V", blocks: [q("a", "Tab 2's edit")] });
  const latest = (await call("GET", `/v1/forms/${form.id}/artifact`, T)).json;
  check("a save from a tab that is behind → refused, not silently replacing the newer version",
    !ok(r), `tab 2 opened at v${base.version}, tab 1 saved v${tab1}, tab 2 then saved → ${r.status} v${r.json?.version}; the download now has ${latest.blocks.length} question(s): ${latest.blocks.map((b) => JSON.stringify(b.label)).join(", ")}`);
  note("the save request carries no base version", "PUT /v1/forms/:id/schema takes the schema only (apps/web/src/lib/api.ts saveSchema); the server compares with nothing but the latest content");

  // ---------- restore ----------
  n = (await rows()).length;
  const first = (await rows())[1];
  r = await call("POST", `/v1/forms/${form.id}/versions/${first.id}/restore`, T);
  const restored = (await rows()).at(-1);
  check("restore appends a new version labelled with its source, old rows untouched",
    ok(r) && (await rows()).length === n + 1 && restored.label === `Restored from v${first.version}`, short(r));

  // ---------- download ----------
  const before = JSON.stringify(await rows());
  const d1 = await call("GET", `/v1/forms/${form.id}/artifact`, T);
  const d2 = await call("GET", `/v1/forms/${form.id}/artifact`, T);
  check("download twice: the latest version, and nothing written",
    d1.json.formVersionId === restored.id && d1.text === d2.text && JSON.stringify(await rows()) === before,
    `formVersionId ${d1.json.formVersionId}; content-disposition ${d1.headers.get("content-disposition")}`);

  // ---------- body limits ----------
  const big = (kb) => JSON.stringify({ settingsPaneWidth: 400, pad: "x".repeat(kb * 1024) });
  r = await call("PATCH", "/v1/auth/me/preferences", T, big(150));
  check("150 KB on an ordinary route → 413", r.status === 413, short(r));
  r = await call("PUT", `/v1/forms/${form.id}/schema`, null, JSON.stringify({ title: "x", blocks: [], pad: "x".repeat(1024 * 1024) }));
  check("1 MB save without sign-in → 413 (the 10 MB limit is for signed-in authors only)", r.status === 413, short(r));
  r = await call("PUT", `/v1/forms/${form.id}/schema`, T, JSON.stringify({ title: "x", blocks: [], pad: "x".repeat(11 * 1024 * 1024) }));
  check("11 MB signed-in save → 413", r.status === 413, short(r));
  r = await call("POST", "/v1/auth/login", null, "{not json");
  check("malformed JSON → 400", r.status === 400, short(r));

  // ---------- deeply nested JSON ----------
  for (const levels of [20, 60, 130, 200]) {
    r = await call("PUT", `/v1/forms/${form.id}/schema`, T, { title: "V", blocks: [nestedGroups(levels)] });
    check(`form save, groups nested ${levels} deep → not a 500`, r.status < 500, short(r));
  }
  r = await call("PUT", `/v1/forms/${form.id}/schema`, T, { title: "V", blocks: [{ ...q("x", "X"), extra: nestedObject(300) }] });
  check("form save, an unknown key holding 300-deep JSON → not a 500", r.status < 500, short(r));
  r = await call("POST", "/v1/templates", T, { kind: "group", name: "deep", content: nestedGroups(200) });
  check("group template, groups nested 200 deep → not a 500", r.status < 500, short(r));
  r = await call("POST", "/v1/templates", T, { kind: "form", name: "deep", content: { title: "x", blocks: [q("x", "X")], extra: nestedObject(300) } });
  check("form template, an unknown key holding 300-deep JSON → not a 500", r.status < 500, short(r));
  r = await call("PATCH", "/v1/auth/me/preferences", T, { settingsPaneWidth: nestedObject(300) });
  check("preferences, 300-deep JSON → not a 500", r.status < 500, short(r));
  const deepest = await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } });
  let depth = 0;
  const walk = (b, d) => { depth = Math.max(depth, d); for (const c of b.blocks || []) walk(c, d + 1); };
  for (const b of deepest.schema.blocks) walk(b, 1);
  note("deepest group nesting actually stored", `${depth} levels (version ${deepest.version})`);
});
