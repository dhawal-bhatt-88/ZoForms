// Throttling through the API: the signed-in reads every page makes (/me) aren't
// limited, and a credential route still is. Uses forgot-password (5 a minute),
// never login, so no other suite is ever locked out of signing in. It does leave
// forgot-password refused from this machine for about a minute afterwards.
const { API, PrismaClient } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const json = { "Content-Type": "application/json" };

(async () => {
  const email = `verify-throttling-${Date.now()}@example.test`;
  try {
    const signup = await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: json, body: JSON.stringify({ email, password: "Verify-pass-123!", name: "Throttle" }),
    });
    const { token } = await signup.json();
    check("setup: signed up", signup.status === 201 && !!token, `${signup.status}`);

    // ---------- /me isn't throttled: more than the credential limit of 30 a minute ----------
    const me = [];
    for (let i = 0; i < 35; i++) me.push((await fetch(API + "/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } })).status);
    check("35 GET /me in a row: all 200", me.every((s) => s === 200), me.join(","));

    // ---------- forgot-password still is: 5 a minute ----------
    // An address with no account: the reply is the same, and no email is sent.
    const forgot = [];
    for (let i = 0; i < 6; i++) {
      const r = await fetch(API + "/v1/auth/forgot-password", { method: "POST", headers: json, body: JSON.stringify({ email: `nobody-${Date.now()}@example.test` }) });
      forgot.push(r.status);
    }
    check("forgot-password: the first 5 in a minute are accepted", forgot.slice(0, 5).every((s) => s >= 200 && s < 300), forgot.join(","));
    check("…and the 6th is refused with 429", forgot[5] === 429, forgot.join(","));
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
