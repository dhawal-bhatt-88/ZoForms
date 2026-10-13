// The grid block (contract §14) through the real API and database: save,
// codes generated at save in rows, columns and column options, the exported
// shape, no-change detection, and every save-time rule with its message.
const { API, PrismaClient, opts } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const leaf = (id, type = "short", extra = {}) => ({ id, type, label: id.toUpperCase(), ...extra });
const group = (id, blocks, extra = {}) => ({ id, type: "group", label: id.toUpperCase(), blocks, ...extra });
const raw = (...pairs) => pairs.map(([code, label]) => ({ code, label }));
// Postgres jsonb reorders object keys, so stored content is compared with keys sorted.
const sorted = (v) =>
  Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
const sameJson = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

// One column of each type, two of them required; some codes empty, so the save
// fills them: "Other!" next to "other" becomes other_2 in each kind of list, and
// a column's option codes repeat the row codes, which is allowed.
const substanceUse = () => ({
  id: "subs",
  type: "grid",
  label: "Substance use",
  required: true, // ignored on a grid: dropped
  completeRequired: true, // likewise
  enableWhen: [{ id: "c1", question: "uses", operator: "=", answer: "yes" }],
  rows: raw(["other", "Other"], ["", "Other!"], ["", "Cannabis"]),
  columns: [
    { code: "", label: "Age at first use", type: "text", required: true, options: opts("Ignored") },
    { code: "", label: "Frequency", type: "dropdown", options: raw(["", "Daily"], ["", "Weekly"]), required: false },
    { code: "other", label: "Other", type: "radio", options: raw(["other", "Yes"], ["", "Other!"]), required: true },
  ],
});
const valid = {
  title: "Grid verify",
  blocks: [
    leaf("uses", "choice", { label: "Uses substances?", options: opts("Yes", "No") }),
    substanceUse(),
    group("people", [
      leaf("name"),
      { id: "meds", type: "grid", label: "Medicines", rows: raw(["", "Morning"]), columns: [{ code: "", label: "Dose", type: "text" }],
        enableWhen: [{ id: "c1", question: "name", operator: "exists" }] },
    ], { repeats: true, repeatLabel: "person", minOccurs: 0 }),
    leaf("notes", "long"),
  ],
};

// The grid as the artifact must carry it (contract §14.1), in key order.
const expectedGrid = {
  id: "subs",
  type: "grid",
  label: "Substance use",
  enableWhen: [{ id: "c1", question: "uses", operator: "=", answer: "yes" }],
  rows: raw(["other", "Other"], ["other_2", "Other!"], ["cannabis", "Cannabis"]),
  columns: [
    { code: "age_at_first_use", label: "Age at first use", type: "text", required: true },
    { code: "frequency", label: "Frequency", type: "dropdown", options: raw(["daily", "Daily"], ["weekly", "Weekly"]) },
    { code: "other", label: "Other", type: "radio", options: raw(["other", "Yes"], ["other_2", "Other!"]), required: true },
  ],
};

