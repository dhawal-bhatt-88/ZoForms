// Release audit, area 3: sign-in, sessions, email verification, password reset,
// invites, a member of two organisations, the invite email's HTML, and Google
// sign-in merging into an existing account.
//
// The last two drive the API's compiled services in this process (apps/api/dist,
// so build the API first): the mailer is replaced by one that records the message,
// and Google's ID-token verifier by one that accepts a made-up token. No product
// code changes and nothing is sent anywhere.
//
// Usage: node scripts/audit/sessions.js   (API on AUDIT_API_URL, default :4100)
// The in-process AuthService reads GOOGLE_CLIENT_ID when the API's env module first loads.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "audit-stub.apps.googleusercontent.com";
const path = require("path");
const fs = require("fs");
const { ROOT, call, signup, emailFor, decode, check, note, run, short, prisma, PASSWORD } = require("./_lib");

const q = (id, label) => ({ id, type: "short", label, required: false });
const ok = (r) => r.status >= 200 && r.status < 300;
const API_DIST = path.join(ROOT, "apps/api/dist");
const apiRequire = (m) => require(require.resolve(m, { paths: [path.join(ROOT, "apps/api")] }));
const OUT = process.env.AUDIT_OUTPUT_DIR || path.join(require("os").tmpdir(), "release-audit");

