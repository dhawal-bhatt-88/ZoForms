// Sign-in and access through the API (release fixes, CP1): no reset or verify
// link in any response; every signed-in request checks the membership, the user
// and the organisation, with the role read fresh; a password reset revokes older
// tokens, admin and impersonation tokens included; an unverified account can't
// invite; one organisation per account; sign-in refusals for a suspended user or
// organisation and for no organisation; impersonation limits. API only.
//
// Google sign-in claiming an unverified account needs Google's verifier stubbed,
// so it is in scripts/audit/sessions.js, which drives the API's services in-process.
const { API, PrismaClient, markVerified } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PASSWORD = "Verify-pass-123!";
const PREFIX = `verify-access-api-${Date.now()}`;
const emailFor = (who) => `${PREFIX}-${who}@example.test`;
const decode = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

async function call(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json };
}
const show = (r) => `${r.status} ${r.text.slice(0, 240)}`;
const ok = (r) => r.status >= 200 && r.status < 300;

async function signup(who, name = who) {
  const r = await call("POST", "/v1/auth/signup", null, { email: emailFor(who), password: PASSWORD, name });
  if (!ok(r)) throw new Error(`signup ${who}: ${show(r)}`);
  return { email: emailFor(who), token: r.json.token, id: r.json.user.id, response: r };
}
/** A verified owner, who may invite. */
async function owner(who) {
  const o = await signup(who, who);
  await markVerified(prisma, o.email);
  return o;
}
/** Invite `who` into the owner's organisation and accept as a new account (no email here, so the link comes back). */
async function addMember(ownerToken, who, role) {
  const inv = await call("POST", "/v1/team/invites", ownerToken, { email: emailFor(who), role });
  if (!ok(inv)) throw new Error(`invite ${who}: ${show(inv)}`);
  const acc = await call("POST", `/v1/invites/${inv.json.invite.token}/accept`, null, { password: PASSWORD, name: who });
  if (!ok(acc)) throw new Error(`accept ${who}: ${show(acc)}`);
  return { email: emailFor(who), token: acc.json.token, id: acc.json.user.id };
}
/** The reset token forgot-password stored (it's never in the response). */
async function resetToken(email) {
  const u = await prisma.user.findUnique({ where: { email } });
  return (await prisma.emailToken.findFirst({ where: { userId: u.id, type: "reset" } }))?.token;
}
const login = (email, password = PASSWORD) => call("POST", "/v1/auth/login", null, { email, password });
const q = (id, label) => ({ id, type: "short", label, required: false });

