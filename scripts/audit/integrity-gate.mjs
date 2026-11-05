// Release audit, area 5, final gate: would the renderer mount what the builder
// saves? For every form version and template in the local database, every system
// template file, and every schema fixture in the repo, this builds the artifact as
// Download does (buildArtifact) and runs the checks @zoworkhq/zoforms/react runs at
// mount, from the vendored /core: assertSchemaIntegrity, resolveNavigation and
// resolveDrafts. getSchemaWarnings is reported but isn't a refusal.
//
// Read-only: it writes nothing to the database.
//
// Usage: node scripts/audit/integrity-gate.mjs   [--all-versions]
import { createRequire } from "module";
import { pathToFileURL } from "url";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const { ROOT, prisma, check, note, run } = require("./_lib.js");
const schema = require(path.join(ROOT, "packages/form-schema/dist/index.js"));
const core = await import(pathToFileURL(path.join(ROOT, "apps/web/node_modules/@zoworkhq/zoforms/dist/core/index.js")).href);
const corePkg = JSON.parse(fs.readFileSync(path.join(ROOT, "apps/web/node_modules/@zoworkhq/zoforms/package.json"), "utf8"));

const ALL_VERSIONS = process.argv.includes("--all-versions");
const ID = { formId: "00000000-0000-4000-8000-000000000001", formVersionId: "00000000-0000-4000-8000-000000000002" };

/** What the renderer does with an artifact at mount: null if it mounts, else why not. */
function mountProblem(artifact) {
  try {
    core.assertSchemaIntegrity(artifact);
    core.resolveNavigation(artifact);
    core.resolveDrafts(artifact);
    return null;
  } catch (e) {
    return String(e.message || e).split("\n")[0];
  }
}

const tally = { checked: 0, refused: [], unparsable: [], warnings: 0 };

/** content is stored builder content (a FormSchema); `artifact` an already-built artifact. */
function gate(label, { content, artifact }) {
  tally.checked++;
  let built = artifact;
  if (!built) {
    // The builder's own parse first: the builder wouldn't save what fails here.
    const parsed = schema.FormSchema.safeParse(content);
    if (!parsed.success) {
      tally.unparsable.push(`${label}: ${parsed.error.issues[0]?.message}`);
      return;
    }
    try {
      built = schema.buildArtifact(content, ID);
    } catch (e) {
      tally.unparsable.push(`${label}: buildArtifact threw ${e.message}`);
      return;
    }
  }
  const problem = mountProblem(built);
  if (problem) tally.refused.push(`${label}: ${problem}`);
  else tally.warnings += core.getSchemaWarnings(built).length;
}

const wrapGroup = (g) => ({ title: g.label || "Group template", blocks: [g] });

/**
 * The save pipeline of PUT /v1/forms/:id/schema (forms.service.ts saveSchema), on
 * a new form: parse, normalise conditions and scores, then the structure and
 * drafts rules. Returns the content the server would store, or why it refuses.
 */
function builderSave(raw) {
  const parsed = schema.FormSchema.safeParse(raw);
  if (!parsed.success) return { refused: parsed.error.issues[0]?.message };
  const content = { ...parsed.data, blocks: schema.normalizeScores(schema.normalizeConditions(parsed.data.blocks, schema.idsFromPrevious([])), []) };
  const problems = schema.formProblems(content);
  if (problems.length) return { refused: problems[0].message };
  const drafts = schema.draftsProblem(content);
  if (drafts) return { refused: drafts };
  return { content };
}

