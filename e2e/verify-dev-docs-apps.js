// The developer pages' apps, built the way a reader builds them
// (docs/briefs/BUILDER-BRIEF-DEVELOPER-DOCS.md): each page's code blocks go, word
// for word, into a new project in a throwaway folder, and a real browser fills
// in the form. Needs no API, database or web app.
//
// It uses the network for Vite and React only, as npm create vite and npm install
// fetch them. Everything else is local: the vendored tarball stands in for
// `npm install @zoworkhq/forms` until the package is on npm, and Express is
// linked from apps/web.
//
// Two changes to what the page says, both to avoid a clash on this machine: the
// server's port, and starting Vite directly on a free port rather than through
// `npm run dev`, so this script holds its process.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { ROOT, OUT, launchBrowser } = require("./_setup");

const WEB = path.join(ROOT, "apps/web");
const DOCS = path.join(WEB, "content/docs");
const DIR = path.join(OUT, "dev-docs");
fs.mkdirSync(DIR, { recursive: true });

const results = [];
const check = (name, pass, detail = "") => results.push([name, !!pass, detail]);

/** A page's code blocks by file name, as the code-example test reads them. */
function fencesOf(slug) {
  const mdx = fs.readFileSync(path.join(DOCS, `${slug}.mdx`), "utf8").replace(/\r\n/g, "\n");
  const files = new Map();
  for (const [, , words, code] of mdx.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```$/gm)) {
    const file = /\bfile=(\S+)/.exec(words)?.[1];
    if (file) files.set(file, code);
  }
  return files;
}

const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

function run(command, cwd) {
  const result = spawnSync(command, { cwd, shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300000 });
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout || "").slice(-600)}`);
}

/** A process of ours, with its output kept. `kill` stops this process only. */
function start(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const state = { child, log: "" };
  child.stdout.on("data", (d) => (state.log += d));
  child.stderr.on("data", (d) => (state.log += d));
  return state;
}

