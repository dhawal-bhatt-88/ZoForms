// Phase 7, checkpoint 1: pages and navigation through the real API and database.
const { API, PrismaClient, opts } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const leaf = (id, type = "short", extra = {}) => ({ id, type, label: id.toUpperCase(), ...extra });
const group = (id, blocks, extra = {}) => ({ id, type: "group", label: id.toUpperCase(), blocks, ...extra });
const page = (id, blocks, extra = {}) => ({ id, type: "page", title: id.toUpperCase(), blocks, ...extra });
const YN = { options: opts("Yes", "No") };
// Postgres jsonb reorders object keys, so compare stored objects by content.
const sameNav = (a, b) => JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b).sort());

const valid = {
  title: "Pages verify",
  blocks: [
    page("p1", [leaf("name"), leaf("meds", "choice", YN)]),
    page("p2", [leaf("drug")], { enableWhen: [{ question: "meds", operator: "=", answer: "yes" }] }),
    page("p3", [
      group("dosage", [leaf("dose", "number"), group("sched", [leaf("freq", "dropdown", { options: opts("Daily", "Weekly"), required: true })])],
        { enableWhen: [{ question: "meds", operator: "=", answer: "yes" }, { question: "name", operator: "exists" }], enableBehavior: "all" }),
      leaf("notes"),
    ]),
  ],
};

(async () => {
  const email = `verify-pages-${Date.now()}@example.test`;
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Pages" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Pages" }) })).json();
    const put = (schema) => fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const artifact = async () => (await fetch(`${API}/v1/forms/${form.id}/artifact`, { headers: H })).json();
    const stored = async () => (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } })).schema;
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });

    // ---------- save + download ----------
    const saved = await put(valid);
    check("paged form with nested groups saves (200)", saved.status === 200, `${saved.status} ${await saved.clone().text()}`);
    let art = await artifact();
    check("artifact: schemaVersion 2, identity after the title", art.schemaVersion === 2 && Object.keys(art).slice(0, 4).join() === "title,formId,formVersionId,schemaVersion", Object.keys(art).join());
    check("page shape exactly id, type, title, blocks (+ enableWhen when set)",
      Object.keys(art.blocks[0]).join() === "id,type,title,blocks" && Object.keys(art.blocks[1]).join() === "id,type,title,enableWhen,blocks",
      Object.keys(art.blocks[0]).join() + " / " + Object.keys(art.blocks[1]).join());
    check("pages carry no required, label or help text", art.blocks.every((p) => !("required" in p) && !("label" in p) && !("description" in p)));
    check("groups inside pages keep the group shape", art.blocks[2].blocks[0].type === "group" && art.blocks[2].blocks[0].blocks[1].blocks[0].id === "freq");
    check('explicit enableBehavior "all" is not stored', !("enableBehavior" in (await stored()).blocks[2].blocks[0]) && !("enableBehavior" in art.blocks[2].blocks[0]));
    check("paged form with no navigation set: both fields explicit, defaults", JSON.stringify(art.navigation) === '{"showProgress":true,"progressStyle":"caption","reviewPage":false}', JSON.stringify(art.navigation));

    // ---------- navigation ----------
    await put({ ...valid, navigation: { reviewPage: true } });
    art = await artifact();
    check("author's value plus the default for the unset field", JSON.stringify(art.navigation) === '{"showProgress":true,"progressStyle":"caption","reviewPage":true}', JSON.stringify(art.navigation));
    check("stored at the top level, as the author left it", sameNav((await stored()).navigation, { reviewPage: true }), JSON.stringify((await stored()).navigation));
    const same = await put({ ...valid, navigation: { reviewPage: true } });
    check("same navigation again -> 409 NO_CHANGES", same.status === 409 && (await same.json()).code === "NO_CHANGES");
    const unpaged = { title: "Pages verify", blocks: [leaf("name"), leaf("meds", "choice", YN)], navigation: { reviewPage: true, showProgress: false } };
    const u = await put(unpaged);
    art = await artifact();
    check("unpaged form: navigation omitted from the artifact", u.status === 200 && !("navigation" in art), JSON.stringify(art.navigation));
    check("…but kept in storage, for when pages come back", sameNav((await stored()).navigation, { showProgress: false, reviewPage: true }), JSON.stringify((await stored()).navigation));
    await put({ ...valid, navigation: { reviewPage: true, showProgress: false } });
    check("pages added again: the kept choices return", JSON.stringify((await artifact()).navigation) === '{"showProgress":false,"progressStyle":"caption","reviewPage":true}');

    // ---------- rejections ----------
    const before = await rows();
    const clone = () => JSON.parse(JSON.stringify(valid));
    const cases = [
      ["page inside a group", (() => { const s = clone(); s.blocks[2].blocks[0].blocks.push(page("inner", [leaf("x")])); return s; })(),
        /^Page "P3 › DOSAGE › INNER": a page can only be at the top level of the form, not inside a group or another page\./],
      ["page inside a page", (() => { const s = clone(); s.blocks[0].blocks.push(page("inner", [leaf("x")])); return s; })(),
        /^Page "P1 › INNER": a page can only be at the top level/],
      ["mixed root", (() => { const s = clone(); s.blocks.push(leaf("loose")); return s; })(),
        /^Block "LOOSE": this form has pages, so every block must be inside a page\./],
      ["blank page title", (() => { const s = clone(); s.blocks[1].title = " "; return s; })(),
        /^Page 2 \(untitled\): a page needs a title\./],
      ["empty page", (() => { const s = clone(); s.blocks.push(page("p4", [])); return s; })(),
        /^Page "P4": a page must contain at least one block\./],
      ["page as a condition source", (() => { const s = clone(); s.blocks[2].blocks[1].enableWhen = [{ question: "p1", operator: "exists" }]; return s; })(),
        /^Block "P3 › NOTES": "P1" is a page block, which can't be used in a condition\./],
      ["first page with a condition", (() => { const s = clone(); s.blocks[0].enableWhen = [{ question: "meds", operator: "exists" }]; return s; })(),
        /^Page "P1": the first page can't have conditions — it is always shown\./],
      ["ordering across pages", (() => { const s = clone(); s.blocks[0].blocks[0].enableWhen = [{ question: "notes", operator: "exists" }]; return s; })(),
        /^Block "P1 › NAME": a condition depends on "NOTES", which comes after it\./],
      ["page depends on its own question", (() => { const s = clone(); s.blocks[2].enableWhen = [{ question: "dose", operator: "exists" }]; return s; })(),
        /^Page "P3": a condition depends on "DOSE", which is inside this page\. A page can't depend on its own questions\./],
      ["error naming: page title first, then groups", (() => { const s = clone(); s.blocks[2].blocks[0].blocks[1].blocks[0].enableWhen = [{ question: "meds", operator: "=", answer: "Maybe" }]; return s; })(),
        /^Block "P3 › DOSAGE › SCHED › FREQ": the answer "Maybe" isn't the code of any option of "MEDS"\./],
      ["schema error inside a page names the path", (() => { const s = clone(); s.blocks[2].blocks[0].blocks[1].blocks[0].options = "x"; return s; })(),
        /^Block "P3 › DOSAGE › SCHED › FREQ" \(options\):/],
      ["schema error, unlabelled question in a page", (() => { const s = clone(); s.blocks[0].blocks[1].label = ""; return s; })(),
        /^Block 2 inside "P1" \(label\):/],
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
