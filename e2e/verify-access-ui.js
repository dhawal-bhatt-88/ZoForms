// Sign-in and access in the browser (release fixes, CP1's messages): a signed-in
// page whose session the API refuses goes to sign-in, which says the session
// ended; an unverified owner's Team page says to verify first and resends the
// link (no email here, so it says it couldn't); inviting someone in another
// team, and accepting an earlier invite while in one, are refused with their
// messages. Light and dark; screenshots in output/release-fixes/.
const fs = require("fs");
const path = require("path");
const { API, WEB, OUT, PrismaClient, launchBrowser, markVerified } = require("./_setup");
const prisma = new PrismaClient();

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = path.join(OUT, "release-fixes");
fs.mkdirSync(SHOTS, { recursive: true });
const PREFIX = `verify-access-ui-${Date.now()}`;
const PASSWORD = "Verify-pass-123!";
const json = { "Content-Type": "application/json" };

async function signup(who, name) {
  const email = `${PREFIX}-${who}@example.test`;
  const r = await (await fetch(API + "/v1/auth/signup", { method: "POST", headers: json, body: JSON.stringify({ email, password: PASSWORD, name }) })).json();
  if (!r.token) throw new Error(`signup ${who}: ${JSON.stringify(r)}`);
  return { email, token: r.token, id: r.user.id, orgId: JSON.parse(Buffer.from(r.token.split(".")[1], "base64url")).orgId };
}

(async () => {
  let browser;
  try {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(API + "/health")).ok && (await fetch(WEB + "/login")).ok) break; } catch {} await sleep(1000); }
    browser = await launchBrowser();
    for (const theme of ["light", "dark"]) {
      const context = async (token) => {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await ctx.addCookies([{ name: "zoblocks-theme", value: theme, url: WEB }]);
        if (token) await ctx.addInitScript((t) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("frame_token", t); sessionStorage.setItem("seeded", "1"); } }, token);
        return ctx;
      };

      // ---------- a refused session: sign-in says why ----------
      const gone = await signup(`gone-${theme}`, "Gone");
      let ctx = await context(gone.token);
      let page = await ctx.newPage();
      await page.goto(`${WEB}/app`);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await prisma.user.update({ where: { id: gone.id }, data: { status: "suspended" } });
      await page.reload();
      await page.waitForURL(/\/login\?signedOut=1$/);
      const notice = page.getByRole("status").filter({ hasText: "Your session has ended. Sign in again to continue." });
      await notice.waitFor();
      check(`${theme}: a refused session goes to sign-in, which says the session ended`, true);
      check(`${theme}: …and the token is gone`, (await page.evaluate(() => localStorage.getItem("frame_token"))) === null);
      await page.screenshot({ path: path.join(SHOTS, `signed-out-${theme}.png`) });
      await page.getByLabel("Email").fill(gone.email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Log in" }).click();
      // Next's route announcer is an alert too: the callout is the one with the title.
      const refused = page.getByRole("alert").filter({ hasText: "Couldn't log in" });
      await refused.waitFor();
      check(`${theme}: signing in again while suspended says so`, (await refused.innerText()).includes("This account is suspended."), await refused.innerText());
      await ctx.close();

      // ---------- an unverified owner's Team page ----------
      const owner = await signup(`owner-${theme}`, "Owner");
      ctx = await context(owner.token);
      page = await ctx.newPage();
      await page.goto(`${WEB}/app/team`);
      const verify = page.getByRole("status").filter({ hasText: "Verify your email address before inviting teammates." });
      await verify.waitFor();
      check(`${theme}: unverified: the Team page says to verify before inviting, naming the address`, (await verify.innerText()).includes(owner.email), await verify.innerText());
      check(`${theme}: …and shows no invite form`, (await page.getByRole("button", { name: "Invite", exact: true }).count()) === 0);
      await page.screenshot({ path: path.join(SHOTS, `team-unverified-${theme}.png`) });
      await verify.getByRole("button", { name: "Resend verification email" }).click();
      await verify.getByText("Email isn't set up on this server, so we couldn't send the link.").waitFor();
      check(`${theme}: Resend says the link couldn't be sent, as no email is set up`, true);
      await page.screenshot({ path: path.join(SHOTS, `team-unverified-resent-${theme}.png`) });
      await ctx.close();

      // ---------- inviting someone who is in another team ----------
      await markVerified(prisma, owner.email);
      const other = await signup(`other-${theme}`, "Other");
      ctx = await context(owner.token);
      page = await ctx.newPage();
      await page.goto(`${WEB}/app/team`);
      await page.getByLabel("Email").fill(other.email);
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      const toast = page.getByText(`${other.email} already belongs to another team. An account can belong to only one team.`);
      await toast.waitFor();
      check(`${theme}: inviting someone in another team shows the refusal`, true);
      check(`${theme}: …and makes no invite`, (await prisma.invite.count({ where: { email: other.email } })) === 0);
      await page.screenshot({ path: path.join(SHOTS, `second-team-invite-${theme}.png`) });
      await ctx.close();

      // ---------- accepting an earlier invite while in another team ----------
      const orgName = (await prisma.organization.findUnique({ where: { id: owner.orgId } })).name;
      const early = await prisma.invite.create({ data: { orgId: owner.orgId, email: other.email, role: "EDITOR", token: `${PREFIX}-${theme}-early`, expiresAt: new Date(Date.now() + 86_400_000) } });
      ctx = await context(null);
      page = await ctx.newPage();
      await page.goto(`${WEB}/invite/${early.token}`);
      await page.getByLabel("Your password").fill(PASSWORD);
      await page.getByRole("button", { name: `Accept & join ${orgName}` }).click();
      const alert = page.getByRole("alert").filter({ hasText: "Couldn't accept the invite" });
      await alert.waitFor();
      check(`${theme}: accepting an earlier invite while in another team is refused with the message`,
        (await alert.innerText()).includes(`Your account already belongs to another team, so you can't join ${orgName}. An account can belong to only one team.`), await alert.innerText());
      check(`${theme}: …and they joined nothing`, (await prisma.membership.count({ where: { userId: other.id } })) === 1);
      await page.screenshot({ path: path.join(SHOTS, `second-team-accept-${theme}.png`) });
      await ctx.close();
    }
  } catch (e) {
    check("script ran without error", false, e.stack);
  } finally {
    if (browser) await browser.close();
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true, memberships: { select: { orgId: true } } } });
    for (const orgId of new Set(users.flatMap((u) => u.memberships.map((m) => m.orgId)))) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.invite.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  }
  const passed = results.filter(([, p]) => p).length;
  for (const [name, pass, detail] of results) console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${pass || !detail ? "" : `   [${detail}]`}`);
  console.log(`\n  ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
