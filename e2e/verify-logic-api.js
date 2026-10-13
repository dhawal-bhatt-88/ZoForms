// Custom condition logic (contract §15) through the real API and database:
// logic text stored exactly, condition ids filled and kept, the exported shape
// for every §15.7 row, content saved before logic text, and every save-time
// rejection with its message — on a question, a group, a page and a question
// inside a repeating group, with the existing condition rules still applied.
const { API, PrismaClient, opts } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

const ID = /^c_[0-9a-z]{8}$/;
const yesNo = (id, label) => ({ id, type: "choice", label, options: opts("Yes", "No") });
const yes = (question, id) => ({ ...(id ? { id } : {}), question, operator: "=", answer: "yes" });
const four = (ids = ["c1", "c2", "c3", "c4"]) => ["q1", "q2", "q3", "q4"].map((q, i) => yes(q, ids[i]));

// Page 1 holds the sources. Page 2 has logic on itself, a question, a group and
// a question inside a repeating group.
const valid = () => ({
  title: "Logic API verify",
  blocks: [
    { id: "p1", type: "page", title: "First", blocks: [
      yesNo("q1", "Q1"), yesNo("q2", "Q2"), yesNo("q3", "Q3"), yesNo("q4", "Q4"),
      { id: "notes", type: "long", label: "Notes" },
    ] },
    { id: "p2", type: "page", title: "Second", enableWhen: [yes("q1", "c1"), yes("q2", "c2")], enableLogicText: "1 or 2", blocks: [
      { id: "d", type: "short", label: "Diet", enableWhen: four(), enableLogicText: "1 OR (2 AND (3 OR 4))" },
      { id: "grp", type: "group", label: "Grp", enableWhen: [yes("q1", "c1"), yes("q2", "c2"), yes("q3", "c3")], enableLogicText: "(1 AND 2) OR 3",
        blocks: [{ id: "x", type: "short", label: "X" }] },
      { id: "rep", type: "group", label: "Rep", repeats: true, repeatLabel: "item", minOccurs: 0, blocks: [
        yesNo("r1", "R1"),
        { id: "rin", type: "short", label: "In repeat", enableWhen: [yes("r1", "c1"), yes("q1", "c2"), yes("q2", "c3")], enableLogicText: "1 AND (2 OR 3)" },
      ] },
      { id: "later", type: "short", label: "Later" },
    ] },
  ],
});
const D = 'Block "Second › Diet"';
/** The form with Diet's conditions and logic replaced. */
const withDiet = (diet) => {
  const s = valid();
  const d = s.blocks[1].blocks[0];
  delete d.enableWhen;
  delete d.enableLogicText;
  Object.assign(d, diet);
  return s;
};
const find = (blocks, id) => {
  for (const b of blocks) {
    if (b.id === id) return b;
    const inner = b.blocks && find(b.blocks, id);
    if (inner) return inner;
  }
};
const every = (blocks, fn) => blocks.every((b) => fn(b) && (!b.blocks || every(b.blocks, fn)));

