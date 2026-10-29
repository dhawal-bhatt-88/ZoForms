// Shared by the release-audit scripts (docs/audits/RELEASE-AUDIT-BUILDER.md).
//
// - Refuses to run unless the API and the database are on this machine.
// - Reads the database URL from apps/api/.env (or the environment); no secrets here.
// - Every account it makes is audit-<run>-<who>@example.test, and run() deletes
//   them, their organisations and their admin audit rows afterwards, also when
//   the script fails.
//
// Env: AUDIT_API_URL (default http://localhost:4100), DATABASE_URL.
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
require(path.join(ROOT, "apps/api/node_modules/dotenv")).config({ path: path.join(ROOT, "apps/api/.env") });
const { PrismaClient } = require(path.join(ROOT, "apps/api/node_modules/@prisma/client"));

const API = process.env.AUDIT_API_URL || "http://localhost:4100";
const LOCAL = new Set(["localhost", "127.0.0.1"]);

function assertLocal() {
  const apiHost = new URL(API).hostname;
  let dbHost;
  try {
    dbHost = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    dbHost = "(unset)";
  }
  if (!LOCAL.has(apiHost) || !LOCAL.has(dbHost)) {
    console.error(`Refusing to run: API host "${apiHost}" and database host "${dbHost}" must be localhost or 127.0.0.1.`);
    process.exit(2);
  }
}
assertLocal();

const prisma = new PrismaClient();
const RUN = `audit-${Date.now().toString(36)}`;
const DOMAIN = "@example.test";
const PASSWORD = "Audit-pass-123!";

async function call(method, p, token, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(API + p, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: r.status, text, json, headers: r.headers };
}

const emailFor = (who) => `${RUN}-${who}${DOMAIN}`.toLowerCase();

/** Sign up a throwaway account; returns { email, token, id, body }. */
async function signup(who, name = who) {
  const email = emailFor(who);
  const r = await call("POST", "/v1/auth/signup", null, { email, password: PASSWORD, name });
  if (r.status >= 300) throw new Error(`signup ${who}: ${r.status} ${r.text}`);
  return { email, token: r.json.token, id: r.json.user.id, body: r.json };
}

const decode = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

const results = [];
function check(name, pass, detail = "") {
  results.push([name, !!pass, detail]);
}
/** Record an observation that is neither pass nor fail. */
function note(name, detail) {
  results.push([name, null, detail]);
}

/** Delete every account of this run, their organisations, invites and admin audit rows. */
async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: RUN, endsWith: DOMAIN } },
    select: { id: true, memberships: { select: { orgId: true } } },
  });
  const userIds = users.map((u) => u.id);
  const orgIds = [...new Set(users.flatMap((u) => u.memberships.map((m) => m.orgId)))];
  // Only organisations every member of which is a throwaway account.
  const ownOrgs = [];
  for (const orgId of orgIds) {
    const others = await prisma.membership.count({ where: { orgId, userId: { notIn: userIds } } });
    if (others === 0) ownOrgs.push(orgId);
  }
  await prisma.organization.deleteMany({ where: { id: { in: ownOrgs } } });
  await prisma.invite.deleteMany({ where: { email: { startsWith: RUN, endsWith: DOMAIN } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const left = await prisma.user.count({ where: { email: { startsWith: RUN } } });
  return { users: userIds.length, orgs: ownOrgs.length, left };
}

/** Run body(), print the results, always clean up, exit 1 if any check failed. */
async function run(title, body) {
  let crashed = null;
  try {
    await body();
  } catch (e) {
    crashed = e;
  }
  let cleaned;
  try {
    cleaned = await cleanup();
  } catch (e) {
    console.error("CLEANUP FAILED:", e);
  }
  await prisma.$disconnect();
  console.log(`\n# ${title} (run ${RUN})\n`);
  for (const [name, pass, detail] of results) {
    const mark = pass === null ? "NOTE" : pass ? "PASS" : "FAIL";
    // A pass prints only its name; a failure or a note prints what came back.
    const shown = pass === true ? "" : detail;
    console.log(`${mark}  ${name}${shown ? `\n      ${String(shown).replace(/\n/g, "\n      ")}` : ""}`);
  }
  if (crashed) console.log(`\nCRASHED: ${crashed.stack}`);
  if (cleaned) console.log(`\ncleanup: ${cleaned.users} users, ${cleaned.orgs} organisations deleted; ${cleaned.left} left`);
  process.exit(crashed || results.some(([, p]) => p === false) ? 1 : 0);
}

const short = (r) => `${r.status} ${r.text.slice(0, 200)}`;

module.exports = { ROOT, API, RUN, PASSWORD, prisma, call, signup, emailFor, decode, check, note, run, short, cleanup };