(async () => {
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok) break; } catch {} await sleep(1000); }

    // ---------- 1. no reset or verify link in a response ----------
    const v = await signup("links");
    check("sign-up: no verification link in the response", !("emailVerifyUrl" in v.response.json) && !v.response.text.includes("/verify-email/"), v.response.text.slice(0, 200));
    let r = await call("POST", "/v1/auth/resend-verification", v.token);
    check("resend verification: { ok, emailSent: false } without email configured, and no link",
      ok(r) && r.json.ok === true && r.json.emailSent === false && !("verifyUrl" in r.json) && !r.text.includes("/verify-email/"), show(r));
    const known = await call("POST", "/v1/auth/forgot-password", null, { email: v.email });
    const unknown = await call("POST", "/v1/auth/forgot-password", null, { email: emailFor("nobody") });
    check("forgot-password: no reset link in the response", !known.text.includes("reset") && !("resetUrl" in (known.json ?? {})), show(known));
    check("forgot-password: the same answer whether or not the address has an account",
      known.status === unknown.status && known.text === unknown.text, `${show(known)} | ${show(unknown)}`);
    check("forgot-password still made a reset token for the account (sent by email when configured)", !!(await resetToken(v.email)));

    // ---------- 2. every request checks membership, user and organisation ----------
    const O = await owner("owner");
    const form = (await call("POST", "/v1/forms", O.token, { title: "Org form" })).json;
    await call("PUT", `/v1/forms/${form.id}/schema`, O.token, { title: "Org form", blocks: [q("s", "Confidential question")] });

    const removed = await addMember(O.token, "removed", "EDITOR");
    check("setup: the member reads the form", ok(await call("GET", `/v1/forms/${form.id}`, removed.token)));
    r = await call("DELETE", `/v1/team/members/${removed.id}`, O.token);
    check("setup: the owner removes the member", ok(r), show(r));
    for (const [what, method, path] of [
      ["list forms", "GET", "/v1/forms"], ["get the form", "GET", `/v1/forms/${form.id}`],
      ["list versions", "GET", `/v1/forms/${form.id}/versions`], ["download", "GET", `/v1/forms/${form.id}/artifact`],
      ["list templates", "GET", "/v1/templates"], ["team members", "GET", "/v1/team/members"], ["/me", "GET", "/v1/auth/me"],
    ]) {
      r = await call(method, path, removed.token);
      check(`removed member's old token: ${what} → 401`, r.status === 401 && !r.text.includes("Confidential"), show(r));
    }
    r = await login(removed.email);
    check("removed member signs in → 403 with a message, not a 500",
      r.status === 403 && r.json?.message === "Your account isn't part of a team. Ask a team owner or admin to invite you.", show(r));

    // The role is read on every request.
    const changing = await addMember(O.token, "changing", "ADMIN");
    check("admin: lists invites", ok(await call("GET", "/v1/team/invites", changing.token)));
    await call("PATCH", `/v1/team/members/${changing.id}`, O.token, { role: "VIEWER" });
    r = await call("GET", "/v1/team/invites", changing.token);
    check("admin lowered to viewer: the same token can't list invites (403)", r.status === 403, show(r));
    r = await call("PUT", `/v1/forms/${form.id}/schema`, changing.token, { title: "Org form", blocks: [q("s", "by a viewer")] });
    check("…and can't save (403)", r.status === 403, show(r));
    check("…and /me says VIEWER", (await call("GET", "/v1/auth/me", changing.token)).json?.role === "VIEWER");
    await call("PATCH", `/v1/team/members/${changing.id}`, O.token, { role: "EDITOR" });
    r = await call("PUT", `/v1/forms/${form.id}/schema`, changing.token, { title: "Org form", blocks: [q("s", "Confidential question"), q("t", "by an editor")] });
    check("raised to editor: the same token saves (200)", r.status === 200, show(r));

    // A suspended user.
    const sus = await addMember(O.token, "suspended", "EDITOR");
    await prisma.user.update({ where: { id: sus.id }, data: { status: "suspended" } });
    r = await call("GET", `/v1/forms/${form.id}`, sus.token);
    check("suspended user's token: read → 401", r.status === 401, show(r));
    r = await call("PUT", `/v1/forms/${form.id}/schema`, sus.token, { title: "Org form", blocks: [q("s", "x")] });
    check("suspended user's token: save → 401", r.status === 401, show(r));
    r = await login(sus.email);
    check("suspended user signs in → 403 \"This account is suspended.\"", r.status === 403 && r.json?.message === "This account is suspended.", show(r));
    await prisma.user.update({ where: { id: sus.id }, data: { status: "active" } });
    check("reactivated: the same token works again", ok(await call("GET", `/v1/forms/${form.id}`, sus.token)));

    // A suspended organisation.
    await prisma.organization.update({ where: { id: decode(O.token).orgId }, data: { status: "suspended" } });
    r = await call("GET", `/v1/forms/${form.id}/artifact`, sus.token);
    check("member of a suspended organisation: download → 401", r.status === 401, show(r));
    r = await call("GET", "/v1/forms", O.token);
    check("owner of a suspended organisation: list forms → 401", r.status === 401, show(r));
    r = await login(O.email);
    check("member of a suspended organisation signs in → 403 \"Your team's account is suspended.\"", r.status === 403 && r.json?.message === "Your team's account is suspended.", show(r));
    await prisma.organization.update({ where: { id: decode(O.token).orgId }, data: { status: "active" } });
    check("reactivated organisation: the owner's token works again", ok(await call("GET", "/v1/forms", O.token)));

    // ---------- 3. a password reset revokes older tokens ----------
    const R = await signup("reset");
    const before = R.token;
    await call("POST", "/v1/auth/forgot-password", null, { email: R.email });
    r = await call("POST", "/v1/auth/reset-password", null, { token: await resetToken(R.email), password: "New-pass-456!" });
    check("reset password: 201 with a new token", r.status === 201 && !!r.json?.token, show(r));
    const after = r.json?.token;
    r = await call("GET", "/v1/forms", before);
    check("a token issued before the reset → 401", r.status === 401, show(r));
    check("the token the reset returned works", ok(await call("GET", "/v1/forms", after)));
    check("signing in with the new password works", ok(await login(R.email, "New-pass-456!")));

    // Platform admin tokens, and impersonation tokens.
    const PA = await signup("admin", "Admin");
    await prisma.user.update({ where: { id: PA.id }, data: { isAdmin: true } });
    check("setup: admin console as the admin (200)", ok(await call("GET", "/v1/admin/overview", PA.token)));
    const imp = await call("POST", `/v1/admin/users/${R.id}/impersonate`, PA.token);
    check("setup: the admin impersonates a user (201)", imp.status === 201, show(imp));
    check("setup: the impersonation token works", ok(await call("GET", "/v1/forms", imp.json?.token)));
    await call("POST", "/v1/auth/forgot-password", null, { email: R.email });
    await call("POST", "/v1/auth/reset-password", null, { token: await resetToken(R.email), password: "Newer-pass-789!" });
    r = await call("GET", "/v1/forms", imp.json?.token);
    check("the impersonated user resets their password: the impersonation token → 401", r.status === 401, show(r));
    await call("POST", "/v1/auth/forgot-password", null, { email: PA.email });
    r = await call("POST", "/v1/auth/reset-password", null, { token: await resetToken(PA.email), password: "Admin-new-123!" });
    const paNew = r.json?.token;
    r = await call("GET", "/v1/admin/overview", PA.token);
    check("the admin resets their password: the old admin token → 401 on the admin console", r.status === 401, show(r));
    check("the admin's new token works on the admin console", ok(await call("GET", "/v1/admin/overview", paNew)));

    // ---------- 4. an unverified account can't invite ----------
    const U = await signup("unverified");
    r = await call("POST", "/v1/team/invites", U.token, { email: emailFor("u-invitee"), role: "EDITOR" });
    check("unverified owner invites → 403 EMAIL_NOT_VERIFIED with the message",
      r.status === 403 && r.json?.code === "EMAIL_NOT_VERIFIED" && r.json?.message === "Verify your email address before inviting teammates.", show(r));
    check("…and no invite was made", (await prisma.invite.count({ where: { email: emailFor("u-invitee") } })) === 0);
    await markVerified(prisma, U.email);
    r = await call("POST", "/v1/team/invites", U.token, { email: emailFor("u-invitee"), role: "EDITOR" });
    check("once verified, the same owner invites (201)", r.status === 201, show(r));
    check("without email configured, the invite still comes back with its link to copy", typeof r.json?.acceptUrl === "string" && typeof r.json?.invite?.token === "string", show(r));
    r = await call("GET", "/v1/team/invites", U.token);
    check("…and the invite list still has the token", ok(r) && r.json.every((i) => typeof i.token === "string"), show(r));

    // ---------- 5. one organisation per account ----------
    const X = await signup("elsewhere", "Elsewhere");
    r = await call("POST", "/v1/team/invites", O.token, { email: X.email, role: "EDITOR" });
    check("inviting someone who is in another team → 409 ALREADY_IN_ANOTHER_TEAM with the message",
      r.status === 409 && r.json?.code === "ALREADY_IN_ANOTHER_TEAM" && r.json?.message === `${X.email} already belongs to another team. An account can belong to only one team.`, show(r));
    // An invite made before the rule: accepting it is refused the same way.
    const orgName = (await prisma.organization.findUnique({ where: { id: decode(O.token).orgId } })).name;
    const earlyData = { role: "EDITOR", token: `${PREFIX}-early`, status: "pending", expiresAt: new Date(Date.now() + 86_400_000) };
    const early = await prisma.invite.upsert({
      where: { orgId_email: { orgId: decode(O.token).orgId, email: X.email } },
      create: { orgId: decode(O.token).orgId, email: X.email, ...earlyData },
      update: earlyData,
    });
    r = await call("POST", `/v1/invites/${early.token}/accept`, null, { password: PASSWORD });
    check("accepting an earlier invite while in another team → 409 with the message",
      r.status === 409 && r.json?.code === "ALREADY_IN_ANOTHER_TEAM" && r.json?.message === `Your account already belongs to another team, so you can't join ${orgName}. An account can belong to only one team.`, show(r));
    check("…and they joined nothing", (await prisma.membership.count({ where: { userId: X.id } })) === 1);
    check("…and the invite is still pending", (await prisma.invite.findUnique({ where: { id: early.id } })).status === "pending");
    // Someone with no team (removed) can be invited again.
    r = await call("POST", "/v1/team/invites", O.token, { email: removed.email, role: "VIEWER" });
    check("a removed member, now in no team, can be invited again (201)", r.status === 201, show(r));
    r = await call("POST", `/v1/invites/${r.json?.invite?.token}/accept`, null, { password: PASSWORD });
    check("…and accepts (201), with a token for this organisation", r.status === 201 && decode(r.json.token).orgId === decode(O.token).orgId, show(r));
    // Memberships load oldest first: a pre-rule second membership never changes which one signing in picks.
    const other = await owner("second-org");
    await prisma.membership.create({ data: { orgId: decode(other.token).orgId, userId: X.id, role: "EDITOR" } });
    const picks = new Set();
    for (let i = 0; i < 5; i++) picks.add(decode((await login(X.email)).json.token).orgId);
    check("a user with two memberships (from before the rule) always signs in to the older one", picks.size === 1 && picks.has(decode(X.token).orgId), [...picks].join(", "));

    // ---------- 7. impersonation limits ----------
    const PA2 = await signup("admin-2", "Admin 2");
    await prisma.user.update({ where: { id: PA2.id }, data: { isAdmin: true } });
    r = await call("POST", `/v1/admin/users/${PA.id}/impersonate`, paNew);
    check("an admin impersonates themselves → 403 \"You can't impersonate yourself.\"", r.status === 403 && r.json?.message === "You can't impersonate yourself.", show(r));
    r = await call("POST", `/v1/admin/users/${PA2.id}/impersonate`, paNew);
    check("an admin impersonates another platform admin → 403 \"Platform admins can't be impersonated.\"", r.status === 403 && r.json?.message === "Platform admins can't be impersonated.", show(r));
    const refused = await prisma.auditLog.findMany({ where: { actorId: PA.id, action: "user.impersonation_refused" }, orderBy: { createdAt: "asc" } });
    check("both refusals are in the audit log, with the admin, the target and the reason",
      refused.length === 2 && refused[0].targetId === PA.id && refused[0].meta?.reason === "self" && refused[1].targetId === PA2.id && refused[1].meta?.reason === "admin" && refused.every((x) => x.actorEmail === PA.email),
      JSON.stringify(refused.map((x) => [x.targetId, x.meta])));
    await prisma.user.update({ where: { id: sus.id }, data: { status: "suspended" } });
    r = await call("POST", `/v1/admin/users/${sus.id}/impersonate`, paNew);
    check("impersonating a suspended user → 400 with a message", r.status === 400 && r.json?.message === "This user is suspended. Reactivate them before impersonating.", show(r));
    await prisma.user.update({ where: { id: sus.id }, data: { status: "active" } });
    // An impersonation token never works on the admin console, even if its user becomes an admin.
    const imp2 = await call("POST", `/v1/admin/users/${sus.id}/impersonate`, paNew);
    await prisma.user.update({ where: { id: sus.id }, data: { isAdmin: true } });
    r = await call("GET", "/v1/admin/overview", imp2.json?.token);
    check("an impersonation token on the admin console → 403, even for a user who is now an admin", r.status === 403, show(r));
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true, memberships: { select: { orgId: true } } } });
    const ids = users.map((u) => u.id);
    const orgIds = [...new Set(users.flatMap((u) => u.memberships.map((m) => m.orgId)))];
    const own = [];
    for (const orgId of orgIds) if (!(await prisma.membership.count({ where: { orgId, userId: { notIn: ids } } }))) own.push(orgId);
    await prisma.organization.deleteMany({ where: { id: { in: own } } });
    await prisma.invite.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
  const passed = results.filter(([, p]) => p).length;
  for (const [name, pass, detail] of results) console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass || !detail ? "" : `\n      ${detail}`}`);
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
