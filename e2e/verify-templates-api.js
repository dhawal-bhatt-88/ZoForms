// Templates through the API: create, list, get, edit, delete and duplicate for both kinds;
// version on content saves only; 403 on system templates, 404 across organisations, viewers
// read-only; every save rule applied to templates; settings a template never keeps; a form
// from a form template; templateRef never in a download or the public form; the seed run
// twice, and a bad file skipped while the rest load; body limits. API only.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { ROOT, API, PrismaClient, opts } = require("./_setup");
const { groupFromTemplate, pageForTemplateGroup, allBlockIds, walkBlocks } = require(path.join(ROOT, "packages/form-schema/dist"));
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, p, token, body, raw) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(API + p, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: r.status, text, json };
}
const short = (r) => `${r.status} ${r.text.slice(0, 300)}`;

/* ---------- fixtures ---------- */

const q = (id, type = "short", extra = {}) => ({ id, type, label: id[0].toUpperCase() + id.slice(1), required: false, ...extra });
const when = (question, operator, answer) => ({ question, operator, ...(answer === undefined ? {} : { answer }) });

/** A deep group: nested repeats, conditions at several depths, mixed logic. Conditions are sent without ids. */
const household = () => ({
  id: "house", type: "group", label: "Household", blocks: [
    q("smoke", "choice", { options: opts("Yes", "No") }),
    { id: "smoking", type: "group", label: "Smoking", enableWhen: [when("smoke", "=", "yes")], blocks: [
      q("packs", "number"),
      { id: "members", type: "group", label: "Members", repeats: true, repeatLabel: "member", minOccurs: 1, blocks: [
        q("mage", "number"),
        { id: "meds", type: "group", label: "Meds", repeats: true, repeatLabel: "medicine", minOccurs: 0, blocks: [
          q("drug"),
          q("dose", "short", { enableWhen: [when("drug", "exists"), when("mage", ">", 60), when("smoke", "=", "yes")], enableLogicText: "1 AND (2 OR 3)" }),
        ] },
      ] },
    ] },
  ],
});

