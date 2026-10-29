// Release audit, area 8: the public pages call no API and show nothing signed-in.
//
// Loads the home page, every docs page and its Markdown version, and llms.txt from
// a running web app (a production build: the Docker image, or `next start`), in a
// browser with no session, and records every request each page makes. Then the
// same pages with a sign-in token in localStorage, as a signed-in author would
// have, to show the token is never sent from them.
//
// Env: AUDIT_WEB_URL (default http://127.0.0.1:3300), E2E_BROWSER_CHANNEL (default msedge).
// Usage: node scripts/audit/public-pages.js
const path = require("path");
const { ROOT, check, note, run } = require("./_lib");
const { chromium } = require(path.join(ROOT, "apps/web/node_modules/@playwright/test"));

const WEB = process.env.AUDIT_WEB_URL || "http://127.0.0.1:3300";
if (!["localhost", "127.0.0.1"].includes(new URL(WEB).hostname)) {
  console.error(`Refusing to run: AUDIT_WEB_URL must be on localhost (got ${WEB}).`);
  process.exit(2);
}
const CHANNEL = process.env.E2E_BROWSER_CHANNEL ?? "msedge";
const FAKE_TOKEN = "audit.fake.token";

run("Public pages", async () => {
  const index = await (await fetch(`${WEB}/docs/search-index.json`)).json();
  const docPaths = [...new Set((Array.isArray(index) ? index : index.pages || index.entries || []).map((e) => (e.slug ? `/docs/${e.slug}` : "/docs")))];
  const pages = ["/", "/docs", ...docPaths.filter((p) => p !== "/docs")];
  note("pages", `${pages.length} HTML pages from the search index, plus their .md versions and /docs/llms.txt`);

  // ---------- text routes ----------
  const text = [];
  for (const p of ["/docs.md", ...pages.filter((x) => x.startsWith("/docs/")).map((x) => `${x}.md`), "/docs/llms.txt"]) {
    const r = await fetch(WEB + p);
    text.push([p, r.status, await r.text()]);
  }
  const badText = text.filter(([, s, body]) => s !== 200 || /localhost:4000|frame_token|frame_admin_token|@example\.test/.test(body));
  check(`every .md route and llms.txt is 200 and names neither this API's origin nor a token key (${text.length})`, badText.length === 0,
    badText.map(([p, s]) => `${p} → ${s}`).join("\n"));

  // ---------- HTML pages in a browser ----------
  const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
  try {
    for (const signedIn of [false, true]) {
      const ctx = await browser.newContext();
      if (signedIn) await ctx.addInitScript((t) => localStorage.setItem("frame_token", t), FAKE_TOKEN);
      const page = await ctx.newPage();
      const offOrigin = new Set();
      const apiCalls = [];
      const withToken = [];
      page.on("request", (req) => {
        // The home page sends a signed-in visitor on to /app (HOME_REDIRECT_SCRIPT); that's the app, not a public page.
        if (new URL(page.url()).pathname.startsWith("/app")) return;
        const u = new URL(req.url());
        if (u.origin !== new URL(WEB).origin) offOrigin.add(`${u.origin}${u.pathname}`);
        if (u.pathname.startsWith("/v1/")) apiCalls.push(`${page.url()} → ${req.method()} ${req.url()}`);
        const auth = req.headers().authorization;
        if (auth?.includes(FAKE_TOKEN)) withToken.push(`${page.url()} → ${req.url()}`);
      });
      const redirected = [];
      for (const p of pages) {
        await page.goto(WEB + p, { waitUntil: "networkidle" });
        if (new URL(page.url()).pathname !== p) redirected.push(`${p} → ${new URL(page.url()).pathname}`);
      }
      const who = signedIn ? "with a token in localStorage" : "with no session";
      check(`${who}: no public page calls the API`, apiCalls.length === 0, apiCalls.join("\n"));
      check(`${who}: no public page sends the token`, withToken.length === 0, withToken.join("\n"));
      note(`${who}: requests to other origins`, offOrigin.size ? [...offOrigin].join("\n") : "none");
      note(`${who}: pages that redirected`, redirected.length ? redirected.join("\n") : "none");
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});
