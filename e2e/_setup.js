// Shared setup for the browser/API suites in this folder: repo paths, URLs,
// the output folder, the database client and the browser. See README.md.
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
// The suites reuse the API's own .env (DATABASE_URL), so they see the same database.
require(path.join(ROOT, "apps/api/node_modules/dotenv")).config({ path: path.join(ROOT, "apps/api/.env") });
const { PrismaClient } = require(path.join(ROOT, "apps/api/node_modules/@prisma/client"));
const { chromium } = require(path.join(ROOT, "apps/web/node_modules/@playwright/test"));

/** Screenshots and downloaded artifacts land here (git-ignored). */
const OUT = process.env.E2E_OUTPUT_DIR || path.join(__dirname, "output");
fs.mkdirSync(OUT, { recursive: true });

const API = process.env.E2E_API_URL || "http://localhost:4000";
const WEB = process.env.E2E_WEB_URL || "http://localhost:3100";
// System Edge by default; set E2E_BROWSER_CHANNEL="" to use Playwright's own Chromium
// (after `pnpm --filter web exec playwright install chromium`), or e.g. "chrome".
const BROWSER_CHANNEL = process.env.E2E_BROWSER_CHANNEL ?? "msedge";

function launchBrowser() {
  return chromium.launch(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {});
}

/**
 * Keep a downloaded artifact in OUT. When E2E_EXTERNAL_FORMS_DIR is set (e.g. the
 * external test app's src/forms), a copy goes there too, ready to render.
 */
function saveArtifact(file, raw) {
  fs.writeFileSync(path.join(OUT, file), raw);
  const external = process.env.E2E_EXTERNAL_FORMS_DIR;
  if (external) fs.writeFileSync(path.join(external, file), raw);
}

/*
 * Coded options (contract §13) for fixtures: opts("Yes", "Not sure") →
 * [{ code: "yes", label: "Yes" }, { code: "not_sure", label: "Not sure" }].
 * code() is a simplified form of the builder's rule (lower case, whitespace to
 * "_", anything outside a–z 0–9 . - _ dropped) — the same helper the renderer's
 * and the schema package's tests use.
 */
const code = (label) => label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, "");
const opts = (...labels) => labels.map((label) => ({ code: code(label), label }));

/*
 * Conditions carry ids the builder generates (contract §15.1). noIds() drops
 * them so a condition's content can be compared exactly; hasIds() checks that
 * every condition has one: `c_` and 8 lower-case base-36 characters.
 */
const noIds = (conditions) => conditions?.map(({ id, ...rest }) => rest);
const hasIds = (conditions) => !!conditions?.length && conditions.every((c) => /^c_[0-9a-z]{8}$/.test(c.id));

module.exports = { ROOT, OUT, API, WEB, PrismaClient, chromium, launchBrowser, saveArtifact, code, opts, noIds, hasIds };