(async () => {
  const tag = Date.now();
  const emails = [];
  let seedDir;
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const signup = async (who) => {
      const email = `verify-templates-api-${who}-${tag}@example.test`;
      emails.push(email);
      const r = await call("POST", "/v1/auth/signup", null, { email, password: "Verify-pass-123!", name: who });
      if (r.status >= 300) throw new Error(`signup ${who}: ${short(r)}`);
      return r.json.token;
    };
    const A = await signup("a");
    const B = await signup("b");
    const V = await signup("viewer");
    const viewer = await prisma.user.findUnique({ where: { email: emails[2] }, include: { memberships: true } });
    await prisma.membership.update({ where: { id: viewer.memberships[0].id }, data: { role: "VIEWER" } });

    // ---------- list: system templates for everyone ----------
    let r = await call("GET", "/v1/templates", A);
    const system = (r.json ?? []).filter((t) => t.scope === "system");
    check("list: 200, with the 16 system form templates", r.status === 200 && system.length === 16 && system.every((t) => t.kind === "form"), short(r));
    check("list: no content in the list, no orgId, a scope on each", r.json.every((t) => !("content" in t) && !("orgId" in t) && ["system", "organisation"].includes(t.scope)));
    check("list: the starter templates are there by name", ["Customer Feedback & NPS Survey", "Job Application", "Testimonial Collector"].every((n) => system.some((t) => t.name === n)));
    r = await call("GET", "/v1/templates?kind=group", A);
    check("list ?kind=group: no system group templates yet", r.status === 200 && r.json.length === 0, short(r));
    r = await call("GET", "/v1/templates?kind=page", A);
    check("list ?kind=page: 400", r.status === 400 && r.json.message === 'kind must be "form" or "group".', short(r));
    r = await call("GET", "/v1/templates", null);
    check("list without signing in: 401", r.status === 401, short(r));

    // ---------- create, both kinds ----------
    r = await call("POST", "/v1/templates", A, { kind: "group", name: "  Household  ", description: "Who lives here", content: household() });
    const group = r.json;
    check("create group template: 201, version 1, organisation scope, name trimmed", r.status === 201 && group.version === 1 && group.scope === "organisation" && group.name === "Household" && group.kind === "group", short(r));
    const storedGroup = await prisma.template.findUnique({ where: { id: group?.id } });
    const conditions = walkBlocks([storedGroup.content]).flatMap((e) => e.block.enableWhen ?? []);
    check("stored: condition ids filled at save", conditions.length === 4 && conditions.every((c) => /^c_[0-9a-z]{8}$/.test(c.id)), JSON.stringify(conditions));
    check("stored: logic text kept exactly", walkBlocks([storedGroup.content]).find((e) => e.block.id === "dose").block.enableLogicText === "1 AND (2 OR 3)");
    check("stored: the group itself, not a form", storedGroup.content.type === "group" && storedGroup.content.id === "house" && !("title" in storedGroup.content));
    check("stored: orgId and createdBy set", storedGroup.orgId !== null && storedGroup.createdBy !== null);

    const formContent = {
      title: "Intake",
      templateRef: { id: "x", version: 9, name: "Old" },
      settings: {
        submitLabel: "Send it",
        notifyEmails: ["owner@client.example"],
        redirectUrl: "https://client.example/thanks",
        spamProtection: true,
        theme: { accent: "#123456", logo: "https://client.example/logo.png", cover: "/uploads/cover.png" },
      },
      blocks: [q("name"), { ...household(), templateRef: { id: "y", version: 1, name: "Inner" } }],
    };
    r = await call("POST", "/v1/templates", A, { kind: "form", name: "Intake", content: formContent });
    const formTpl = r.json;
    check("create form template: 201, version 1", r.status === 201 && formTpl.kind === "form" && formTpl.version === 1, short(r));
    const storedForm = (await prisma.template.findUnique({ where: { id: formTpl?.id } })).content;
    const s = storedForm.settings;
    check("stored: settings that route data or identify the organisation are stripped",
      !("notifyEmails" in s) && !("redirectUrl" in s) && !("logo" in s.theme) && !("cover" in s.theme), JSON.stringify(s));
    check("stored: presentation and behaviour settings are kept",
      s.submitLabel === "Send it" && s.spamProtection === true && s.theme.accent === "#123456" && Object.keys(s).length === 3 && Object.keys(s.theme).length === 1,
      JSON.stringify(s));
    check("stored: no template references in a template, at any depth", !JSON.stringify(storedForm).includes("templateRef"));

    // ---------- get and list ----------
    r = await call("GET", `/v1/templates/${group.id}`, A);
    check("get: 200 with the content", r.status === 200 && r.json.content?.id === "house" && r.json.scope === "organisation", short(r));
    r = await call("GET", `/v1/templates/${system[0].id}`, A);
    check("get a system template: 200 with its content", r.status === 200 && r.json.scope === "system" && Array.isArray(r.json.content?.blocks), short(r));
    r = await call("GET", "/v1/templates?kind=group", A);
    check("list ?kind=group: the organisation's group template only", r.json.length === 1 && r.json[0].id === group.id, short(r));
    r = await call("GET", "/v1/templates", A);
    check("list: system first, then the organisation's", r.json.findIndex((t) => t.scope === "organisation") === 16 && r.json.length === 18, r.json.map((t) => t.scope).join(","));

    // ---------- edit: version on content saves only ----------
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { name: "Household members" });
    check("rename: 200, version unchanged", r.status === 200 && r.json.name === "Household members" && r.json.version === 1, short(r));
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { description: "" });
    check("clear the description: version unchanged", r.status === 200 && r.json.description === null && r.json.version === 1, short(r));
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { content: household() });
    check("the same content again (condition ids not sent): version unchanged", r.status === 200 && r.json.version === 1, short(r));
    const sameIds = walkBlocks([(await prisma.template.findUnique({ where: { id: group.id } })).content]).flatMap((e) => e.block.enableWhen ?? []).map((c) => c.id);
    check("…and the condition ids are kept", JSON.stringify(sameIds) === JSON.stringify(conditions.map((c) => c.id)));
    const changed = household();
    changed.blocks[0].label = "Do you smoke?";
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { content: changed, version: 1 });
    check("changed content: version 2", r.status === 200 && r.json.version === 2, short(r));
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { content: household(), version: 1 });
    check("a save from a stale version: 409 VERSION_CONFLICT", r.status === 409 && r.json.code === "VERSION_CONFLICT", short(r));
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { name: "Renamed", version: 2 });
    check("rename with the current version: version still 2", r.status === 200 && r.json.version === 2 && r.json.name === "Renamed", short(r));
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { kind: "form" });
    check("changing the kind: 400", r.status === 400 && r.json.message === "A template's kind can't be changed.", short(r));
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { name: "   " });
    check("a blank name: 400", r.status === 400 && r.json.message === "A template needs a name.", short(r));

    // ---------- every save rule applies ----------
    const refused = async (name, kind, content, expected) => {
      const res = await call("POST", "/v1/templates", A, { kind, name: "Bad", content });
      const message = res.json?.message ?? "";
      check(`save rule: ${name} (400)`, res.status === 400 && (expected instanceof RegExp ? expected.test(message) : message === expected), short(res));
    };
    const outside = household();
    outside.blocks[1].blocks[1].blocks[1].blocks[1].enableWhen.push(when("elsewhere", "exists"));
    outside.blocks[1].blocks[1].blocks[1].blocks[1].enableLogicText = "1 AND (2 OR 3) AND 4";
    await refused("a condition outside the template", "group", outside,
      `Block "Household › Smoking › Members › Meds › Dose": condition 4 refers to a question outside this template (id "elsewhere"). A template's conditions can only use questions inside it.`);
    await refused("the root group's own condition, outside", "group", { ...household(), enableWhen: [when("before", "exists")] },
      `Group "Household": condition 1 refers to a question outside this template (id "before"). A template's conditions can only use questions inside it.`);
    await refused("the root group's own condition, inside", "group", { ...household(), enableWhen: [when("smoke", "exists")] }, /A group can't depend on its own questions/);
    await refused("a group template that isn't a group", "group", { id: "p", type: "page", title: "P", blocks: [q("x")] }, "A group template holds exactly one group, and nothing else.");
    const badLogic = household();
    badLogic.blocks[1].blocks[1].blocks[1].blocks[1].enableLogicText = "1 AND (2 OR";
    await refused("logic text", "group", badLogic, /^Block "Household › Smoking › Members › Meds › Dose": /);
    await refused("a blank group label", "group", { ...household(), label: " " }, /a group needs a label/);
    await refused("an empty group", "group", { id: "g", type: "group", label: "G", blocks: [] }, /a group must contain at least one block/);
    await refused("an option code", "group", { id: "g", type: "group", label: "G", blocks: [q("c", "choice", { options: [{ code: "has space", label: "A" }] })] },
      `Block "G › C": the code "has space" of option "A" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`);
    await refused("a grid without columns", "group", { id: "g", type: "group", label: "G", blocks: [{ id: "gr", type: "grid", label: "Grid", rows: opts("Row"), columns: [] }] }, `Block "G › Grid": it needs at least one column.`);
    await refused("ordering", "group", { id: "g", type: "group", label: "G", blocks: [q("a", "short", { enableWhen: [when("b", "exists")] }), q("b")] }, /comes after it/);
    await refused("a repeat setting", "group", { id: "g", type: "group", label: "G", repeats: true, minOccurs: -1, blocks: [q("a")] },
      `Group "G": a repeating group needs a name for one entry, such as "patient". (+1 more)`);
    await refused("the schema itself, naming the block", "group", { id: "g", type: "group", label: "G", blocks: [{ id: "a", type: "short", label: "" }] },
      `Block 1 inside "G" (label): String must contain at least 1 character(s)`);
    await refused("drafts that need pages, in a form template", "form", { title: "F", blocks: [q("a")], drafts: { mode: "server" } }, /needs a form with pages/);
    await refused("an outside reference in a form template", "form", { title: "F", blocks: [q("a", "short", { enableWhen: [when("gone", "exists")] })] },
      `Block "A": condition 1 refers to a question outside this template (id "gone"). A template's conditions can only use questions inside it.`);
    r = await call("POST", "/v1/templates", A, { kind: "group", name: "No content" });
    check("no content: 400", r.status === 400 && /content is required/.test(r.json.message), short(r));
    r = await call("POST", "/v1/templates", A, { kind: "page", name: "P", content: household() });
    check("an unknown kind: 400", r.status === 400 && r.json.message === 'kind must be "form" or "group".', short(r));
    r = await call("PATCH", `/v1/templates/${group.id}`, A, { content: outside });
    check("the same rules on edit (400), and nothing changes", r.status === 400 && /outside this template/.test(r.json.message) &&
      (await prisma.template.findUnique({ where: { id: group.id } })).version === 2, short(r));

    // ---------- system templates: 403 on writes ----------
    const sys = system.find((t) => t.name === "Job Application");
    r = await call("PATCH", `/v1/templates/${sys.id}`, A, { name: "Mine now" });
    check("rename a system template: 403", r.status === 403 && r.json.message === "System templates can't be changed. Duplicate it to make your own copy.", short(r));
    r = await call("PATCH", `/v1/templates/${sys.id}`, A, { content: { title: "X", blocks: [] } });
    check("edit a system template's content: 403", r.status === 403, short(r));
    r = await call("DELETE", `/v1/templates/${sys.id}`, A);
    check("delete a system template: 403", r.status === 403, short(r));
    check("…and it is unchanged", (await prisma.template.findUnique({ where: { id: sys.id } }))?.name === "Job Application");

    // ---------- duplicate ----------
    r = await call("POST", `/v1/templates/${sys.id}/duplicate`, A);
    const copy = r.json;
    check("duplicate a system template: an editable organisation copy, version 1", r.status === 201 && copy.name === "Copy of Job Application" && copy.scope === "organisation" && copy.version === 1, short(r));
    const sysRow = await prisma.template.findUnique({ where: { id: sys.id } });
    const copyRow = await prisma.template.findUnique({ where: { id: copy.id } });
    check("…with the same content", JSON.stringify(copyRow.content) === JSON.stringify(sysRow.content));
    const edited = { ...copyRow.content, title: "Our application" };
    r = await call("PATCH", `/v1/templates/${copy.id}`, A, { content: edited });
    check("the copy can be edited (version 2)", r.status === 200 && r.json.version === 2, short(r));
    check("…and the system template is untouched", (await prisma.template.findUnique({ where: { id: sys.id } })).content.title === sysRow.content.title);
    r = await call("POST", `/v1/templates/${group.id}/duplicate`, A);
    check("duplicate the organisation's own: 'Copy of …'", r.status === 201 && r.json.name === "Copy of Renamed" && r.json.kind === "group", short(r));

    // ---------- other organisations: 404 ----------
    r = await call("GET", "/v1/templates", B);
    check("another organisation's list: system templates only", r.status === 200 && r.json.length === 16 && r.json.every((t) => t.scope === "system"), short(r));
    for (const [method, suffix, body] of [["GET", "", undefined], ["PATCH", "", { name: "Mine" }], ["DELETE", "", undefined], ["POST", "/duplicate", undefined]]) {
      r = await call(method, `/v1/templates/${group.id}${suffix}`, B, body);
      check(`another organisation: ${method} ${suffix || ":id"} → 404`, r.status === 404 && r.json.message === "Template not found", short(r));
    }
    r = await call("GET", "/v1/templates/not-a-template", A);
    check("an unknown id: 404", r.status === 404, short(r));

    // ---------- viewers read, don't write ----------
    r = await call("GET", "/v1/templates", V);
    check("a viewer can list", r.status === 200 && r.json.length === 16, short(r));
    r = await call("POST", "/v1/templates", V, { kind: "group", name: "G", content: household() });
    check("a viewer can't create (403)", r.status === 403, short(r));
    r = await call("POST", `/v1/templates/${sys.id}/duplicate`, V);
    check("a viewer can't duplicate (403)", r.status === 403, short(r));
    r = await call("POST", "/v1/forms", V, { templateId: sys.id });
    check("a viewer can't make a form from a template (403)", r.status === 403, short(r));

    // ---------- a form from a form template ----------
    r = await call("POST", "/v1/forms", A, { templateId: formTpl.id });
    const made = r.json;
    check("POST /v1/forms with templateId: 201", r.status === 201 && made.title === "Intake", short(r));
    const madeSchema = (await prisma.formVersion.findFirst({ where: { formId: made.id }, orderBy: { version: "desc" } })).schema;
    const ref = madeSchema.templateRef ?? {};
    check("the form has templateRef { id, version, name }", ref.id === formTpl.id && ref.version === 1 && ref.name === "Intake" && Object.keys(ref).length === 3, JSON.stringify(ref));
    const templateIds = walkBlocks(storedForm.blocks).map((e) => e.block.id);
    const formIds = walkBlocks(madeSchema.blocks).map((e) => e.block.id);
    check("fresh block ids throughout", formIds.length === templateIds.length && formIds.every((id) => /^b_/.test(id) && !templateIds.includes(id)), formIds.join(","));
    const madeDose = walkBlocks(madeSchema.blocks).find((e) => e.block.label === "Dose").block;
    check("conditions follow the new ids; condition ids and logic text kept",
      madeDose.enableWhen.every((c) => formIds.includes(c.question)) && madeDose.enableLogicText === "1 AND (2 OR 3)" &&
      JSON.stringify(madeDose.enableWhen.map((c) => c.id)) === JSON.stringify(walkBlocks(storedForm.blocks).find((e) => e.block.id === "dose").block.enableWhen.map((c) => c.id)));
    check("its settings are the template's", madeSchema.settings.submitLabel === "Send it" && !("notifyEmails" in madeSchema.settings));
    r = await call("GET", `/v1/forms/${made.id}/artifact`, A);
    check("its download has no templateRef", r.status === 200 && !r.text.includes("templateRef") && !r.text.includes(formTpl.id), short(r));
    r = await call("POST", "/v1/forms", A, { templateId: group.id });
    check("a form from a group template: 400", r.status === 400 && /is a group template/.test(r.json.message), short(r));
    r = await call("POST", "/v1/forms", B, { templateId: formTpl.id });
    check("a form from another organisation's template: 404", r.status === 404, short(r));
    r = await call("POST", "/v1/forms", B, { templateId: sys.id });
    const fromSystem = (await prisma.formVersion.findFirst({ where: { formId: r.json?.id } }))?.schema;
    check("any organisation can make a form from a system template", r.status === 201 && fromSystem?.templateRef?.id === sys.id && fromSystem.title === sysRow.content.title, short(r));
    r = await call("POST", "/v1/forms", A, { title: "Plain" });
    const plain = (await prisma.formVersion.findFirst({ where: { formId: r.json.id } })).schema;
    check("a blank form is made as before (no templateRef)", r.status === 201 && plain.title === "Plain" && plain.blocks.length === 0 && !("templateRef" in plain), short(r));

    // ---------- inserted twice, saved, downloaded and published ----------
    const tpl = await call("GET", `/v1/templates/${group.id}`, A);
    const source = { id: group.id, version: tpl.json.version, name: tpl.json.name, content: tpl.json.content };
    let blocks = [q("intro")];
    const one = groupFromTemplate(source, allBlockIds(blocks));
    blocks = [...blocks, one];
    const two = groupFromTemplate(source, allBlockIds(blocks));
    blocks = [...blocks, two];
    const host = (await call("POST", "/v1/forms", A, { title: "Host" })).json;
    r = await call("PUT", `/v1/forms/${host.id}/schema`, A, { title: "Host", blocks });
    check("a form with the group template inserted twice saves (200)", r.status === 200, short(r));
    const hostStored = (await prisma.formVersion.findFirst({ where: { formId: host.id }, orderBy: { version: "desc" } })).schema;
    check("stored: both copies keep templateRef", hostStored.blocks.filter((b) => b.templateRef?.id === group.id).length === 2);
    r = await call("GET", `/v1/forms/${host.id}/artifact`, A);
    check("download: no templateRef, both copies' questions present", r.status === 200 && !r.text.includes("templateRef") && r.json.blocks.length === 3, short(r));
    const paged = [{ id: "p1", type: "page", title: "Start", blocks: [q("first")] }];
    const g3 = groupFromTemplate(source, allBlockIds(paged));
    const withPage = [...paged, pageForTemplateGroup(g3, allBlockIds(paged))];
    r = await call("PUT", `/v1/forms/${host.id}/schema`, A, { title: "Host", blocks: withPage });
    check("inserted as a page in a paged form: saves (200)", r.status === 200, short(r));
    r = await call("GET", `/v1/forms/${host.id}/artifact`, A);
    check("what respondents get (the download) has no templateRef, both pages included", r.status === 200 && !r.text.includes("templateRef") && r.json.blocks.length === 2, short(r));

    // ---------- copies, never links ----------
    const before = JSON.stringify((await prisma.formVersion.findFirst({ where: { formId: made.id }, orderBy: { version: "desc" } })).schema);
    r = await call("PATCH", `/v1/templates/${formTpl.id}`, A, { content: { title: "Different", blocks: [q("other")] } });
    check("editing the template afterwards: 200", r.status === 200 && r.json.version === 2, short(r));
    r = await call("DELETE", `/v1/templates/${formTpl.id}`, A);
    check("deleting it: 200, then 404", r.status === 200 && (await call("GET", `/v1/templates/${formTpl.id}`, A)).status === 404, short(r));
    const after = await prisma.formVersion.findMany({ where: { formId: made.id } });
    check("the form made from it is unchanged", after.length === 1 && JSON.stringify(after[0].schema) === before);

    // ---------- the seed: idempotent ----------
    const seed = (dir) => spawnSync(process.execPath, [path.join(ROOT, "apps/api/dist/templates/seed-cli.js"), ...(dir ? [dir] : [])], { cwd: path.join(ROOT, "apps/api"), encoding: "utf8" });
    const countSystem = () => prisma.template.count({ where: { orgId: null } });
    const systemBefore = await countSystem();
    const first = seed();
    const second = seed();
    check("seed run twice: both succeed, nothing created or updated", first.status === 0 && second.status === 0 &&
      JSON.parse(second.stdout).created === 0 && JSON.parse(second.stdout).updated === 0, `${first.stdout}${first.stderr} | ${second.stdout}${second.stderr}`);
    check("…and no duplicates", (await countSystem()) === systemBefore && systemBefore === 16, `${await countSystem()}`);
    const nps = await prisma.template.findUnique({ where: { id: "sys_form_nps" } });
    await prisma.template.update({ where: { id: "sys_form_nps" }, data: { name: "Tampered" } });
    const third = seed();
    const restored = await prisma.template.findUnique({ where: { id: "sys_form_nps" } });
    check("a changed system template is put back in place, same id and version", third.status === 0 && JSON.parse(third.stdout).updated === 1 &&
      restored.name === nps.name && restored.version === nps.version, `${third.stdout}${third.stderr}`);

    // ---------- the seed: a bad file is skipped, the rest still load ----------
    // A copy of the real files plus extra ones, in a folder of its own; the real set is put back after.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-templates-"));
    seedDir = tmp;
    const realDir = path.join(ROOT, "apps/api/prisma/templates");
    for (const f of fs.readdirSync(realDir)) fs.copyFileSync(path.join(realDir, f), path.join(tmp, f));
    const extraId = `sys_e2e_extra_${tag}`;
    const badId = `sys_e2e_bad_${tag}`;
    const writeTemplate = (file, t) => fs.writeFileSync(path.join(tmp, file), JSON.stringify(t));
    const extra = { id: extraId, kind: "group", name: "E2E extra", content: { id: "g", type: "group", label: "Extra", blocks: [q("one")] } };
    writeTemplate("zz-extra.json", extra);
    writeTemplate("zz-bad.json", { id: badId, kind: "group", name: "E2E bad",
      content: { id: "g", type: "group", label: "Bad", blocks: [q("one", "short", { enableWhen: [when("outside", "exists")] })] } });
    const withBad = seed(tmp);
    const out = JSON.parse(withBad.stdout || "{}");
    check("a bad file is skipped, named with its reason, and the exit code says so", withBad.status === 1 &&
      JSON.stringify(out.skipped) === JSON.stringify(["zz-bad.json"]) &&
      withBad.stderr.includes("System template zz-bad.json was skipped: ") && withBad.stderr.includes('refers to a question outside this template (id "outside")'),
      `${withBad.status} ${withBad.stdout} ${withBad.stderr}`);
    check("…while the rest still load", out.created === 1 && out.unchanged === 16 && out.removed === 0 &&
      !!(await prisma.template.findUnique({ where: { id: extraId } })) && !(await prisma.template.findUnique({ where: { id: badId } })) &&
      (await countSystem()) === 17, withBad.stdout);
    writeTemplate("zz-extra.json", { ...extra, content: { ...extra.content, label: "" } });
    const extraBroken = seed(tmp);
    const kept = await prisma.template.findUnique({ where: { id: extraId } });
    check("a file that goes bad keeps the template loaded from it before", extraBroken.status === 1 &&
      JSON.parse(extraBroken.stdout).skipped.length === 2 && kept?.content.label === "Extra" && kept.version === 1, `${extraBroken.stdout} ${extraBroken.stderr}`);
    fs.unlinkSync(path.join(tmp, "zz-extra.json"));
    fs.writeFileSync(path.join(tmp, "zz-unreadable.json"), "{ not json");
    const unreadable = seed(tmp);
    check("with a file whose id can't be read, nothing is deleted", unreadable.status === 1 && JSON.parse(unreadable.stdout).removed === 0 &&
      !!(await prisma.template.findUnique({ where: { id: extraId } })) && unreadable.stderr.includes("zz-unreadable.json was skipped: it isn't valid JSON"),
      `${unreadable.stdout} ${unreadable.stderr}`);
    const back = seed();
    check("the real set again: the extra template goes, 16 stay", back.status === 0 && JSON.parse(back.stdout).removed === 1 &&
      (await countSystem()) === 16, `${back.stdout} ${back.stderr}`);

    // ---------- body limits ----------
    const bigGroup = { id: "big", type: "group", label: "Big", blocks: [q("list", "dropdown", {
      options: Array.from({ length: 5000 }, (_, k) => ({ code: `code_${k}`, label: `A fairly long option label, number ${k + 1}, for size` })) })] };
    const bigBody = JSON.stringify({ kind: "group", name: "Big", content: bigGroup });
    check("the large template is well over 100 KB", bigBody.length > 300 * 1024, `${Math.round(bigBody.length / 1024)} KB`);
    r = await call("POST", "/v1/templates", A, undefined, bigBody);
    check("a large template saves for a signed-in author (201)", r.status === 201, short(r));
    const bigId = r.json?.id;
    r = await call("PATCH", `/v1/templates/${bigId}`, A, undefined, JSON.stringify({ content: { ...bigGroup, label: "Bigger" } }));
    check("…and edits (200)", r.status === 200 && r.json.version === 2, short(r));
    r = await call("POST", "/v1/templates", "not-a-real-token", undefined, bigBody);
    check("without a valid token it gets the 100 KB limit (413)", r.status === 413 && r.json.message === "The request is too large. The limit is 100 KB.", short(r));
    r = await call("POST", `/v1/templates/${bigId}/duplicate`, A, undefined, JSON.stringify({ pad: "x".repeat(200 * 1024) }));
    check("other template routes keep the 100 KB limit (413)", r.status === 413, short(r));

    // ---------- delete ----------
    r = await call("DELETE", `/v1/templates/${group.id}`, B);
    check("another organisation can't delete it (404)", r.status === 404, short(r));
    r = await call("DELETE", `/v1/templates/${group.id}`, A);
    check("delete own: 200", r.status === 200 && r.json.ok === true, short(r));
    check("…the forms it was inserted into are unchanged", (await prisma.formVersion.count({ where: { formId: host.id } })) === 3);
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    // A seed test that stopped part-way may have left its extra system templates.
    await prisma.template.deleteMany({ where: { orgId: null, id: { startsWith: `sys_e2e_` } } }).catch(() => {});
    if (seedDir) fs.rmSync(seedDir, { recursive: true, force: true });
    for (const email of emails) {
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