(async () => {
  const email = `verify-logic-api-${Date.now()}@example.test`;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Logic" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Logic" }) })).json();
    const put = (schema) => fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const artifact = async () => (await fetch(`${API}/v1/forms/${form.id}/artifact`, { headers: H })).json();
    const stored = async () => (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } })).schema;
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });

    // ---------- save: text stored exactly, ids kept ----------
    const saved = await put(valid());
    check("form with logic on a page, a question, a group and in a repeat saves (200)", saved.status === 200, `${saved.status} ${await saved.clone().text()}`);
    let s = await stored();
    check("stored: each item's text exactly as sent",
      find(s.blocks, "p2").enableLogicText === "1 or 2" && find(s.blocks, "d").enableLogicText === "1 OR (2 AND (3 OR 4))"
      && find(s.blocks, "grp").enableLogicText === "(1 AND 2) OR 3" && find(s.blocks, "rin").enableLogicText === "1 AND (2 OR 3)");
    check("stored: no enableLogic or enableBehavior", every(s.blocks, (b) => !("enableLogic" in b) && !("enableBehavior" in b)));
    check("stored: condition ids kept as sent", JSON.stringify(find(s.blocks, "d").enableWhen.map((c) => c.id)) === '["c1","c2","c3","c4"]');

    // ---------- the artifact ----------
    let art = await artifact();
    const raw = JSON.stringify(art);
    check("artifact: no enableLogicText anywhere", !raw.includes("enableLogicText"));
    check("artifact: question's mixed logic as a tree",
      JSON.stringify(find(art.blocks, "d").enableLogic) === JSON.stringify({ any: ["c1", { all: ["c2", { any: ["c3", "c4"] }] }] }),
      JSON.stringify(find(art.blocks, "d").enableLogic));
    check("artifact: question keys end enableWhen, enableLogic", JSON.stringify(Object.keys(find(art.blocks, "d")).slice(-2)) === '["enableWhen","enableLogic"]', Object.keys(find(art.blocks, "d")).join(","));
    check("artifact: group's logic", JSON.stringify(find(art.blocks, "grp").enableLogic) === JSON.stringify({ any: [{ all: ["c1", "c2"] }, "c3"] }));
    check("artifact: page's all-OR logic is enableBehavior any", find(art.blocks, "p2").enableBehavior === "any" && !("enableLogic" in find(art.blocks, "p2")));
    check("artifact: logic on a question inside a repeating group", JSON.stringify(find(art.blocks, "rin").enableLogic) === JSON.stringify({ all: ["c1", { any: ["c2", "c3"] }] }));

    // ---------- every §15.7 valid row, downloaded ----------
    const validRows = [
      ["1 AND 2 AND 3 AND 4", 4, {}],
      ["1 or 2 or 3 or 4", 4, { enableBehavior: "any" }],
      ["1 OR (2 AND (3 OR 4))", 4, { enableLogic: { any: ["c1", { all: ["c2", { any: ["c3", "c4"] }] }] } }],
      ["(1 AND 2) OR (1 AND 3) OR 4", 4, { enableLogic: { any: [{ all: ["c1", "c2"] }, { all: ["c1", "c3"] }, "c4"] } }],
      ["((1 AND 2)) AND (3 AND 4)", 4, {}],
      ["(1 AND 2)OR(3 AND 4)", 4, { enableLogic: { any: [{ all: ["c1", "c2"] }, { all: ["c3", "c4"] }] } }],
      ["(2) AND 1", 2, {}],
    ];
    for (const [text, count, shape] of validRows) {
      const r = await put(withDiet({ enableWhen: four().slice(0, count), enableLogicText: text }));
      const d = find((await artifact()).blocks, "d");
      const logic = Object.fromEntries(["enableBehavior", "enableLogic"].filter((k) => k in d).map((k) => [k, d[k]]));
      check(`§15.7 ${text} → ${JSON.stringify(shape)}`, r.status === 200 && JSON.stringify(logic) === JSON.stringify(shape) && !("enableLogicText" in d),
        `${r.status} ${JSON.stringify(logic)}`);
      check(`§15.7 ${text}: stored text exactly as typed`, find((await stored()).blocks, "d").enableLogicText === text);
    }

    // ---------- the text is the logic ----------
    await put(withDiet({ enableWhen: four(), enableLogicText: "1 AND 2 AND 3 AND 4", enableBehavior: "any", enableLogic: { any: ["c1", "c2", "c3", "c4"] } }));
    s = find((await stored()).blocks, "d");
    art = find((await artifact()).blocks, "d");
    check("a client-sent enableLogic and enableBehavior are ignored for the text",
      !("enableLogic" in s) && !("enableBehavior" in s) && !("enableLogic" in art) && !("enableBehavior" in art));

    // ---------- ids ----------
    const sameNoIds = await put(withDiet({ enableWhen: four([]), enableLogicText: "1 and 2 and 3 and 4" }));
    check("the same conditions sent without ids keep their stored ids",
      sameNoIds.status === 200 && JSON.stringify(find((await stored()).blocks, "d").enableWhen.map((c) => c.id)) === '["c1","c2","c3","c4"]');
    // Different conditions (answer "no"), so they are new and get new ids.
    const noIds = withDiet({ enableWhen: four([]).map((c) => ({ ...c, answer: "no" })), enableLogicText: "1 OR (2 AND (3 OR 4))" });
    const filledRes = await put(noIds);
    const filled = find((await stored()).blocks, "d").enableWhen.map((c) => c.id);
    check("missing ids are filled: c_ and 8 base-36 characters, all different",
      filledRes.status === 200 && filled.every((id) => ID.test(id)) && new Set(filled).size === 4, JSON.stringify(filled));
    const returned = (await filledRes.json()).schema;
    check("the save returns the filled ids", JSON.stringify(find(returned.blocks, "d").enableWhen.map((c) => c.id)) === JSON.stringify(filled));
    const resent = await put(noIds);
    check("the same content sent again without ids is no change (409 NO_CHANGES)", resent.status === 409 && (await resent.json()).code === "NO_CHANGES", `${resent.status}`);
    check("artifact carries the stored ids", JSON.stringify(find((await artifact()).blocks, "d").enableWhen.map((c) => c.id)) === JSON.stringify(filled));

    // ---------- content saved before logic text ----------
    await put(withDiet({ enableWhen: four() }));
    check("legacy flat AND: text generated", find((await stored()).blocks, "d").enableLogicText === "1 AND 2 AND 3 AND 4");
    await put(withDiet({ enableWhen: four(), enableBehavior: "any" }));
    s = find((await stored()).blocks, "d");
    check("legacy flat OR: text generated, enableBehavior not stored", s.enableLogicText === "1 OR 2 OR 3 OR 4" && !("enableBehavior" in s));
    check("legacy flat OR: still exports enableBehavior any", find((await artifact()).blocks, "d").enableBehavior === "any");
    await put(withDiet({ enableWhen: four(), enableLogic: { any: ["c1", { all: ["c2", { any: ["c3", "c4"] }] }] } }));
    s = find((await stored()).blocks, "d");
    check("legacy tree without text: text generated, tree not stored", s.enableLogicText === "1 OR (2 AND (3 OR 4))" && !("enableLogic" in s));

    // A version stored before this change, written straight to the database.
    const legacy = withDiet({ enableWhen: [yes("q1"), yes("q2"), { id: "c1", question: "q3", operator: "exists" }], enableBehavior: "any" });
    await prisma.formVersion.create({ data: { formId: form.id, version: (await rows()) + 1, schema: legacy } });
    const a1 = await artifact();
    const a2 = await artifact();
    const legacyD = find(a1.blocks, "d");
    check("unsaved legacy content downloads with ids c1, c2, … by position, skipping ones it has",
      JSON.stringify(legacyD.enableWhen.map((c) => c.id)) === '["c2","c3","c1"]' && legacyD.enableBehavior === "any", JSON.stringify(legacyD));
    check("downloading it twice gives the same file", JSON.stringify(a1) === JSON.stringify(a2));
    // Then a newer version, and restore the legacy one.
    await prisma.formVersion.create({ data: { formId: form.id, version: (await rows()) + 1, schema: valid() } });
    const legacyVersion = await prisma.formVersion.findFirst({ where: { formId: form.id, version: (await rows()) - 1 } });
    const restored = await fetch(`${API}/v1/forms/${form.id}/versions/${legacyVersion.id}/restore`, { method: "POST", headers: H });
    s = find((await stored()).blocks, "d");
    check("restoring a legacy version stores ids and generated text",
      restored.status === 201 && s.enableLogicText === "1 OR 2 OR 3" && s.enableWhen.every((c) => typeof c.id === "string") && s.enableWhen[2].id === "c1",
      `${restored.status} ${JSON.stringify(s)}`);

    // ---------- one condition left ----------
    await put(withDiet({ enableWhen: [yes("q1", "c1")], enableLogicText: "1 AND 2", enableBehavior: "any", enableLogic: { all: ["c1"] } }));
    s = find((await stored()).blocks, "d");
    art = find((await artifact()).blocks, "d");
    check("an item with one condition drops its text, tree and enableBehavior",
      ["enableLogicText", "enableLogic", "enableBehavior"].every((k) => !(k in s) && !(k in art)), JSON.stringify(s));

    // ---------- rejections ----------
    const before = await rows();
    const exact = (m) => new RegExp("^" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$");
    const diet = (text, count = 4) => withDiet({ enableWhen: four().slice(0, count), enableLogicText: text });
    const cases = [
      ["empty text", diet(""), exact(`${D}: Enter how the conditions combine, e.g. 1 AND 2.`)],
      ["blank text", diet("   "), exact(`${D}: Enter how the conditions combine, e.g. 1 AND 2.`)],
      ["mixed AND and OR", diet("1 AND 2 OR 3 AND 4"), exact(`${D}: Add brackets to show whether AND or OR comes first.`)],
      ["unclosed bracket", diet("1 AND (2 OR 3"), exact(`${D}: A bracket isn't closed.`)],
      ["stray closing bracket", diet("1 AND 2) OR 3"), exact(`${D}: There's a closing bracket without an opening one.`)],
      ["unused condition", diet("1 AND 2 AND 3"), exact(`${D}: Condition 4 isn't used.`)],
      ["two unused conditions", diet("1 AND 2"), exact(`${D}: Conditions 3 and 4 aren't used.`)],
      ["no such condition", diet("1 AND 2 AND 3 AND 5"), exact(`${D}: There's no condition 5.`)],
      ["leading zero", diet("1 AND 02 AND 3 AND 4"), exact(`${D}: There's no condition 02.`)],
      ["unknown word", diet("1 XOR 2"), exact(`${D}: "XOR" isn't allowed. Use condition numbers, AND, OR and brackets.`)],
      ["missing operator", diet("1 2 AND 3 AND 4"), exact(`${D}: Add AND or OR between 1 and 2.`)],
      ["empty brackets", diet("1 AND () AND 3"), exact(`${D}: Brackets can't be empty.`)],
      ["number and word run together", diet("1AND2 AND 3 AND 4"), exact(`${D}: "1AND2" isn't allowed. Use condition numbers, AND, OR and brackets.`)],
      ["missing condition after AND", diet("1 AND"), exact(`${D}: Add a condition after AND.`)],
      ["starts with an operator", diet("AND 1 AND 2 AND 3 AND 4"), exact(`${D}: Start with a condition number.`)],
      ["text error on a group", (() => { const x = valid(); x.blocks[1].blocks[1].enableLogicText = "1 AND"; return x; })(),
        exact('Group "Second › Grp": Add a condition after AND.')],
      ["text error on a page", (() => { const x = valid(); x.blocks[1].enableLogicText = "1 2"; return x; })(),
        exact('Page "Second": Add AND or OR between 1 and 2.')],
      ["text error inside a repeating group", (() => { const x = valid(); x.blocks[1].blocks[2].blocks[1].enableLogicText = "1 AND (2 OR 3"; return x; })(),
        exact('Block "Second › Rep › In repeat": A bracket isn\'t closed.')],
      ["duplicate condition ids", withDiet({ enableWhen: four(["c1", "c2", "c1", "c4"]), enableLogicText: "1 AND 2 AND 3 AND 4" }),
        exact(`${D}: conditions 1 and 3 have the same id "c1".`)],
      ["malformed condition id", withDiet({ enableWhen: four(["c1", "c 2", "c3", "c4"]), enableLogicText: "1 AND 2 AND 3 AND 4" }),
        exact(`${D}: condition 2's id "c 2" isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`)],
      ["empty condition id", withDiet({ enableWhen: four().map((c, i) => (i === 1 ? { ...c, id: "" } : c)), enableLogicText: "1 AND 2 AND 3 AND 4" }),
        exact(`${D}: condition 2's id "" isn't allowed. An id is up to 64 letters, numbers, ".", "_" and "-", starting with a letter or number.`)],
      ["tree without text naming an unknown id", withDiet({ enableWhen: four(), enableLogic: { any: ["c1", "c2", "c3", "c9"] } }),
        exact(`${D}: its enableLogic uses "c9", which isn't the id of one of its conditions.`)],
      ["tree with enableBehavior, no text", withDiet({ enableWhen: four(), enableLogic: { any: ["c1", "c2", "c3", "c4"] }, enableBehavior: "any" }),
        exact(`${D}: its enableLogic and enableBehavior can't both be set.`)],
      // The existing condition rules still apply to every condition, deep in mixed logic.
      ["ordering rule, under mixed logic", withDiet({ enableWhen: [yes("q1"), yes("q2"), { question: "later", operator: "exists" }], enableLogicText: "1 OR (2 AND 3)" }),
        exact(`${D}: a condition depends on "Later", which comes after it. A condition can only use a question that comes before it.`)],
      ["source type, under mixed logic", withDiet({ enableWhen: [yes("q1"), yes("q2"), { question: "notes", operator: "exists" }], enableLogicText: "1 OR (2 AND 3)" }),
        exact(`${D}: "Notes" is a long block, which can't be used in a condition.`)],
      ["prefix rule, under mixed logic", (() => {
        const x = valid();
        Object.assign(x.blocks[1].blocks[3], { enableWhen: [yes("q1"), yes("q2"), yes("r1")], enableLogicText: "(1 OR 2) AND 3" });
        return x;
      })(), /^Block "Second › Later": its condition uses "R1", which is inside the repeating group "Rep"\./],
    ];
    for (const [name, payload, re] of cases) {
      const r = await put(payload);
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