const sq = (id, label = id) => ({ id, type: "short", label, required: false });
const nestedGroups = (levels) => {
  let b = sq("leaf");
  for (let i = levels; i > 0; i--) b = { id: `g${i}`, type: "group", label: `G${i}`, blocks: [b] };
  return b;
};
/** Content at the edges of what the builder accepts. */
const PROBES = {
  "empty form": { title: "Empty", blocks: [] },
  "only presentational blocks": { title: "P", blocks: [{ id: "hd", type: "heading", label: "Just a heading" }, { id: "ti", type: "title", label: "A title" }] },
  "groups nested 20 deep (the deepest that saves, contract §6)": { title: "Deep", blocks: [nestedGroups(20)] },
  "repeating group inside a repeating group": {
    title: "R", blocks: [{ id: "o", type: "group", label: "Outer", repeats: true, repeatLabel: "visit", minOccurs: 1, maxOccurs: 3,
      blocks: [{ id: "i", type: "group", label: "Inner", repeats: true, repeatLabel: "dose", minOccurs: 0, maxOccurs: 5, blocks: [sq("x")] }] }],
  },
  "a maximum above 1,000 (the author's choice, contract §12.1)": { title: "R", blocks: [{ id: "r", type: "group", label: "R", repeats: true, repeatLabel: "entry", minOccurs: 1, maxOccurs: 5000, blocks: [sq("x")] }] },
  "a minimum above 1,000 with no maximum": { title: "R", blocks: [{ id: "r", type: "group", label: "R", repeats: true, repeatLabel: "entry", minOccurs: 1001, blocks: [sq("x")] }] },
  "5,000-option dropdown": { title: "Big", blocks: [{ id: "dd", type: "dropdown", label: "Pick", required: false, options: Array.from({ length: 5000 }, (_, i) => ({ code: `o${i}`, label: `Option ${i}` })) }] },
  "labels with emoji, RTL and markup": { title: "<b>Ünïcode</b> 🎉", blocks: [sq("u", "مرحبا <script>alert(1)</script> 🎉")] },
  "pages, one of which holds only a heading": { title: "Pages", blocks: [
    { id: "p1", type: "page", title: "One", blocks: [sq("a")] },
    { id: "p2", type: "page", title: "Two", blocks: [{ id: "hd", type: "heading", label: "Just a heading" }] },
  ] },
  "a condition on an earlier choice": { title: "Logic", blocks: [
    { id: "c", type: "choice", label: "Pick", required: false, options: [{ code: "y", label: "Yes" }, { code: "n", label: "No" }] },
    { ...sq("f", "Follow-up"), enableWhen: [{ question: "c", operator: "=", answer: "y" }] },
  ] },
};

run(`Integrity gate (renderer ${corePkg.version})`, async () => {
  // ---------- the local database ----------
  const forms = await prisma.form.findMany({
    select: { id: true, title: true, versions: ALL_VERSIONS ? { orderBy: { version: "asc" } } : { orderBy: { version: "desc" }, take: 1 } },
  });
  let versions = 0;
  for (const f of forms) {
    for (const v of f.versions) {
      versions++;
      gate(`db form ${f.id} "${f.title}" v${v.version}`, { content: v.schema });
    }
  }
  const templates = await prisma.template.findMany();
  for (const t of templates) {
    const content = t.kind === "group" ? wrapGroup(t.content) : t.content;
    gate(`db ${t.orgId ? "organisation" : "system"} ${t.kind} template ${t.id} "${t.name}"`, { content });
  }
  note("database", `${forms.length} forms (${versions} ${ALL_VERSIONS ? "versions" : "latest versions"}), ${templates.length} templates`);

  // ---------- system template files ----------
  const tdir = path.join(ROOT, "apps/api/prisma/templates");
  const tfiles = fs.readdirSync(tdir).filter((f) => f.endsWith(".json"));
  for (const f of tfiles) {
    const t = JSON.parse(fs.readFileSync(path.join(tdir, f), "utf8"));
    gate(`system template file ${f}`, { content: t.kind === "group" ? wrapGroup(t.content) : t.content });
  }

  // ---------- committed artifact fixtures: docs examples and the home page ----------
  const fixtures = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".form.json")) fixtures.push(p);
    }
  };
  walk(path.join(ROOT, "apps/web/content/docs"));
  fixtures.push(path.join(ROOT, "apps/web/public/home/phq-2.json"));
  for (const p of fixtures) gate(`fixture ${path.relative(ROOT, p)}`, { artifact: JSON.parse(fs.readFileSync(p, "utf8")) });

  // ---------- artifacts the e2e suites downloaded (git-ignored, local only) ----------
  const out = path.join(ROOT, "e2e/output");
  const downloaded = fs.existsSync(out)
    ? fs.readdirSync(out).filter((f) => /-schema\.json$|artifact\.json$|^renderer-types\.json$/.test(f))
    : [];
  for (const f of downloaded) gate(`e2e download e2e/output/${f}`, { artifact: JSON.parse(fs.readFileSync(path.join(out, f), "utf8")) });
  note("files", `${tfiles.length} system template files, ${fixtures.length} committed fixtures, ${downloaded.length} e2e downloads`);

  // ---------- edge cases through the save pipeline ----------
  const probeResults = [];
  for (const [name, raw] of Object.entries(PROBES)) {
    const saved = builderSave(raw);
    if (saved.refused) {
      probeResults.push(`${name}: the builder refuses it (${saved.refused})`);
      continue;
    }
    const before = tally.refused.length;
    gate(`probe "${name}"`, { content: saved.content });
    probeResults.push(`${name}: saved; ${tally.refused.length > before ? "the renderer REFUSES it" : "mounts"}`);
  }
  note("edge cases", probeResults.join("\n"));

  check(`every one the builder accepts mounts in the renderer (${tally.checked} checked)`, tally.refused.length === 0, tally.refused.join("\n"));
  check("every stored form and template still parses as builder content", tally.unparsable.length === 0, tally.unparsable.join("\n"));
  note("renderer warnings (shown in development, not refusals)", String(tally.warnings));
});
