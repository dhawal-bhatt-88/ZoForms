// Author preferences through the API: the settings pane width (builder only, not
// in the contract). PATCH /v1/auth/me/preferences sets or clears it for the
// signed-in user; GET /v1/auth/me delivers it. API only.
const { API, PrismaClient } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MESSAGE = "settingsPaneWidth must be a whole number of pixels from 200 to 4000, or null.";

(async () => {
  const stamp = Date.now();
  const email = `verify-preferences-api-${stamp}@example.test`;
  const other = `verify-preferences-api-other-${stamp}@example.test`;
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }
    const json = { "Content-Type": "application/json" };
    const signup = async (address) => (await (await fetch(API + "/v1/auth/signup", {
      method: "POST", headers: json, body: JSON.stringify({ email: address, password: "Verify-pass-123!", name: "Prefs" }),
    })).json()).token;
    const H = { ...json, Authorization: `Bearer ${await signup(email)}` };
    const H2 = { ...json, Authorization: `Bearer ${await signup(other)}` };
    const me = async (headers = H) => (await fetch(API + "/v1/auth/me", { headers })).json();
    const set = (body, headers = H) =>
      fetch(API + "/v1/auth/me/preferences", { method: "PATCH", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
    const stored = async () => (await prisma.user.findUnique({ where: { email } })).settingsPaneWidth;

    // ---------- delivered with the user ----------
    let m = await me();
    check("a new account's /me has settingsPaneWidth: null (the default)", "settingsPaneWidth" in m && m.settingsPaneWidth === null, JSON.stringify(m));
    check("/me still has the fields it had", m.email === email && m.role === "OWNER" && typeof m.orgId === "string" && m.emailVerified === false, JSON.stringify(m));

    // ---------- set ----------
    let r = await set({ settingsPaneWidth: 420 });
    let body = await r.json();
    check("setting 420 is accepted (200) and answers with the stored value", r.status === 200 && body.settingsPaneWidth === 420 && Object.keys(body).length === 1, `${r.status} ${JSON.stringify(body)}`);
    check("420 is stored on the user, in px", (await stored()) === 420);
    check("/me now delivers 420", (await me()).settingsPaneWidth === 420);
    check("another account's width is untouched", (await me(H2)).settingsPaneWidth === null);
    for (const w of [200, 4000]) {
      r = await set({ settingsPaneWidth: w });
      check(`${w}, at the edge of the range, is accepted`, r.status === 200 && (await stored()) === w, `${r.status}`);
    }

    // ---------- clear ----------
    await set({ settingsPaneWidth: 512 });
    r = await set({ settingsPaneWidth: null });
    body = await r.json();
    check("null clears it (200), and is stored as null, not the default's number", r.status === 200 && body.settingsPaneWidth === null && (await stored()) === null, `${r.status} ${JSON.stringify(body)}`);
    check("/me delivers null after a clear", (await me()).settingsPaneWidth === null);

    // ---------- refused ----------
    await set({ settingsPaneWidth: 333 });
    for (const [what, value] of [["199", 199], ["4001", 4001], ["a fraction", 300.5], ["a string", "300"], ["true", true], ["an object", {}], ["a negative", -300]]) {
      r = await set({ settingsPaneWidth: value });
      body = await r.json();
      check(`${what} is refused (400) with the message`, r.status === 400 && body.message === MESSAGE, `${r.status} ${JSON.stringify(body)}`);
    }
    r = await set({});
    check("a body without settingsPaneWidth is refused (400) with the same message", r.status === 400 && (await r.json()).message === MESSAGE, `${r.status}`);
    r = await set({ settingsPaneWidth: 300, theme: "dark" });
    body = await r.json();
    check("an unknown preference is refused (400), naming it", r.status === 400 && body.message === "Unknown preference: theme.", `${r.status} ${JSON.stringify(body)}`);
    r = await set("[300]");
    body = await r.json();
    check("an array body is refused (400)", r.status === 400 && body.message === "Send an object: { settingsPaneWidth }.", `${r.status} ${JSON.stringify(body)}`);
    check("nothing refused changed the stored width", (await stored()) === 333, `${await stored()}`);

    // ---------- signed in only ----------
    r = await set({ settingsPaneWidth: 400 }, json);
    check("without a token it is refused (401)", r.status === 401, `${r.status}`);
    r = await set({ settingsPaneWidth: 400 }, { ...json, Authorization: "Bearer not-a-real-token" });
    check("with a bad token it is refused (401)", r.status === 401, `${r.status}`);
    check("and nothing changed", (await stored()) === 333);
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    for (const address of [email, other]) {
      const u = await prisma.user.findUnique({ where: { email: address }, include: { memberships: true } });
      if (u) {
        for (const m of u.memberships) await prisma.organization.delete({ where: { id: m.orgId } }).catch(() => {});
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }
    await prisma.$disconnect();
  }
  for (const [name, pass, detail] of results) console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${!pass && detail ? "   [" + detail + "]" : ""}`);
  console.log(`\n  ${results.filter((r) => r[1]).length}/${results.length} passed`);
  process.exit(results.every((r) => r[1]) ? 0 : 1);
})();
