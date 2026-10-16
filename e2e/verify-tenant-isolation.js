// Tenant isolation through the API: one organisation can't see, change or download
// another's forms, versions, artifacts or templates. Every refusal is the same 404 as
// for an id that doesn't exist, and every refused write leaves the database as it was.
const { API, PrismaClient } = require("./_setup");
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
  return { status: r.status, text, json };
}
const short = (r) => `${r.status} ${r.text.slice(0, 160)}`;
// What a refusal says, without the request path and timestamp every error carries.
const refusal = (r) => JSON.stringify([r.status, r.json?.statusCode, r.json?.message, r.json?.error]);

const q = (id, label) => ({ id, type: "short", label, required: false });
const MISSING = "00000000-0000-4000-8000-000000000000";

(async () => {
  const tag = Date.now();
  const createdEmails = [];
  try {
    const signup = async (who) => {
      const email = `verify-isolation-${who}-${tag}@example.test`;
      createdEmails.push(email);
      const r = await call("POST", "/v1/auth/signup", null, { email, password: "Verify-pass-123!", name: who });
      if (r.status >= 300) throw new Error(`signup ${who}: ${r.status} ${r.text}`);
      return r.json.token;
    };
    const A = await signup("a");
    const B = await signup("b");

    // Organisation A: a form with two saved versions, a group template and a form template.
    const form = (await call("POST", "/v1/forms", A, { title: "A's form" })).json;
    await call("PUT", `/v1/forms/${form.id}/schema`, A, { title: "A's form", blocks: [q("secret", "A's secret question")] });
    const groupTpl = (await call("POST", "/v1/templates", A, {
      kind: "group", name: "A's group", content: { id: "g", type: "group", label: "A's group", blocks: [q("gq", "A's group question")] },
    })).json;
    const formTpl = (await call("POST", "/v1/templates", A, {
      kind: "form", name: "A's form template", content: { title: "A's form template", blocks: [q("fq", "A's template question")] },
    })).json;
    // Organisation B: a form of its own, for the version-id and list checks.
    const bForm = (await call("POST", "/v1/forms", B, { title: "B's form" })).json;
    const bTpl = (await call("POST", "/v1/templates", B, {
      kind: "group", name: "B's group", content: { id: "h", type: "group", label: "B's group", blocks: [q("hq", "B's question")] },
    })).json;
    check("setup: both organisations have their forms and templates", form?.id && bForm?.id && groupTpl?.id && formTpl?.id && bTpl?.id);

    const formRow = () => prisma.form.findUnique({ where: { id: form.id } });
    const versionRows = (formId) => prisma.formVersion.findMany({ where: { formId }, orderBy: { version: "asc" } });
    const templateRow = (id) => prisma.template.findUnique({ where: { id } });
    const formsInB = () => prisma.form.count({ where: { workspace: { org: { memberships: { some: { user: { email: createdEmails[1] } } } } } } });
    const aVersions = await versionRows(form.id);
    const aForm = await formRow();
    const aGroupTpl = await templateRow(groupTpl.id);
    const aFormTpl = await templateRow(formTpl.id);
    const bFormsBefore = await formsInB();
    const latest = aVersions[aVersions.length - 1];

    // ---------- the same 404 as for an id that doesn't exist ----------
    const unknownForm = await call("GET", `/v1/forms/${MISSING}`, B);
    const unknownTemplate = await call("GET", `/v1/templates/${MISSING}`, B);
    const sameAsUnknown = (r, unknown) => r.status === 404 && refusal(r) === refusal(unknown);

    // ---------- forms: see ----------
    let r = await call("GET", "/v1/forms", B);
    check("B's form list: only B's own form", r.status === 200 && r.json.length === 1 && r.json[0].id === bForm.id, short(r));
    r = await call("GET", "/v1/forms", A);
    check("A's form list: no B form", r.status === 200 && !r.json.some((f) => f.id === bForm.id), short(r));
    r = await call("GET", `/v1/forms/${form.id}`, B);
    check("B: GET A's form → 404, as for an unknown id", sameAsUnknown(r, unknownForm), short(r));
    check("…and none of A's content in the reply", !r.text.includes("secret") && !r.text.includes("A's form"));

    // ---------- forms: download ----------
    r = await call("GET", `/v1/forms/${form.id}/artifact`, B);
    check("B: download A's artifact → 404, as for an unknown id", sameAsUnknown(r, await call("GET", `/v1/forms/${MISSING}/artifact`, B)), short(r));
    check("…and none of A's content in the reply", !r.text.includes("secret"));

    // ---------- versions: see, restore ----------
    r = await call("GET", `/v1/forms/${form.id}/versions`, B);
    check("B: list A's versions → 404, as for an unknown id", sameAsUnknown(r, await call("GET", `/v1/forms/${MISSING}/versions`, B)), short(r));
    r = await call("POST", `/v1/forms/${form.id}/versions/${aVersions[0].id}/restore`, B);
    check("B: restore a version of A's form → 404", r.status === 404, short(r));
    r = await call("POST", `/v1/forms/${bForm.id}/versions/${latest.id}/restore`, B);
    check("B: restore A's version id into B's own form → 404", r.status === 404, short(r));
    const bVersions = await versionRows(bForm.id);
    check("…B's form keeps only its own version, none of A's content", bVersions.length === 1 && !JSON.stringify(bVersions[0].schema).includes("secret"));

    // ---------- forms: change ----------
    r = await call("PUT", `/v1/forms/${form.id}/schema`, B, { title: "Taken", blocks: [q("x", "B's question")] });
    check("B: save A's form → 404", r.status === 404, short(r));
    // The editor renames a form by saving its schema with a new title.
    r = await call("PUT", `/v1/forms/${form.id}/schema`, B, { ...latest.schema, title: "Taken" });
    check("B: rename A's form (its content, only the title changed) → 404", r.status === 404, short(r));
    r = await call("POST", `/v1/forms/${form.id}/duplicate`, B);
    check("B: duplicate A's form → 404", r.status === 404, short(r));
    check("…B gets no copy", (await formsInB()) === bFormsBefore, `${await formsInB()} vs ${bFormsBefore}`);
    r = await call("DELETE", `/v1/forms/${form.id}`, B);
    check("B: delete A's form → 404", r.status === 404, short(r));

    const aFormAfter = await formRow();
    check("A's form row unchanged after every refused write", aFormAfter && JSON.stringify(aFormAfter) === JSON.stringify(aForm));
    check("A's versions unchanged after every refused write", JSON.stringify(await versionRows(form.id)) === JSON.stringify(aVersions));
    r = await call("GET", `/v1/forms/${form.id}/artifact`, A);
    check("A still downloads its own form, as saved", r.status === 200 && r.json.formVersionId === latest.id && r.json.blocks[0].label === "A's secret question", short(r));

    // ---------- templates: see ----------
    r = await call("GET", "/v1/templates", B);
    check("B's template list: none of A's", r.status === 200 && !r.json.some((t) => t.id === groupTpl.id || t.id === formTpl.id), short(r));
    r = await call("GET", "/v1/templates?kind=group", B);
    check("B's group-template list: B's own and no A template", r.status === 200 && r.json.some((t) => t.id === bTpl.id) && !r.json.some((t) => t.id === groupTpl.id), short(r));
    r = await call("GET", "/v1/templates", A);
    check("A's template list: no B template", r.status === 200 && !r.json.some((t) => t.id === bTpl.id), short(r));
    for (const tpl of [groupTpl, formTpl]) {
      r = await call("GET", `/v1/templates/${tpl.id}`, B);
      check(`B: GET A's ${tpl.kind} template → 404, as for an unknown id`, sameAsUnknown(r, unknownTemplate), short(r));
      check("…and none of A's content in the reply", !r.text.includes("A's"));
    }

    // ---------- templates: use, change ----------
    r = await call("POST", "/v1/forms", B, { templateId: formTpl.id });
    check("B: a form from A's form template → 404", r.status === 404, short(r));
    check("…B gets no form", (await formsInB()) === bFormsBefore);
    r = await call("PATCH", `/v1/templates/${groupTpl.id}`, B, { name: "Taken" });
    check("B: rename A's template → 404", r.status === 404, short(r));
    r = await call("PATCH", `/v1/templates/${groupTpl.id}`, B, {
      content: { id: "g", type: "group", label: "Taken", blocks: [q("x", "B's question")] }, version: 1,
    });
    check("B: save new content into A's template → 404", r.status === 404, short(r));
    r = await call("POST", `/v1/templates/${groupTpl.id}/duplicate`, B);
    check("B: duplicate A's template → 404", r.status === 404, short(r));
    r = await call("GET", "/v1/templates?kind=group", B);
    check("…B gets no copy", r.status === 200 && !r.json.some((t) => t.name.includes("A's group")), short(r));
    r = await call("DELETE", `/v1/templates/${formTpl.id}`, B);
    check("B: delete A's template → 404", r.status === 404, short(r));
    check("A's templates unchanged after every refused write",
      JSON.stringify(await templateRow(groupTpl.id)) === JSON.stringify(aGroupTpl) && JSON.stringify(await templateRow(formTpl.id)) === JSON.stringify(aFormTpl));
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