run("Sign-in and sessions", async () => {
  // ---------- tokens ----------
  const v = await signup("victim", "Victim");
  const claims = decode(v.token);
  note("token claims and lifetime", `${Object.keys(claims).join(", ")}; expires ${(claims.exp - claims.iat) / 86400} days after issue; alg ${JSON.parse(Buffer.from(v.token.split(".")[0], "base64url")).alg}`);

  // ---------- email verification ----------
  note("sign-up response carries the verify link", v.body.emailVerifyUrl ? `yes: ${v.body.emailVerifyUrl.replace(/[0-9a-f]{48}$/, "<token>")}` : "no");
  const resend = await call("POST", "/v1/auth/resend-verification", v.token);
  note("resend-verification response carries the link", resend.json?.verifyUrl ? "yes" : short(resend));
  const vtoken = (resend.json?.verifyUrl || v.body.emailVerifyUrl).split("/verify-email/")[1];
  let r = await call("POST", "/v1/auth/verify-email", null, { token: vtoken });
  const me = await call("GET", "/v1/auth/me", v.token);
  check("the link from the API's own response verifies the account (no inbox needed)", ok(r) && me.json?.emailVerified === true, short(r));

  // ---------- password reset ----------
  const other = await signup("reset-target", "Target");
  r = await call("POST", "/v1/auth/forgot-password", null, { email: other.email });
  note("forgot-password response (email not configured, as locally)", r.json?.resetUrl ? "carries resetUrl" : short(r));
  if (r.json?.resetUrl) {
    const rt = r.json.resetUrl.split("/reset-password/")[1];
    const taken = await call("POST", "/v1/auth/reset-password", null, { token: rt, password: "Taken-over-123!" });
    const loginNew = await call("POST", "/v1/auth/login", null, { email: other.email, password: "Taken-over-123!" });
    check("without email configured, anyone who knows an address can reset its password and sign in",
      !(ok(taken) && ok(loginNew)), `reset ${taken.status}, sign-in with the new password ${loginNew.status}`);
    const oldToken = await call("GET", "/v1/forms", other.token);
    check("token issued before the password reset still works afterwards → refused", !ok(oldToken), short(oldToken));
  }

  // ---------- sign-out ----------
  const webApi = fs.readFileSync(path.join(ROOT, "apps/web/src/lib/api.ts"), "utf8");
  note("web sign-out", /export function logout\(\)[^}]*removeItem/.test(webApi) ? "removes the token from localStorage only; the API has no sign-out route" : "?");
  r = await call("GET", "/v1/forms", v.token);
  check("a token after the user 'signs out' (nothing revoked server-side) → refused", !ok(r), short(r));

  // ---------- invites ----------
  const owner = await signup("inv-owner", "Inviter");
  const inv = await call("POST", "/v1/team/invites", owner.token, { email: emailFor("invitee"), role: "EDITOR" });
  const itok = inv.json.acceptUrl.split("/invite/")[1];
  r = await call("GET", `/v1/invites/${itok}`);
  note("GET /v1/invites/:token (no sign-in, no throttle) returns", short(r));
  r = await call("POST", `/v1/invites/${itok}/accept`, null, { password: PASSWORD, name: "Invitee" });
  check("invite accepted", ok(r), short(r));
  r = await call("POST", `/v1/invites/${itok}/accept`, null, { password: PASSWORD });
  check("the same invite link a second time → refused", !ok(r), short(r));
  const inv2 = await call("POST", "/v1/team/invites", owner.token, { email: emailFor("expired"), role: "EDITOR" });
  await prisma.invite.update({ where: { id: inv2.json.invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  r = await call("POST", `/v1/invites/${inv2.json.acceptUrl.split("/invite/")[1]}/accept`, null, { password: PASSWORD });
  check("an expired invite → refused", !ok(r), short(r));
  const inv3 = await call("POST", "/v1/team/invites", owner.token, { email: emailFor("revoked"), role: "EDITOR" });
  await call("DELETE", `/v1/team/invites/${inv3.json.invite.id}`, owner.token);
  r = await call("POST", `/v1/invites/${inv3.json.acceptUrl.split("/invite/")[1]}/accept`, null, { password: PASSWORD });
  check("a revoked invite → refused", !ok(r), short(r));
  note("an invite's lifetime", `${Math.round((new Date(inv.json.invite.expiresAt) - Date.now()) / 86400000)} days; re-inviting the same email replaces the token`);

  // ---------- lead 6: a member of two organisations ----------
  const u = await signup("two-orgs", "Two Orgs");
  const uOrgA = decode(u.token).orgId;
  const ownerB = await signup("org-b-owner", "Org B");
  const orgB = decode(ownerB.token).orgId;
  const bForm = (await call("POST", "/v1/forms", ownerB.token, { title: "B's form" })).json;
  await call("PUT", `/v1/forms/${bForm.id}/schema`, ownerB.token, { title: "B's form", blocks: [q("b", "B only")] });
  const invB = await call("POST", "/v1/team/invites", ownerB.token, { email: u.email, role: "EDITOR" });
  const acc = await call("POST", `/v1/invites/${invB.json.acceptUrl.split("/invite/")[1]}/accept`, null, { password: PASSWORD });
  const which = (t) => (decode(t).orgId === uOrgA ? "A (their own)" : decode(t).orgId === orgB ? "B (the one just joined)" : "?");
  const members = await prisma.membership.findMany({ where: { userId: u.id }, select: { orgId: true, role: true } });
  note("lead 6: memberships after accepting B's invite", members.map((m) => `${m.orgId === uOrgA ? "A" : "B"}:${m.role}`).join(", "));
  note("lead 6: the accept response's token is for organisation", ok(acc) ? which(acc.json.token) : short(acc));
  const login = await call("POST", "/v1/auth/login", null, { email: u.email, password: PASSWORD });
  note("lead 6: signing in again gives organisation", which(login.json.token));
  const tokens = [acc.json?.token, login.json?.token].filter(Boolean);
  let reachesB = false;
  for (const t of tokens) {
    const list = await call("GET", "/v1/forms", t);
    const get = await call("GET", `/v1/forms/${bForm.id}`, t);
    if (list.json?.some((f) => f.id === bForm.id) || ok(get)) reachesB = true;
  }
  check("lead 6: the user can reach organisation B with any token they can get", reachesB, "every token is for A; B's forms are 404");
  // Order without orderBy: the same query, 20 times.
  const order = new Set();
  for (let i = 0; i < 20; i++) {
    const x = await prisma.user.findUnique({ where: { id: u.id }, include: { memberships: true } });
    order.add(x.memberships.map((m) => (m.orgId === uOrgA ? "A" : "B")).join(""));
  }
  note("lead 6: memberships order over 20 identical reads (no orderBy)", [...order].join(" | "));

  // ---------- lead 5: the invite email with a hostile organisation name ----------
  const hostileName = `<img src=x onerror=alert(1)><a href="https://evil.example">Click here to keep your account</a>`;
  const hostile = await signup("hostile", hostileName);
  const org = await prisma.organization.findUnique({ where: { id: decode(hostile.token).orgId }, select: { name: true } });
  note("lead 5: organisation name made from the sign-up name", org.name);
  const { TeamService } = require(path.join(API_DIST, "team/team.service.js"));
  const { MailService } = require(path.join(API_DIST, "mail/mail.service.js"));
  const sent = [];
  const mail = { enabled: false, layout: MailService.prototype.layout, send: async (m) => (sent.push(m), true) };
  const team = new TeamService(prisma, null, mail);
  await team.createInvite({ ...decode(hostile.token) }, { email: emailFor("hostile-invitee"), role: "EDITOR" });
  const email = sent[0];
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "invite-email-hostile.html"), email.html);
  check("lead 5: the organisation name is escaped in the invite email", !email.html.includes("<img src=x"), `subject: ${email.subject}\nhtml saved to ${path.join(OUT, "invite-email-hostile.html")}`);

  // ---------- lead 4: Google sign-in merges into an existing password account ----------

  const { OAuth2Client } = apiRequire("google-auth-library");
  const { JwtService } = apiRequire("@nestjs/jwt");
  const { env } = require(path.join(API_DIST, "config/env.js"));
  const { AuthService } = require(path.join(API_DIST, "auth/auth.service.js"));
  const realVerify = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async function ({ idToken }) {
    const payload = JSON.parse(idToken);
    return { getPayload: () => payload };
  };
  try {
    const auth = new AuthService(prisma, new JwtService({ secret: env.JWT_SECRET, signOptions: { expiresIn: "30d" } }), mail);
    // The attacker signs up first with the victim's address and a password they choose. Never verified.
    const target = emailFor("google-victim");
    r = await call("POST", "/v1/auth/signup", null, { email: target, password: "Attacker-pw-123!", name: "Attacker" });
    const attackerUserId = r.json.user.id;
    const before = await prisma.user.findUnique({ where: { id: attackerUserId }, select: { emailVerified: true } });
    // Later the real owner of the address signs in with Google.
    const g = await auth.loginWithGoogle(JSON.stringify({ email: target, email_verified: true, name: "Real Owner" }));
    const sameUser = decode(g.token).sub === attackerUserId;
    // The real owner builds a form; the attacker signs in with their own password.
    const f = (await call("POST", "/v1/forms", g.token, { title: "Real owner's form" })).json;
    await call("PUT", `/v1/forms/${f.id}/schema`, g.token, { title: "Real owner's form", blocks: [q("p", "Private question")] });
    const atk = await call("POST", "/v1/auth/login", null, { email: target, password: "Attacker-pw-123!" });
    const seen = ok(atk) ? await call("GET", `/v1/forms/${f.id}/artifact`, atk.json.token) : atk;
    check("lead 4: Google sign-in to an address someone else registered (unverified) → kept apart",
      !sameUser || !ok(seen),
      `attacker's account was unverified: ${!before.emailVerified}; Google sign-in returned the same user: ${sameUser}; attacker's password still signs in: ${ok(atk)}; attacker downloads the real owner's form: ${seen.status}${seen.text?.includes("Private question") ? " (with its content)" : ""}`);
  } finally {
    OAuth2Client.prototype.verifyIdToken = realVerify;
  }
});
