// Checkpoint 1: groups through the real API and database — save, download,
// restore, no-change detection, and every save-time rule with its message.
const { API, PrismaClient, opts } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const leaf = (id, type = "short", extra = {}) => ({ id, type, label: id.toUpperCase(), ...extra });
const group = (id, blocks, extra = {}) => ({ id, type: "group", label: id.toUpperCase(), blocks, ...extra });

// Four groups deep, a conditional group using "any", and a question after the groups.
const valid = {
  title: "Groups verify",
  blocks: [
    leaf("attend", "choice", { options: opts("Yes", "No") }),
    group("med", [
      leaf("drug"),
      group("dose", [group("timing", [group("detail", [leaf("mg", "number", { required: true })])])]),
    ], { enableWhen: [{ question: "attend", operator: "=", answer: "yes" }] }),
    group("follow", [leaf("why")], {
      enableBehavior: "any",
      enableWhen: [{ question: "attend", operator: "=", answer: "no" }, { question: "mg", operator: ">", answer: 5 }],
    }),
    leaf("after", "email"),
  ],
};

(async () => {
  const email = `verify-groups-${Date.now()}@example.test`;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Groups" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Groups" }) })).json();
    const put = (schema) => fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });

    // ---------- save + download ----------
    const saved = await put(valid);
    check("nested form saves (200)", saved.status === 200, `${saved.status} ${await saved.clone().text()}`);
    const dl = await fetch(`${API}/v1/forms/${form.id}/artifact`, { headers: H });
    const art = await dl.json();
    check("artifact has schemaVersion 2", art.schemaVersion === 2, JSON.stringify(art.schemaVersion));
    check("artifact key order: title, formId, formVersionId, schemaVersion", JSON.stringify(Object.keys(art).slice(0, 4)) === '["title","formId","formVersionId","schemaVersion"]', Object.keys(art).join(","));
    const med = art.blocks[1];
    check("group shape exactly id, type, label, enableWhen, blocks", JSON.stringify(Object.keys(med)) === '["id","type","label","enableWhen","blocks"]', Object.keys(med).join(","));
    check("group carries no required", !("required" in med) && !("required" in art.blocks[2]));
    const mg = med.blocks[1].blocks[0].blocks[0].blocks[0];
    check("question four groups deep survives intact", mg.id === "mg" && mg.required === true && mg.type === "number", JSON.stringify(mg));
    check("'any' stored on the group", art.blocks[2].enableBehavior === "any");

    // ---------- no-change detection across nesting ----------
    const reordered = JSON.parse(JSON.stringify(valid));
    reordered.blocks[1] = { blocks: reordered.blocks[1].blocks, enableWhen: reordered.blocks[1].enableWhen, label: "MED", type: "group", id: "med" };
    const same = await put(reordered);
    check("identical nested content, keys reordered -> 409 NO_CHANGES", same.status === 409 && (await same.json()).code === "NO_CHANGES");

    // ---------- restore ----------
    const changed = JSON.parse(JSON.stringify(valid));
    changed.blocks[3].label = "Changed";
    await put(changed);
    const versions = await (await fetch(`${API}/v1/forms/${form.id}/versions`, { headers: H })).json();
    const v2 = versions.find((v) => v.version === 2);
    const restore = await fetch(`${API}/v1/forms/${form.id}/versions/${v2.id}/restore`, { method: "POST", headers: H });
    const afterRestore = await (await fetch(`${API}/v1/forms/${form.id}/artifact`, { headers: H })).json();
    check("restoring a version with groups works", restore.status === 201 && afterRestore.blocks[3].label === "AFTER", `${restore.status}`);

    // ---------- rejections ----------
    const before = await rows();
    const clone = () => JSON.parse(JSON.stringify(valid));
    const cases = [
      ["ordering: source deep in a later group", (() => { const s = clone(); s.blocks[0] = leaf("attend", "choice", { options: opts("Yes", "No"), enableWhen: [{ question: "mg", operator: "exists" }] }); return s; })(),
        /^Block "ATTEND": a condition depends on "MG", which comes after it\./],
      ["group depends on its own descendant", (() => { const s = clone(); s.blocks[1].enableWhen = [{ question: "mg", operator: "exists" }]; return s; })(),
        /^Group "MED": a condition depends on "MG", which is inside this group\./],
      ["group used as a source", (() => { const s = clone(); s.blocks[3].enableWhen = [{ question: "med", operator: "exists" }]; return s; })(),
        /^Block "AFTER": "MED" is a group block, which can't be used in a condition\./],
      ["duplicate id across nesting", (() => { const s = clone(); s.blocks[3].id = "mg"; return s; })(),
        /same id "mg"/],
      ["blank group label at the root", (() => { const s = clone(); s.blocks[2].label = "   "; return s; })(),
        /^An unlabelled group at the top level: a group needs a label\./],
      ["blank group label nested", (() => { const s = clone(); s.blocks[1].blocks[1].label = ""; return s; })(),
        /^An unlabelled group inside "MED": a group needs a label\./],
      ["empty group four deep", (() => { const s = clone(); s.blocks[1].blocks[1].blocks[0].blocks[0].blocks = []; return s; })(),
        /^Group "MED › DOSE › TIMING › DETAIL": a group must contain at least one block\./],
      ["existing rule inside a group: answer not an option", (() => { const s = clone(); s.blocks[1].enableWhen = [{ question: "attend", operator: "=", answer: "Maybe" }]; return s; })(),
        /^Group "MED": the answer "Maybe" isn't the code of any option of "ATTEND"\./],
      ["schema error names the nested question, not the group", (() => { const s = clone(); s.blocks[1].blocks[0].label = ""; return s; })(),
        /^Block 1 inside "MED" \(label\):/],
      ["schema error deep inside, with a label", (() => { const s = clone(); s.blocks[1].blocks[1].blocks[0].blocks[0].blocks[0].options = "x"; return s; })(),
        /^Block "MED › DOSE › TIMING › DETAIL › MG" \(options\):/],
      ["unknown block type inside a group", (() => { const s = clone(); s.blocks[2].blocks[0] = { id: "p", type: "carousel", label: "P" }; return s; })(),
        /^Block "FOLLOW › P" \(type\):/],
    ];
    for (const [name, body, re] of cases) {
      const r = await put(body);
      const msg = (await r.json()).message;
      check(`400: ${name}`, r.status === 400 && re.test(msg), `${r.status} ${msg}`);
    }
    check("rejected saves created no versions", (await rows()) === before);
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
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
