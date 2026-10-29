// Release audit, areas 1 and 3: who may call what, by calling the API directly.
//
// - Role matrix: an owner, admin, editor and viewer of one organisation call every
//   form, template and team write route, and the admin routes.
// - Membership changes after sign-in: a lowered role, a removed member.
// - Suspension: a suspended user, and a member of a suspended organisation.
// - Platform admin: AuditLog rows for impersonation, deletes and suspensions, and
//   impersonating another platform admin.
//
// Usage: node scripts/audit/permissions.js   (API on AUDIT_API_URL, default :4100)
const { call, signup, emailFor, decode, check, note, run, short, prisma, PASSWORD } = require("./_lib");

const q = (id, label) => ({ id, type: "short", label, required: false });
const ok = (r) => r.status >= 200 && r.status < 300;

/** Invite `who` into the owner's organisation with `role` and accept as a new account. */
async function addMember(ownerToken, who, role) {
  const email = emailFor(who);
  const inv = await call("POST", "/v1/team/invites", ownerToken, { email, role });
  if (!ok(inv)) throw new Error(`invite ${who}: ${short(inv)}`);
  const token = inv.json.acceptUrl.split("/invite/")[1];
  const acc = await call("POST", `/v1/invites/${token}/accept`, null, { password: PASSWORD, name: who });
  if (!ok(acc)) throw new Error(`accept ${who}: ${short(acc)}`);
  return { email, token: acc.json.token, id: acc.json.user.id };
}