(async () => {
  const email = `verify-grid-api-${Date.now()}@example.test`;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Grid" }),
    })).json()).token;
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Grid" }) })).json();
    const put = (schema) => fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers: H, body: JSON.stringify(schema) });
    const rows = () => prisma.formVersion.count({ where: { formId: form.id } });

    // ---------- save, stored content, download ----------
    const saved = await put(valid);
    const body = await saved.clone().json().catch(() => ({}));
    check("grid form saves (200)", saved.status === 200, `${saved.status} ${await saved.clone().text()}`);
    check("the save returns the grid with its codes filled", JSON.stringify(body.schema?.blocks?.[1]) === JSON.stringify(expectedGrid), JSON.stringify(body.schema?.blocks?.[1]));
    const stored = await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } });
    const storedGrid = stored.schema.blocks[1];
    check("stored: codes filled in rows, columns and column options", sameJson(storedGrid, expectedGrid), JSON.stringify(storedGrid));
    check("stored: no grid-level required or completeRequired", !("required" in storedGrid) && !("completeRequired" in storedGrid), Object.keys(storedGrid).join(","));

    const art = await (await fetch(`${API}/v1/forms/${form.id}/artifact`, { headers: H })).json();
    const grid = art.blocks[1];
    check("artifact grid is exactly the §14.1 shape, in key order", JSON.stringify(grid) === JSON.stringify(expectedGrid), JSON.stringify(grid));
    check("artifact grid keys: id, type, label, enableWhen, rows, columns", JSON.stringify(Object.keys(grid)) === '["id","type","label","enableWhen","rows","columns"]', Object.keys(grid).join(","));
    check("text column carries no options; required only when true", !("options" in grid.columns[0]) && !("required" in grid.columns[1]) && grid.columns[2].required === true);
    check("a column's option codes may repeat a row code", grid.rows[0].code === "other" && grid.columns[2].options[0].code === "other" && grid.columns[2].code === "other");
    const inRepeat = art.blocks[2].blocks[1];
    check("grid inside a repeating group saved with codes", JSON.stringify(inRepeat) === JSON.stringify({
      id: "meds", type: "grid", label: "Medicines", enableWhen: [{ id: "c1", question: "name", operator: "exists" }],
      rows: raw(["morning", "Morning"]), columns: [{ code: "dose", label: "Dose", type: "text" }],
    }), JSON.stringify(inRepeat));

    // ---------- no-change detection ----------
    const again = await put(valid);
    check("the same content again, codes still empty -> 409 NO_CHANGES", again.status === 409 && (await again.json()).code === "NO_CHANGES");
    const reordered = JSON.parse(JSON.stringify(valid));
    reordered.blocks[1] = { ...expectedGrid, columns: expectedGrid.columns.map((c) => Object.fromEntries(Object.entries(c).reverse())) };
    const same = await put(reordered);
    check("identical grid with filled codes and keys reordered -> 409 NO_CHANGES", same.status === 409 && (await same.json()).code === "NO_CHANGES", `${same.status}`);
    const moved = JSON.parse(JSON.stringify(valid));
    moved.blocks[1].columns.reverse();
    const movedSave = await put(moved);
    check("reordering columns is a change (200)", movedSave.status === 200, `${movedSave.status}`);

    // ---------- rejections ----------
    const before = await rows();
    const clone = () => JSON.parse(JSON.stringify(valid));
    const withGrid = (edit) => { const s = clone(); edit(s.blocks[1]); return s; };
    const S = 'Block "Substance use"';
    const exact = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    const cases = [
      ["missing rows", withGrid((g) => { delete g.rows; }), exact(`${S}: it needs at least one row.`)],
      ["empty rows", withGrid((g) => { g.rows = []; }), exact(`${S}: it needs at least one row.`)],
      ["missing columns", withGrid((g) => { delete g.columns; }), exact(`${S}: it needs at least one column.`)],
      ["empty columns", withGrid((g) => { g.columns = []; }), exact(`${S}: it needs at least one column.`)],
      ["unknown column type, naming the column", withGrid((g) => { g.columns[1] = { code: "n", label: "Count", type: "number" }; }),
        exact(`${S}: column "Count" has the type "number", which a grid column can't have. A grid column's type is "radio", "dropdown" or "text".`)],
      ["column with no type, unlabelled: named by position", withGrid((g) => { g.columns[1] = { code: "n", label: " " }; }),
        exact(`${S}: column 2 has no type. A grid column's type is "radio", "dropdown" or "text".`)],
      ["column that isn't an object", withGrid((g) => { g.columns[2] = "Other"; }),
        exact(`${S}: column 3 isn't an object with a code, a label and a type.`)],
      ["radio column without options", withGrid((g) => { delete g.columns[2].options; }), exact(`${S}: column "Other" needs at least one option.`)],
      ["dropdown column with empty options", withGrid((g) => { g.columns[1].options = []; }), exact(`${S}: column "Frequency" needs at least one option.`)],
      ["row without a label", withGrid((g) => { g.rows[2].label = "  "; }), exact(`${S}: row 3 (code "option_3") needs a label.`)],
      ["row code with bad characters", withGrid((g) => { g.rows[2].code = "can nabis"; }),
        exact(`${S}: the code "can nabis" of row "Cannabis" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`)],
      ["duplicate row codes", withGrid((g) => { g.rows[2].code = "OTHER"; }),
        exact(`${S}: the code "OTHER" is used by more than one row ("Other" and "Cannabis"). Codes must be unique, ignoring case.`)],
      ["duplicate row labels", withGrid((g) => { g.rows[2].label = " other "; }),
        exact(`${S}: the label "other" is used by more than one row. Labels must be unique, ignoring case.`)],
      ["column without a label", withGrid((g) => { g.columns[0].label = ""; g.columns[0].code = "age"; }), exact(`${S}: column 1 (code "age") needs a label.`)],
      ["column code with bad characters", withGrid((g) => { g.columns[0].code = "_age"; }),
        exact(`${S}: the code "_age" of column "Age at first use" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`)],
      ["duplicate column codes", withGrid((g) => { g.columns[1].code = "Other"; }),
        exact(`${S}: the code "other" is used by more than one column ("Frequency" and "Other"). Codes must be unique, ignoring case.`)],
      ["duplicate column labels", withGrid((g) => { g.columns[1].label = "OTHER"; }),
        exact(`${S}: the label "Other" is used by more than one column. Labels must be unique, ignoring case.`)],
      ["column option without a label", withGrid((g) => { g.columns[1].options[1].label = ""; g.columns[1].options[1].code = "w"; }),
        exact(`${S}: in column "Frequency", option 2 (code "w") needs a label.`)],
      ["column option code with bad characters", withGrid((g) => { g.columns[1].options[0].code = "dai ly"; }),
        exact(`${S}: in column "Frequency", the code "dai ly" of option "Daily" can only use letters, digits, ".", "-" and "_", must start with a letter or digit, and can be at most 64 characters.`)],
      ["duplicate column option codes", withGrid((g) => { g.columns[1].options = raw(["d", "Daily"], ["D", "Weekly"]); }),
        exact(`${S}: in column "Frequency", the code "D" is used by more than one option ("Daily" and "Weekly"). Codes must be unique, ignoring case.`)],
      ["duplicate column option labels", withGrid((g) => { g.columns[1].options = raw(["d", "Daily"], ["w", "DAILY"]); }),
        exact(`${S}: in column "Frequency", the label "DAILY" is used by more than one option. Labels must be unique, ignoring case.`)],
      ["a grid as a condition source", (() => { const s = clone(); s.blocks[3].enableWhen = [{ question: "subs", operator: "exists" }]; return s; })(),
        exact('Block "NOTES": "Substance use" is a grid block, which can\'t be used in a condition.')],
      ["a grid source inside the same repeating group", (() => { const s = clone(); s.blocks[2].blocks.push(leaf("why", "short", { enableWhen: [{ question: "meds", operator: "exists" }] })); return s; })(),
        exact('Block "PEOPLE › WHY": "Medicines" is a grid block, which can\'t be used in a condition.')],
      ["a grid inside a repeating group is named by its path", (() => { const s = clone(); s.blocks[2].blocks[1].rows = []; return s; })(),
        exact('Block "PEOPLE › Medicines": it needs at least one row.')],
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
