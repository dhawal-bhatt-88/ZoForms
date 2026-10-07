// Request body limits (apps/api/src/common/body-parsing.ts): 100 KB everywhere, 10 MB
// only for a signed-in author saving a form, and the Stripe webhook still verified
// against its raw bytes. API only.
//
// The two Stripe checks need the API started with test Stripe settings, e.g.
//   STRIPE_SECRET_KEY=sk_test_e2e STRIPE_WEBHOOK_SECRET=whsec_e2e_test pnpm --filter api dev
// and E2E_STRIPE_WEBHOOK_SECRET=whsec_e2e_test here. Without it they're skipped.
const path = require("path");
const { ROOT, API, PrismaClient, opts } = require("./_setup");
const Stripe = require(path.join(ROOT, "apps/api/node_modules/stripe"));
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WEBHOOK_SECRET = process.env.E2E_STRIPE_WEBHOOK_SECRET;
const kb = (n) => "x".repeat(n * 1024);

(async () => {
  const email = `verify-body-limits-${Date.now()}@example.test`;
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const json = { "Content-Type": "application/json" };
    const token = (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: json, body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Limits" }),
    })).json()).token;
    const H = { ...json, Authorization: `Bearer ${token}` };
    const form = await (await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: "Limits" }) })).json();
    const save = (body, headers = H) => fetch(`${API}/v1/forms/${form.id}/schema`, { method: "PUT", headers, body });
    const message = async (r) => (await r.json().catch(() => ({}))).message;

    // ---------- 100 KB everywhere else ----------
    let r = await fetch(API + "/v1/auth/login", { method: "POST", headers: json, body: JSON.stringify({ email, password: kb(200) }) });
    check("a 200 KB body on a public route is refused (413), naming the limit", r.status === 413 && (await message(r)) === "The request is too large. The limit is 100 KB.", `${r.status}`);
    r = await fetch(API + "/v1/auth/login", { method: "POST", headers: json, body: JSON.stringify({ email, password: "wrong-password" }) });
    check("a normal body on a public route is read as before (401 for a wrong password)", r.status === 401, `${r.status}`);
    r = await fetch(API + "/v1/forms", { method: "POST", headers: H, body: JSON.stringify({ title: kb(200) }) });
    check("a 200 KB body on another signed-in route is refused (413)", r.status === 413, `${r.status}`);
    r = await fetch(API + "/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `email=${encodeURIComponent(email)}&password=${kb(200)}` });
    check("a 200 KB form-encoded body is refused too (413)", r.status === 413, `${r.status}`);

    // ---------- the save route: 10 MB, signed in only ----------
    const big = {
      title: "Limits",
      blocks: [{ id: "big", type: "dropdown", label: "Big list", required: false,
        options: Array.from({ length: 5000 }, (_, k) => ({ code: `code_${k}`, label: `A fairly long option label, number ${k + 1}, for size` })) }],
    };
    const bigBody = JSON.stringify(big);
    check("the large form is well over 100 KB", bigBody.length > 300 * 1024, `${Math.round(bigBody.length / 1024)} KB`);
    r = await save(bigBody);
    check("a large form saves (200) for a signed-in author", r.status === 200, `${r.status} ${await r.clone().text().then((t) => t.slice(0, 200))}`);
    const stored = (await prisma.formVersion.findFirst({ where: { formId: form.id }, orderBy: { version: "desc" } })).schema;
    check("all 5,000 options stored", stored.blocks[0].options.length === 5000);
    r = await save(bigBody, { ...json, Authorization: "Bearer not-a-real-token" });
    check("the same body without a valid token gets the 100 KB limit (413), not the larger one", r.status === 413 && (await message(r)) === "The request is too large. The limit is 100 KB.", `${r.status}`);
    r = await save(bigBody, json);
    check("and without any token (413)", r.status === 413, `${r.status}`);
    r = await save(JSON.stringify({ title: "Limits", blocks: [{ id: "q", type: "short", label: kb(11 * 1024) }] }));
    check("over 10 MB on the save route is refused (413), naming that limit", r.status === 413 && (await message(r)) === "The request is too large. The limit is 10 MB.", `${r.status}`);
    r = await save(JSON.stringify({ title: "Small", blocks: [{ id: "c", type: "choice", label: "C", options: opts("Yes", "No") }] }));
    check("a normal save still works (200)", r.status === 200, `${r.status}`);

    // ---------- the Stripe webhook: raw bytes ----------
    const webhook = (payload, signature) =>
      fetch(API + "/v1/billing/webhook", { method: "POST", headers: { ...json, "stripe-signature": signature }, body: payload });
    if (!WEBHOOK_SECRET) {
      console.log("  SKIP  Stripe webhook checks (start the API with test Stripe settings and set E2E_STRIPE_WEBHOOK_SECRET; see the top of this file)");
    } else {
      // Unusual spacing and key order: re-serialising the parsed JSON would change the bytes and break the signature.
      const payload = `{ "id":"evt_e2e_1",  "object":"event", "type":"invoice.created",\n "data": {"object": {"id":"in_e2e"}} }`;
      const stripe = new Stripe("sk_test_e2e");
      const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
      r = await webhook(payload, signature);
      check("a correctly signed Stripe webhook is accepted", r.status === 201 && JSON.stringify(await r.json()) === '{"received":true}', `${r.status}`);
      r = await webhook(payload.replace("in_e2e", "in_e2f"), signature);
      check("a tampered webhook body is refused (400)", r.status === 400 && /^Webhook signature failed/.test(await message(r)), `${r.status}`);
    }
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
  for (const [name, pass, detail] of results) console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? "   [" + detail + "]" : ""}`);
  console.log(`\n  ${results.filter((r) => r[1]).length}/${results.length} passed`);
  process.exit(results.every((r) => r[1]) ? 0 : 1);
})();