async function waitForUrl(url, ms = 60000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} never answered`);
}

async function quickstart(tmp, browser) {
  const files = fencesOf("integrate/quickstart");

  // Before you start, and step 1.
  run("npm create vite@latest intake-app -- --template react", tmp);
  const app = path.join(tmp, "intake-app");
  run("npm install --no-audit --no-fund", app);
  run(`npm install --no-audit --no-fund "${path.join(ROOT, "vendor/zoworkhq-forms-0.28.0.tgz")}"`, app);
  // Linked from the workspace: the check's network use stops at Vite and React.
  fs.symlinkSync(fs.realpathSync(path.join(WEB, "node_modules/express")), path.join(app, "node_modules/express"), "junction");

  const react = JSON.parse(fs.readFileSync(path.join(app, "node_modules/react/package.json"), "utf8")).version;
  check(`the Vite template's React is 19 (${react})`, react.startsWith("19."));

  // Step 2.
  fs.copyFileSync(path.join(DOCS, "integrate/intake-form.form.json"), path.join(app, "src/intake-form.json"));

  // Steps 3 to 5, word for word but for the port.
  const port = await freePort();
  for (const name of ["src/IntakePage.jsx", "src/main.jsx", "vite.config.js", "store.js", "server.js"]) {
    if (!files.has(name)) throw new Error(`the quickstart has no block for ${name}`);
    fs.writeFileSync(path.join(app, name), files.get(name).replace(/\b3000\b/g, String(port)));
  }

  // Step 6.
  const vitePort = await freePort();
  const server = start(["server.js"], app);
  const vite = start([path.join("node_modules/vite/bin/vite.js"), "--port", String(vitePort), "--strictPort"], app);
  const url = `http://localhost:${vitePort}/`;
  try {
    await waitForUrl(url);

    const open = async () => {
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
      const P = await context.newPage();
      const problems = [];
      const posted = [];
      P.on("pageerror", (e) => problems.push(e.message));
      P.on("console", (m) => {
        if (m.type() === "error" || (m.type() === "warning" && m.text().includes("@zoworkhq/forms"))) problems.push(m.text());
      });
      P.on("request", (r) => {
        if (r.url().endsWith("/api/submit")) posted.push(JSON.parse(r.postData()));
      });
      await P.goto(url);
      await P.locator(".zf-form").waitFor({ timeout: 30000 });
      return { context, P, problems, posted };
    };
    const fill = async (P) => {
      await P.getByLabel("Preferred name", { exact: true }).fill("Demo Client");
      await P.getByLabel("Email address", { exact: true }).fill("client@example.org");
      await P.getByRole("radio", { name: "Video" }).check();
      await P.getByRole("radio", { name: "No", exact: true }).check();
    };

    {
      const { context, P, problems, posted } = await open();
      const form = JSON.parse(fs.readFileSync(path.join(app, "src/intake-form.json"), "utf8"));
      check("the page shows the form's title as its h1, and its description", (await P.locator("h1").textContent()) === form.title && (await P.getByText(form.description).count()) === 1);
      const look = await P.evaluate(() => ({
        border: getComputedStyle(document.querySelector(".zf-input")).borderTopStyle,
        background: getComputedStyle(document.querySelector(".zf-submit")).backgroundColor,
      }));
      check("the stylesheet applies, with the template's index.css gone", look.border !== "none" && look.background !== "rgba(0, 0, 0, 0)", JSON.stringify(look));
      await P.screenshot({ path: path.join(DIR, "quickstart-form.png"), fullPage: true });

      // Check it works, 1.
      await P.getByRole("button", { name: "Submit" }).click();
      await P.locator(".zf-error-summary").waitFor();
      check('Submit with nothing answered shows "There is a problem"', ((await P.locator(".zf-error-summary").textContent()) || "").includes("There is a problem"));
      check("and sends nothing", posted.length === 0, `${posted.length} sent`);

      // Check it works, 2.
      await fill(P);
      await P.reload();
      await P.locator(".zf-form").waitFor();
      check("a refresh keeps the answers", (await P.getByLabel("Preferred name", { exact: true }).inputValue()) === "Demo Client");

      // Check it works, 3.
      await P.getByRole("button", { name: "Submit" }).click();
      await P.getByText("Form submitted successfully.").waitFor();
      const [body] = posted;
      check("the form posts once, with its key and time", posted.length === 1 && typeof body?.idempotencyKey === "string" && typeof body?.submittedAt === "string", JSON.stringify(body));
      check("the hidden question isn't in the body", !!body && !("therapist_name" in body.answers), JSON.stringify(body?.answers));
      const stored = await new Promise((resolve) => setTimeout(() => resolve(server.log), 300));
      check("the server's terminal prints Stored and the key", stored.includes(`Stored ${body?.idempotencyKey}`), stored);
      await P.screenshot({ path: path.join(DIR, "quickstart-submitted.png"), fullPage: true });
      check("no errors in the browser", problems.length === 0, problems.join(" | "));
      await context.close();
    }

    // "A retried submission is stored once": the first response is lost on its way back.
    {
      const { context, P, posted } = await open();
      await fill(P);
      await P.route("**/api/submit", async (route) => {
        await route.fetch();
        await route.abort();
      });
      await P.getByRole("button", { name: "Submit" }).click();
      await P.getByText("Submission failed. Your answers have been kept — please try again.").waitFor();
      await P.unroute("**/api/submit");
      await P.getByRole("button", { name: "Submit" }).click();
      await P.getByText("Form submitted successfully.").waitFor();
      const [first, second] = posted;
      check("a retry carries the same key", posted.length === 2 && first.idempotencyKey === second.idempotencyKey);
      await new Promise((r) => setTimeout(r, 300));
      const times = server.log.split(first?.idempotencyKey ?? "?").length - 1;
      check("and is stored once", times === 1, `${times} times:\n${server.log}`);
      await context.close();
    }
  } finally {
    vite.child.kill();
    server.child.kill();
  }
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zowork-dev-docs-"));
  let browser;
  try {
    browser = await launchBrowser();
    await quickstart(tmp, browser);
  } catch (e) {
    check("ran to the end", false, e.stack || String(e));
  } finally {
    if (browser) await browser.close().catch(() => {});
    // Windows holds a just-killed process's files for a moment.
    await new Promise((r) => setTimeout(r, 1000));
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }

  for (const [name, pass, detail] of results) console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail && !pass ? ` — ${detail}` : ""}`);
  const passed = results.filter((r) => r[1]).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
