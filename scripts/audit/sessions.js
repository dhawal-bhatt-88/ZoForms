// Release audit, area 3: sign-in, sessions, email verification, password reset,
// invites, a member of two organisations, the invite email's HTML, invites with
// email configured, and Google sign-in merging into an existing account,
// including one made by accepting someone else's invite (way 5).
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
const { ROOT, call, signup, emailFor, decode, check, note, run, short, prisma, PASSWORD, markVerified } = require("./_lib");

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
  check("S6: the sign-up response has no verify link", !v.body.emailVerifyUrl && !JSON.stringify(v.body).includes("/verify-email/"), v.body.emailVerifyUrl ?? "");
  const resend = await call("POST", "/v1/auth/resend-verification", v.token);
  check("S6: the resend-verification response has no link (emailSent: false without email)", !resend.json?.verifyUrl && resend.json?.emailSent === false, short(resend));
  // The link as the email would carry it: from the database, standing in for the inbox.
  const vtoken = (await prisma.emailToken.findFirst({ where: { userId: v.id, type: "verify" } })).token;
  let r = await call("POST", "/v1/auth/verify-email", null, { token: vtoken });
  const me = await call("GET", "/v1/auth/me", v.token);
  check("the emailed link verifies the account", ok(r) && me.json?.emailVerified === true, short(r));

  // ---------- password reset ----------
  const other = await signup("reset-target", "Target");
  r = await call("POST", "/v1/auth/forgot-password", null, { email: other.email });
  const nobody = await call("POST", "/v1/auth/forgot-password", null, { email: emailFor("no-such-account") });
  check("S1: without email configured, forgot-password returns no reset link", !r.json?.resetUrl && !r.text.includes("/reset-password/"), short(r));
  check("S1: and the same answer as for an address with no account", r.status === nobody.status && r.text === nobody.text, `${short(r)} | ${short(nobody)}`);
  // The owner of the inbox resets: the token from the database stands in for the email.
  const rt = (await prisma.emailToken.findFirst({ where: { userId: other.id, type: "reset" } })).token;
  const reset = await call("POST", "/v1/auth/reset-password", null, { token: rt, password: "Owner-reset-123!" });
  check("the emailed reset link resets the password", ok(reset), short(reset));
  const oldToken = await call("GET", "/v1/forms", other.token);
  check("S3: token issued before the password reset still works afterwards → refused", !ok(oldToken), short(oldToken));

  // ---------- sign-out ----------
  const webApi = fs.readFileSync(path.join(ROOT, "apps/web/src/lib/api.ts"), "utf8");
  note("web sign-out", /export function logout\(\)[^}]*removeItem/.test(webApi) ? "removes the token from localStorage only; the API has no sign-out route" : "?");
  r = await call("GET", "/v1/forms", v.token);
  note("a token after the user 'signs out' (no sign-out-everywhere, by decision; a password reset revokes)", short(r));

  // ---------- invites ----------
  const owner = await signup("inv-owner", "Inviter");
  r = await call("POST", "/v1/team/invites", owner.token, { email: emailFor("invitee"), role: "EDITOR" });
  check("an unverified account inviting → refused (403 EMAIL_NOT_VERIFIED)", r.status === 403 && r.json?.code === "EMAIL_NOT_VERIFIED", short(r));
  await markVerified(owner.email);
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

  // ---------- lead 6: a member of two organisations (refused: one organisation per account) ----------
  const u = await signup("two-orgs", "Two Orgs");
  const uOrgA = decode(u.token).orgId;
  const ownerB = await signup("org-b-owner", "Org B");
  await markVerified(ownerB.email);
  const orgB = decode(ownerB.token).orgId;
  const invB = await call("POST", "/v1/team/invites", ownerB.token, { email: u.email, role: "EDITOR" });
  check("lead 6: inviting someone already in another team → refused (409 ALREADY_IN_ANOTHER_TEAM)", invB.status === 409 && invB.json?.code === "ALREADY_IN_ANOTHER_TEAM", short(invB));
  // An invite from before the rule.
  const early = await prisma.invite.create({ data: { orgId: orgB, email: u.email, role: "EDITOR", token: `${u.id}-early`, expiresAt: new Date(Date.now() + 86_400_000) } });
  const acc = await call("POST", `/v1/invites/${early.token}/accept`, null, { password: PASSWORD });
  check("lead 6: accepting an earlier invite while in another team → refused (409)", acc.status === 409 && acc.json?.code === "ALREADY_IN_ANOTHER_TEAM", short(acc));
  const members = await prisma.membership.findMany({ where: { userId: u.id }, select: { orgId: true } });
  check("lead 6: still in one organisation, their own", members.length === 1 && members[0].orgId === uOrgA, JSON.stringify(members));

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
  await markVerified(hostile.email);
  await team.createInvite({ ...decode(hostile.token), role: "OWNER" }, { email: emailFor("hostile-invitee"), role: "EDITOR" });
  const email = sent[0];
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "invite-email-hostile.html"), email.html);
  check("lead 5: the organisation name is escaped in the invite email", !email.html.includes("<img src=x"), `subject: ${email.subject}\nhtml saved to ${path.join(OUT, "invite-email-hostile.html")}`);

  // ---------- way 5 (a): invites with email configured ----------
  {
    const mailed = [];
    const mailOn = { enabled: true, layout: MailService.prototype.layout, send: async (m) => (mailed.push(m), true) };
    const { AuthService } = require(path.join(API_DIST, "auth/auth.service.js"));
    const { JwtService } = apiRequire("@nestjs/jwt");
    const { env } = require(path.join(API_DIST, "config/env.js"));
    const authOn = new AuthService(prisma, new JwtService({ secret: env.JWT_SECRET, signOptions: { expiresIn: "30d" } }), mailOn);
    const teamOn = new TeamService(prisma, authOn, mailOn);
    const mgr = { ...decode(owner.token), role: "OWNER" };
    const res = await teamOn.createInvite(mgr, { email: emailFor("mailed-invitee"), role: "EDITOR" });
    check("way 5 (a): with email configured, the invite response has no link and no token",
      !("acceptUrl" in res) && !("token" in res.invite) && !JSON.stringify(res).includes("/invite/"), JSON.stringify(res).slice(0, 200));
    const listed = await teamOn.listInvites(mgr);
    check("way 5 (a): …nor does the invite list", listed.length > 0 && listed.every((i) => !("token" in i)), JSON.stringify(listed[0]));
    check("way 5 (a): …the link went out by email", mailed.some((m) => m.html.includes("/invite/")));
    const mailedToken = (await prisma.invite.findFirst({ where: { email: emailFor("mailed-invitee") } })).token;
    await teamOn.acceptInvite(mailedToken, { password: PASSWORD, name: "Mailed" });
    const joined = await prisma.user.findUnique({ where: { email: emailFor("mailed-invitee") } });
    check("way 5 (a): accepting the emailed link marks the new account verified", joined.emailVerified === true);
  }

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
    const claimed = await prisma.user.findUnique({ where: { id: attackerUserId } });
    check("lead 4: the claimed account is verified and has no password", claimed.emailVerified && claimed.passwordHash === null);
    const attackerToken = await call("GET", "/v1/forms", r.json.token);
    check("lead 4: the attacker's sign-up token → refused", attackerToken.status === 401, short(attackerToken));
    check("lead 4: the account kept the organisation it made at sign-up", decode(g.token).orgId === decode(r.json.token).orgId);

    // Way 5: the attacker invites the address into their own team and accepts the invite themselves.
    const atkOwner = await signup("way5-attacker", "Way 5 attacker");
    await markVerified(atkOwner.email);
    const atkOrg = decode(atkOwner.token).orgId;
    const victim5 = emailFor("way5-victim");
    const inv5 = await call("POST", "/v1/team/invites", atkOwner.token, { email: victim5, role: "EDITOR" });
    const acc5 = await call("POST", `/v1/invites/${inv5.json.invite.token}/accept`, null, { password: "Attacker-pw-123!", name: "Victim" });
    const v5 = await prisma.user.findUnique({ where: { email: victim5 }, include: { memberships: true } });
    check("way 5, before the merge: the attacker made an unverified account for the address, in the attacker's team only",
      ok(acc5) && !v5.emailVerified && v5.memberships.length === 1 && v5.memberships[0].orgId === atkOrg, `${short(acc5)}; ${JSON.stringify(v5.memberships)}`);
    const g5 = await auth.loginWithGoogle(JSON.stringify({ email: victim5, email_verified: true, name: "Real Victim" }));
    const after5 = await prisma.membership.findMany({ where: { userId: v5.id } });
    check("way 5, after the merge: no longer in the attacker's team; owner of a new organisation of their own",
      after5.length === 1 && after5[0].orgId !== atkOrg && after5[0].role === "OWNER" && decode(g5.token).orgId === after5[0].orgId, JSON.stringify(after5));
    const vf = (await call("POST", "/v1/forms", g5.token, { title: "Victim's own form" })).json;
    r = await call("GET", `/v1/forms/${vf.id}`, atkOwner.token);
    check("way 5, after the merge: the attacker can't read the real owner's new form (404)", r.status === 404, short(r));
    r = await call("GET", "/v1/forms", acc5.json.token);
    check("way 5, after the merge: the token the attacker got by accepting → refused", r.status === 401, short(r));
    r = await call("POST", "/v1/auth/login", null, { email: victim5, password: "Attacker-pw-123!" });
    check("way 5, after the merge: the attacker's password no longer signs in", !ok(r), short(r));

    // Way 5 with data from before the rule: an account made at sign-up that also joined someone's team by invite.
    const both = emailFor("way5-both");
    const sb = await call("POST", "/v1/auth/signup", null, { email: both, password: "Attacker-pw-123!", name: "Both" });
    const bothOwnOrg = decode(sb.json.token).orgId;
    await prisma.invite.create({ data: { orgId: atkOrg, email: both, role: "EDITOR", token: `${sb.json.user.id}-pre`, status: "accepted", acceptedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } });
    await prisma.membership.create({ data: { orgId: atkOrg, userId: sb.json.user.id, role: "EDITOR" } });
    await auth.loginWithGoogle(JSON.stringify({ email: both, email_verified: true, name: "Both" }));
    const bothAfter = await prisma.membership.findMany({ where: { userId: sb.json.user.id } });
    check("way 5, after the merge: an account in its sign-up organisation and an invited one keeps only the sign-up one",
      bothAfter.length === 1 && bothAfter[0].orgId === bothOwnOrg, JSON.stringify(bothAfter));

    // The sign-up organisation is never matched as invited: an account invited elsewhere and refused
    // (one team per account) leaves an Invite row for the other organisation only.
    const refusedAddr = emailFor("way5-refused");
    const sr = await call("POST", "/v1/auth/signup", null, { email: refusedAddr, password: "Attacker-pw-123!", name: "Refused" });
    const refusedOwnOrg = decode(sr.json.token).orgId;
    const early = await prisma.invite.create({ data: { orgId: atkOrg, email: refusedAddr, role: "EDITOR", token: `${sr.json.user.id}-refused`, expiresAt: new Date(Date.now() + 86_400_000) } });
    const refusedAccept = await call("POST", `/v1/invites/${early.token}/accept`, null, { password: "Attacker-pw-123!" });
    const rows = await prisma.invite.findMany({ where: { email: refusedAddr }, select: { orgId: true, status: true } });
    check("merge rule: an account in its own team, invited elsewhere, is refused, and its only Invite row is the other team's",
      refusedAccept.status === 409 && rows.length === 1 && rows[0].orgId === atkOrg && rows[0].orgId !== refusedOwnOrg, `${short(refusedAccept)}; ${JSON.stringify(rows)}`);
    const gr = await auth.loginWithGoogle(JSON.stringify({ email: refusedAddr, email_verified: true, name: "Refused" }));
    const refusedAfter = await prisma.membership.findMany({ where: { userId: sr.json.user.id } });
    check("merge rule: …and the Google merge keeps its sign-up organisation, signing in to it",
      refusedAfter.length === 1 && refusedAfter[0].orgId === refusedOwnOrg && decode(gr.token).orgId === refusedOwnOrg, JSON.stringify(refusedAfter));
  } finally {
    OAuth2Client.prototype.verifyIdToken = realVerify;
  }
});