run("Permissions", async () => {
  const owner = await signup("owner", "Owner");
  const T = owner.token;
  const admin = await addMember(T, "admin", "ADMIN");
  const editor = await addMember(T, "editor", "EDITOR");
  const viewer = await addMember(T, "viewer", "VIEWER");
  const roles = { OWNER: owner, ADMIN: admin, EDITOR: editor, VIEWER: viewer };
  check("setup: all four roles are in the owner's organisation",
    Object.values(roles).every((m) => decode(m.token).orgId === decode(T).orgId));

  // ---------- role matrix ----------
  const matrix = [];
  for (const [role, m] of Object.entries(roles)) {
    const tok = m.token;
    const canWrite = role !== "VIEWER";
    const canManage = role === "OWNER" || role === "ADMIN";
    // Fresh targets made by the owner, so no role's calls depend on another's.
    const form = (await call("POST", "/v1/forms", T, { title: `F-${role}` })).json;
    await call("PUT", `/v1/forms/${form.id}/schema`, T, { title: `F-${role}`, blocks: [q("a", "A")] });
    const victim = (await call("POST", "/v1/forms", T, { title: `Del-${role}` })).json;
    const versions = (await call("GET", `/v1/forms/${form.id}/versions`, T)).json;
    const tpl = (await call("POST", "/v1/templates", T, { kind: "form", name: `T-${role}`, content: { title: "T", blocks: [q("t", "T")] } })).json;
    const tplVictim = (await call("POST", "/v1/templates", T, { kind: "form", name: `TD-${role}`, content: { title: "T", blocks: [q("t", "T")] } })).json;
    const pending = (await call("POST", "/v1/team/invites", T, { email: emailFor(`pending-${role}`), role: "EDITOR" })).json.invite;
    const dummy = await addMember(T, `dummy-${role}`, "EDITOR");

    const cases = [
      ["read: list forms", "GET", "/v1/forms", undefined, true],
      ["read: get form", "GET", `/v1/forms/${form.id}`, undefined, true],
      ["read: list versions", "GET", `/v1/forms/${form.id}/versions`, undefined, true],
      ["read: download artifact", "GET", `/v1/forms/${form.id}/artifact`, undefined, true],
      ["read: list templates", "GET", "/v1/templates", undefined, true],
      ["read: team members", "GET", "/v1/team/members", undefined, true],
      ["create form", "POST", "/v1/forms", { title: "new" }, canWrite],
      ["create form from template", "POST", "/v1/forms", { templateId: tpl.id }, canWrite],
      ["save form", "PUT", `/v1/forms/${form.id}/schema`, { title: `F-${role}`, blocks: [q("a", "A"), q("b", "B")] }, canWrite],
      ["restore version", "POST", `/v1/forms/${form.id}/versions/${versions[versions.length - 1].id}/restore`, undefined, canWrite],
      ["duplicate form", "POST", `/v1/forms/${form.id}/duplicate`, undefined, canWrite],
      ["delete form", "DELETE", `/v1/forms/${victim.id}`, undefined, canWrite],
      ["create template", "POST", "/v1/templates", { kind: "form", name: "x", content: { title: "x", blocks: [q("x", "X")] } }, canWrite],
      ["rename template", "PATCH", `/v1/templates/${tpl.id}`, { name: `T-${role}-renamed` }, canWrite],
      ["delete template", "DELETE", `/v1/templates/${tplVictim.id}`, undefined, canWrite],
      ["duplicate template", "POST", `/v1/templates/${tpl.id}/duplicate`, undefined, canWrite],
      ["list invites", "GET", "/v1/team/invites", undefined, canManage],
      ["invite someone", "POST", "/v1/team/invites", { email: emailFor(`new-${role}`), role: "EDITOR" }, canManage],
      ["revoke invite", "DELETE", `/v1/team/invites/${pending.id}`, undefined, canManage],
      ["change a member's role", "PATCH", `/v1/team/members/${dummy.id}`, { role: "VIEWER" }, canManage],
      ["remove a member", "DELETE", `/v1/team/members/${dummy.id}`, undefined, canManage],
      ["invite an OWNER", "POST", "/v1/team/invites", { email: emailFor(`own-${role}`), role: "OWNER" }, role === "OWNER"],
      ["admin console: overview", "GET", "/v1/admin/overview", undefined, false],
    ];
    for (const [name, method, p, body, expected] of cases) {
      const r = await call(method, p, tok, body);
      matrix.push({ role, name, expected, got: r.status });
      check(`${role}: ${name} → ${expected ? "allowed" : "refused"}`, ok(r) === expected, short(r));
    }
  }
  const table = ["| route | OWNER | ADMIN | EDITOR | VIEWER |", "|---|---|---|---|---|"];
  for (const name of [...new Set(matrix.map((x) => x.name))]) {
    const cell = (role) => {
      const x = matrix.find((y) => y.role === role && y.name === name);
      return `${x.got}${ok({ status: x.got }) === x.expected ? "" : " ✗"}`;
    };
    table.push(`| ${name} | ${cell("OWNER")} | ${cell("ADMIN")} | ${cell("EDITOR")} | ${cell("VIEWER")} |`);
  }
  note("role matrix (status codes; ✗ = not as expected)", table.join("\n"));

  // Every admin route, as an organisation owner who isn't a platform admin.
  const someId = "00000000-0000-4000-8000-000000000000";
  const adminRoutes = [
    ["GET", "/v1/admin/overview"], ["GET", "/v1/admin/orgs"], ["GET", `/v1/admin/orgs/${someId}`],
    ["PATCH", `/v1/admin/orgs/${someId}`], ["GET", "/v1/admin/users"], ["PATCH", `/v1/admin/users/${someId}`],
    ["DELETE", `/v1/admin/users/${someId}`], ["POST", `/v1/admin/users/${someId}/impersonate`],
    ["GET", "/v1/admin/forms"], ["DELETE", `/v1/admin/forms/${someId}`], ["GET", "/v1/admin/audit"],
  ];
  const adminStatuses = [];
  for (const [method, p] of adminRoutes) {
    const r = await call(method, p, T, method === "PATCH" ? { status: "active" } : undefined);
    adminStatuses.push(`${method} ${p} → ${r.status}`);
    check(`non-admin owner: ${method} ${p} → 403`, r.status === 403, short(r));
  }
  const anon = await call("GET", "/v1/admin/overview");
  check("anonymous: admin overview → 401", anon.status === 401, short(anon));

  // ---------- membership changes after sign-in ----------
  const formA = (await call("POST", "/v1/forms", T, { title: "Org A form" })).json;
  await call("PUT", `/v1/forms/${formA.id}/schema`, T, { title: "Org A form", blocks: [q("s", "Confidential question")] });

  // A lowered role: writes are checked against the database, so the old token can't write.
  const lowered = await addMember(T, "lowered", "EDITOR");
  await call("PATCH", `/v1/team/members/${lowered.id}`, T, { role: "VIEWER" });
  let r = await call("PUT", `/v1/forms/${formA.id}/schema`, lowered.token, { title: "Org A form", blocks: [q("s", "changed")] });
  check("editor lowered to viewer: old token can't save (403)", r.status === 403, short(r));

  // A removed member keeps the token, whose orgId reads trust.
  const removed = await addMember(T, "removed", "EDITOR");
  r = await call("DELETE", `/v1/team/members/${removed.id}`, T);
  check("setup: member removed", ok(r), short(r));
  const reads = [
    ["list forms", "GET", "/v1/forms"],
    ["get form", "GET", `/v1/forms/${formA.id}`],
    ["list versions", "GET", `/v1/forms/${formA.id}/versions`],
    ["download artifact", "GET", `/v1/forms/${formA.id}/artifact`],
    ["list templates", "GET", "/v1/templates"],
    ["team members", "GET", "/v1/team/members"],
  ];
  for (const [name, method, p] of reads) {
    r = await call(method, p, removed.token);
    check(`removed member, old token: ${name} → refused`, !ok(r), `${short(r)}${r.text.includes("Confidential") ? "  ← contains the form's content" : ""}`);
  }
  r = await call("PUT", `/v1/forms/${formA.id}/schema`, removed.token, { title: "x", blocks: [q("s", "x")] });
  check("removed member, old token: save → refused", !ok(r), short(r));
  r = await call("POST", "/v1/auth/login", null, { email: removed.email, password: PASSWORD });
  note("removed member signs in again", `${short(r)}${r.json?.token ? ` → token for org ${decode(r.json.token).orgId === decode(T).orgId ? "A (the one they were removed from)" : decode(r.json.token).orgId}` : ""}`);

  // ---------- platform admin ----------
  const pa = await signup("platform-admin");
  await prisma.user.update({ where: { id: pa.id }, data: { isAdmin: true } });
  const pa2 = await signup("platform-admin-2");
  await prisma.user.update({ where: { id: pa2.id }, data: { isAdmin: true } });

  // Suspended user.
  const sus = await addMember(T, "suspended", "EDITOR");
  r = await call("PATCH", `/v1/admin/users/${sus.id}`, pa.token, { status: "suspended" });
  check("setup: admin suspends a user", ok(r), short(r));
  r = await call("POST", "/v1/auth/login", null, { email: sus.email, password: PASSWORD });
  check("suspended user: sign-in → refused", !ok(r), short(r));
  r = await call("GET", `/v1/forms/${formA.id}`, sus.token);
  check("suspended user, existing token: read form → refused", !ok(r), short(r));
  r = await call("PUT", `/v1/forms/${formA.id}/schema`, sus.token, { title: "Org A form", blocks: [q("s", "by suspended user")] });
  check("suspended user, existing token: save → refused", !ok(r), short(r));

  // Suspended organisation.
  r = await call("PATCH", `/v1/admin/orgs/${decode(T).orgId}`, pa.token, { status: "suspended" });
  check("setup: admin suspends the organisation", ok(r), short(r));
  r = await call("POST", "/v1/auth/login", null, { email: editor.email, password: PASSWORD });
  check("member of suspended organisation: sign-in → refused", !ok(r), short(r));
  r = await call("PUT", `/v1/forms/${formA.id}/schema`, editor.token, { title: "Org A form", blocks: [q("s", "while suspended")] });
  check("member of suspended organisation: save → refused", !ok(r), short(r));
  r = await call("GET", `/v1/forms/${formA.id}/artifact`, editor.token);
  check("member of suspended organisation: download → refused", !ok(r), short(r));
  await call("PATCH", `/v1/admin/orgs/${decode(T).orgId}`, pa.token, { status: "active" });

  // Audit rows: who did it.
  const imp = await call("POST", `/v1/admin/users/${editor.id}/impersonate`, pa.token);
  check("admin impersonates a user", ok(imp), short(imp));
  note("impersonation token claims", JSON.stringify({ ...decode(imp.json.token), iat: "…", exp: `iat + ${decode(imp.json.token).exp - decode(imp.json.token).iat}s` }));
  const doomedForm = (await call("POST", "/v1/forms", T, { title: "Admin will delete" })).json;
  r = await call("DELETE", `/v1/admin/forms/${doomedForm.id}`, pa.token);
  check("admin deletes a form", ok(r), short(r));
  const doomedUser = await addMember(T, "doomed", "EDITOR");
  r = await call("DELETE", `/v1/admin/users/${doomedUser.id}`, pa.token);
  check("admin deletes a user", ok(r), short(r));
  const rows = await prisma.auditLog.findMany({ where: { actorId: pa.id }, orderBy: { createdAt: "asc" } });
  const want = ["user.suspended", "org.suspended", "org.reactivated", "user.impersonated", "form.deleted", "user.deleted"];
  for (const action of want) {
    const row = rows.find((x) => x.action === action);
    check(`AuditLog has ${action} with the admin's id and email`, row && row.actorId === pa.id && row.actorEmail === pa.email, row ? JSON.stringify({ action: row.action, actorEmail: row.actorEmail, targetType: row.targetType, targetId: row.targetId, meta: row.meta }) : "no row");
  }

  // Impersonating another platform admin, then acting as them in the admin console.
  r = await call("POST", `/v1/admin/users/${pa2.id}/impersonate`, pa.token);
  note("admin impersonates another platform admin", short(r));
  if (ok(r)) {
    const asPa2 = r.json.token;
    const ov = await call("GET", "/v1/admin/overview", asPa2);
    note("…the impersonation token on the admin console", short(ov));
    const victim2 = (await call("POST", "/v1/forms", T, { title: "Deleted while impersonating" })).json;
    const del = await call("DELETE", `/v1/admin/forms/${victim2.id}`, asPa2);
    const row = await prisma.auditLog.findFirst({ where: { action: "form.deleted", targetId: victim2.id } });
    note("…a form deleted with it is logged as", `${del.status}; actor ${row ? `${row.actorEmail} (${row.actorId === pa2.id ? "the impersonated admin" : row.actorId === pa.id ? "the real admin" : "?"})` : "no row"}; meta ${JSON.stringify(row?.meta)}`);
  }
  // Impersonating someone who is suspended.
  r = await call("POST", `/v1/admin/users/${sus.id}/impersonate`, pa.token);
  note("admin impersonates a suspended user", short(r));
});
