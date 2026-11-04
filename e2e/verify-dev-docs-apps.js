// The developer pages' apps, built the way a reader builds them
// (docs/briefs/BUILDER-BRIEF-DEVELOPER-DOCS.md): each page's code blocks go, word
// for word, into a new project in a throwaway folder, and a real browser fills
// in the form. Needs no API, database or web app.
//
// It uses the network for Vite and React only, as npm create vite and npm install
// fetch them. Everything else is local: the vendored tarball stands in for
// `npm install @zoworkhq/forms` until the package is on npm, and Express,
// Tailwind, and for the Next.js tutorial Next.js, React and TypeScript, are
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
// The package the web app installs: "file:../../vendor/zoworkhq-forms-<version>.tgz".
const TARBALL = path.resolve(WEB, JSON.parse(fs.readFileSync(path.join(WEB, "package.json"), "utf8")).dependencies["@zoworkhq/forms"].replace(/^file:/, ""));
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
  run(`npm install --no-audit --no-fund "${TARBALL}"`, app);
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
  return app;
}

const sha256 = (text) => require("crypto").createHash("sha256").update(text, "utf8").digest("hex");

/** A page's table, by its header cells, as rows of cell text with the backticks gone. */
function tableOf(slug, headers) {
  const lines = fs.readFileSync(path.join(DOCS, `${slug}.mdx`), "utf8").replace(/\r\n/g, "\n").split("\n");
  const at = lines.indexOf(`| ${headers.join(" | ")} |`);
  if (at < 0) throw new Error(`${slug} has no table headed ${headers.join(", ")}`);
  const rows = [];
  for (const line of lines.slice(at + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.split("|").slice(1, -1).map((c) => c.trim().replace(/`/g, "")));
  }
  return rows;
}

/**
 * "Save progress (drafts)", in the quickstart's app: the device and server
 * modes, word for word. Three changes, for this script only: main.jsx shows
 * each page at its own path; the server's port; and /api/draft-key, which the
 * page leaves to your server, answers with a fixed demo key here.
 */
async function drafts(app, browser) {
  const files = fencesOf("integrate/drafts");
  const names = ["src/signed-in.js", "src/draft-key.js", "src/DeviceIntakePage.jsx", "src/draft-functions.js", "src/ServerIntakePage.jsx", "src/SignedOut.jsx", "store.js", "draft-store.js", "server.js"];
  const port = await freePort();
  for (const name of names) {
    if (!files.has(name)) throw new Error(`the drafts page has no block for ${name}`);
    fs.writeFileSync(path.join(app, name), files.get(name).replace(/\b3000\b/g, String(port)));
  }
  fs.writeFileSync(path.join(app, "vite.config.js"), fencesOf("integrate/quickstart").get("vite.config.js").replace(/\b3000\b/g, String(port)));
  for (const mode of ["device", "server"]) fs.copyFileSync(path.join(DOCS, `integrate/intake-${mode}.form.json`), path.join(app, `src/intake-${mode}.json`));
  fs.writeFileSync(
    path.join(app, "src/main.jsx"),
    `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@zoworkhq/forms/styles.css';
import { DeviceIntakePage } from './DeviceIntakePage.jsx';
import { ServerIntakePage } from './ServerIntakePage.jsx';
import { SignedOut } from './SignedOut.jsx';

const pages = {
  '/server': () => <ServerIntakePage />,
  '/signed-out': () => <SignedOut userId="user-demo-1" />,
};
createRoot(document.getElementById('root')).render(<StrictMode>{(pages[location.pathname] ?? (() => <DeviceIntakePage />))()}</StrictMode>);
`,
  );

  const deviceForm = JSON.parse(fs.readFileSync(path.join(app, "src/intake-device.json"), "utf8"));
  const serverForm = JSON.parse(fs.readFileSync(path.join(app, "src/intake-server.json"), "utf8"));
  const scope = "user-demo-1:client-demo-1";
  const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));

  const vitePort = await freePort();
  const server = start(["server.js"], app);
  const vite = start([path.join("node_modules/vite/bin/vite.js"), "--port", String(vitePort), "--strictPort"], app);
  const base = `http://localhost:${vitePort}`;
  try {
    await waitForUrl(`${base}/`);
    const problems = [];
    const watch = (P) => {
      P.on("pageerror", (e) => problems.push(e.message));
      P.on("console", (m) => {
        if (m.type() === "error" || (m.type() === "warning" && m.text().includes("@zoworkhq/forms"))) problems.push(m.text());
      });
      return P;
    };
    const fillStart = async (P) => {
      await P.getByLabel("Preferred name", { exact: true }).fill("Demo Client");
      await P.getByLabel("Email address", { exact: true }).fill("client@example.org");
    };
    const answerAndHide = async (P) => {
      await P.getByRole("radio", { name: "Yes", exact: true }).check();
      await P.getByLabel("Therapist's name", { exact: true }).fill("Dr. Demo");
      await P.getByRole("radio", { name: "No", exact: true }).check();
    };
    /** The device database, as the page sees it, with binary fields as byte arrays. */
    const database = (P) =>
      P.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const open = indexedDB.open("zoworkhq-forms-drafts");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const stores = [...db.objectStoreNames];
              if (!stores.includes("drafts")) return resolve({ stores, records: [] });
              const store = db.transaction("drafts").objectStore("drafts");
              const indexes = [...store.indexNames];
              const keys = store.getAllKeys();
              const values = store.getAll();
              values.onsuccess = () =>
                resolve({
                  stores,
                  indexes,
                  keys: keys.result,
                  records: values.result.map((r) => ({ ...r, iv: [...new Uint8Array(r.iv)], ciphertext: [...new Uint8Array(r.ciphertext)] })),
                });
              values.onerror = () => reject(values.error);
            };
          }),
      );
    const tabEntries = (P) => P.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).filter((k) => k.startsWith("@zoworkhq/forms:")).map((k) => [k, JSON.parse(sessionStorage.getItem(k))])));

    // On this device.
    {
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
      await context.route("**/api/draft-key", (route) => route.fulfill({ status: 200, contentType: "application/octet-stream", body: KEY }));
      await context.route("**/api/submit", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
      const P = watch(await context.newPage());
      await P.goto(`${base}/device`);
      await P.locator(".zf-submit").waitFor({ timeout: 30000 });
      await fillStart(P);
      await answerAndHide(P);
      await P.waitForTimeout(1800);

      const before = Date.now();
      const db = await database(P);
      const [record] = db.records;
      check("device mode: one IndexedDB database zoworkhq-forms-drafts, store drafts, indexes on scopeHash and ownerHash", db.stores.join() === "drafts" && db.indexes.slice().sort().join() === "ownerHash,scopeHash" && db.records.length === 1, JSON.stringify({ stores: db.stores, indexes: db.indexes, n: db.records.length }));
      // The device draft's table: the tab copy's has a third column.
      const fieldTable = tableOf("integrate/concepts/browser-storage", ["Field", "What it holds"]).map((r) => r[0]);
      check("its record has the fields the browser-storage page lists", JSON.stringify(Object.keys(record ?? {}).sort()) === JSON.stringify(fieldTable.sort()), `${Object.keys(record ?? {})} vs ${fieldTable}`);
      check("keyed by the hex SHA-256 of scope, U+0000 and formId", db.keys[0] === sha256(`${scope}\u0000${deviceForm.formId}`), db.keys[0]);
      check("with scopeHash and ownerHash the hashes of scope and owner", record?.scopeHash === sha256(scope) && record?.ownerHash === sha256("user-demo-1"));
      check("a 96-bit iv", record?.iv.length === 12, String(record?.iv.length));
      const days = (record?.expiresAt - before) / 86400000;
      check("expiresAt 7 days on", Math.abs(days - 7) < 0.01, String(days));
      check("the answers aren't readable in it", !Buffer.from(record?.ciphertext ?? []).includes("Demo Client"));
      const draft = await P.evaluate(
        async ({ key, iv, ciphertext }) => {
          const k = await crypto.subtle.importKey("raw", new Uint8Array(key), "AES-GCM", false, ["decrypt"]);
          const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, k, new Uint8Array(ciphertext));
          return JSON.parse(new TextDecoder().decode(plain));
        },
        { key: [...KEY], iv: record.iv, ciphertext: record.ciphertext },
      );
      check("it opens with the user's key, as the whole draft, hidden answer included", draft.formId === deviceForm.formId && draft.formVersionId === deviceForm.formVersionId && draft.answers.therapist_name?.value === "Dr. Demo" && typeof draft.savedAt === "string", JSON.stringify(draft));

      const tab = await tabEntries(P);
      const tabKey = `@zoworkhq/forms:${deviceForm.formId}:${deviceForm.formVersionId}:${sha256(scope)}`;
      check("the tab's copy is keyed by the scope's hash, holds the hidden answer, and has no startedAt or address", Object.keys(tab).join() === tabKey && tab[tabKey].answers.therapist_name?.value === "Dr. Demo" && tab[tabKey].ownerHash === sha256("user-demo-1") && !("startedAt" in tab[tabKey]) && !("address" in tab[tabKey]), JSON.stringify(tab));
      await P.screenshot({ path: path.join(DIR, "drafts-device-form.png"), fullPage: true });

      // A new tab: the draft is found and offered.
      const P2 = watch(await context.newPage());
      await P2.goto(`${base}/device`);
      const prompt = P2.getByText(/^You have a saved draft from .+ for Demo Client\.$/);
      await prompt.waitFor({ timeout: 30000 });
      check('a new tab asks first: "You have a saved draft from {date, time} for Demo Client."', (await P2.getByRole("heading", { name: "Continue where you left off?" }).count()) === 1);
      await P2.screenshot({ path: path.join(DIR, "drafts-device-prompt.png"), fullPage: true });
      // The first tab saves as it closes ("last save wins" between two tabs), so close it before this tab submits.
      await P.close();
      await P2.waitForTimeout(500);
      await P2.getByRole("button", { name: "Continue" }).click();
      await P2.getByLabel("Preferred name", { exact: true }).waitFor();
      await P2.getByRole("radio", { name: "Yes", exact: true }).check();
      check("Continue brings the answers back, the hidden one too", (await P2.getByLabel("Preferred name", { exact: true }).inputValue()) === "Demo Client" && (await P2.getByLabel("Therapist's name", { exact: true }).inputValue()) === "Dr. Demo");
      await P2.getByRole("radio", { name: "No", exact: true }).check();
      await P2.waitForTimeout(1800);
      const later = (await database(P2)).records[0];
      check("each save moves expiresAt on", later?.expiresAt > record.expiresAt, `${later?.expiresAt} after ${record.expiresAt}`);

      await P2.getByRole("radio", { name: "Video" }).check();
      await P2.getByRole("button", { name: "Submit" }).click();
      await P2.getByText("Form submitted successfully.").waitFor();
      await P2.waitForTimeout(500);
      check("a submit deletes the device draft and the tab's copy", (await database(P2)).records.length === 0 && Object.keys(await tabEntries(P2)).length === 0);
      await P2.close();

      // Signing out, after leaving the form.
      const P3 = watch(await context.newPage());
      await P3.goto(`${base}/device`);
      await P3.locator(".zf-submit").waitFor({ timeout: 30000 });
      await fillStart(P3);
      await P3.waitForTimeout(1800);
      const saved = (await database(P3)).records.length;
      await P3.goto(`${base}/signed-out`);
      await P3.getByText("You've signed out.").waitFor({ timeout: 30000 });
      check("the signed-out page's clearDrafts({ owner }) deletes the device draft and the tab's copy", saved === 1 && (await database(P3)).records.length === 0 && Object.keys(await tabEntries(P3)).length === 0, `saved ${saved}`);
      await context.close();
    }

    // On the app's server.
    {
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
      const calls = [];
      context.on("request", (r) => {
        const m = /\/api\/drafts\/(\w+)$/.exec(r.url());
        if (m) calls.push({ action: m[1], body: JSON.parse(r.postData() || "null") });
      });
      const P = watch(await context.newPage());
      await P.goto(`${base}/server`);
      await P.locator(".zf-next").waitFor({ timeout: 30000 });
      await fillStart(P);
      check("server mode saves nothing on an answer", !calls.some((c) => c.action === "save"));
      await P.getByRole("button", { name: "Next" }).click();
      await P.getByRole("heading", { name: "Your visit" }).waitFor();
      await P.waitForTimeout(500);
      const save = calls.find((c) => c.action === "save");
      check("Next saves the draft to the server, with its scope and the page", save?.body.scope === scope && save?.body.draft.formId === serverForm.formId && save?.body.draft.currentPageId === "page_visit", JSON.stringify(save));

      const P2 = watch(await context.newPage());
      await P2.goto(`${base}/server`);
      await P2.getByText(/^You have a saved draft from .+ for Demo Client\.$/).waitFor({ timeout: 30000 });
      check("a new tab loads it from the server and asks first", calls.some((c) => c.action === "load" && c.body.scope === scope && c.body.formId === serverForm.formId));
      await P2.getByRole("button", { name: "Continue" }).click();
      await P2.getByRole("heading", { name: "Your visit" }).waitFor();
      await P2.getByRole("radio", { name: "Video" }).check();
      await P2.getByRole("radio", { name: "No", exact: true }).check();
      await P2.getByRole("button", { name: "Submit" }).click();
      await P2.getByText("Form submitted successfully.").waitFor();
      await P2.waitForTimeout(500);
      const left = await (await fetch(`http://127.0.0.1:${port}/api/drafts/load`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, formId: serverForm.formId }) })).json();
      check("a submit calls deleteDraft, and the server's draft is gone", calls.some((c) => c.action === "delete") && left.draft === null, JSON.stringify(left));
      await P2.screenshot({ path: path.join(DIR, "drafts-server-submitted.png"), fullPage: true });
      await context.close();
    }
    check("no errors in the browser, in either mode", problems.length === 0, problems.join(" | "));
  } finally {
    vite.child.kill();
    server.child.kill();
  }
}

/** Every fence on a page, in order: { lang, file, code }. */
function allFencesOf(slug) {
  const mdx = fs.readFileSync(path.join(DOCS, `${slug}.mdx`), "utf8").replace(/\r\n/g, "\n");
  return [...mdx.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```$/gm)].map(([, lang, words, code]) => ({ lang, file: /\bfile=(\S+)/.exec(words)?.[1], code }));
}

/**
 * "Style the form", in the same app: the page's CSS, word for word, on the
 * two-page intake. Its brand and dark-theme properties, the heading clash and
 * both fixes, and Tailwind 3's reset with and without the page's layer.
 * Tailwind is linked from apps/web, so no network is used. For this script
 * only: main.jsx shows the form at its own paths, and the page's CSS is added
 * to the page rather than written into the app's files, apart from
 * src/index.css, which Tailwind must compile.
 */
async function styling(app, browser) {
  const css = allFencesOf("integrate/styling").filter((f) => f.lang === "css");
  const byFile = (name) => css.find((f) => f.file === name).code;
  const [inheritFix, scopeFix] = css.filter((f) => !f.file && /\bh1, h2\b|\(h1, h2\)/.test(f.code)).map((f) => f.code);
  if (!inheritFix || !scopeFix) throw new Error("the styling page has lost one of its heading fixes");

  fs.symlinkSync(fs.realpathSync(path.join(WEB, "node_modules/tailwindcss")), path.join(app, "node_modules/tailwindcss"), "junction");
  fs.writeFileSync(path.join(app, "tailwind.config.js"), "export default { content: ['./index.html', './src/**/*.{js,jsx}'] };\n");
  fs.writeFileSync(path.join(app, "postcss.config.js"), "export default { plugins: { tailwindcss: {} } };\n");
  const unlayered = "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n";
  fs.writeFileSync(path.join(app, "src/index.css"), "/* no Tailwind yet */\n");
  fs.writeFileSync(
    path.join(app, "src/main.jsx"),
    `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FormRenderer } from '@zoworkhq/forms/react';
import '@zoworkhq/forms/styles.css';
import './index.css';
import schema from './intake-server.json';

const dark = location.pathname === '/dark';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <h1>{schema.title}</h1>
    <div data-zf-theme={dark ? 'dark' : undefined}>
      <FormRenderer schema={schema} endpoint="/api/submit" drafts={{ mode: 'off' }} />
    </div>
  </StrictMode>,
);
`,
  );

  const vitePort = await freePort();
  const vite = start([path.join("node_modules/vite/bin/vite.js"), "--port", String(vitePort), "--strictPort"], app);
  const base = `http://localhost:${vitePort}`;
  const rgb = (hex) => `rgb(${hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16)).join(", ")})`;
  try {
    await waitForUrl(`${base}/`);
    const open = async (route, ...styles) => {
      // Reduced motion: the stylesheet animates colour changes, which would be read half-way.
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 }, reducedMotion: "reduce" });
      const P = await context.newPage();
      const warnings = [];
      P.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
      await P.goto(`${base}${route}`);
      await P.locator(".zf-next").waitFor({ timeout: 30000 });
      for (const content of styles) await P.addStyleTag({ content });
      return { context, P, warnings };
    };
    const look = (P) =>
      P.evaluate(() => ({
        next: getComputedStyle(document.querySelector(".zf-next")).backgroundColor,
        title: getComputedStyle(document.querySelector(".zf-page-title")).color,
        h1: getComputedStyle(document.querySelector("h1")).color,
        border: getComputedStyle(document.querySelector(".zf-input")).borderTopWidth,
      }));

    {
      const { context, P } = await open("/", byFile("src/brand.css"));
      check("styling: the brand's --zf-primary colours the buttons", (await look(P)).next === rgb("6b2fb3"), JSON.stringify(await look(P)));
      await context.close();
    }
    {
      const { context, P } = await open("/dark", byFile("src/brand.css"), byFile("src/brand-dark.css"));
      check("styling: under data-zf-theme=\"dark\", the page's dark value wins", (await look(P)).next === rgb("b48cf2"), JSON.stringify(await look(P)));
      await P.screenshot({ path: path.join(DIR, "styling-dark.png"), fullPage: true });
      await context.close();
    }
    {
      const { context, P } = await open("/dark", byFile("src/site.css"));
      const before = await look(P);
      check("styling: a page's h2 rule beats the form's heading colour in the dark theme", before.title === rgb("14181b"), JSON.stringify(before));
      await P.addStyleTag({ content: inheritFix });
      check("styling: fix 1, color: inherit, gives the heading the form's dark text colour", (await look(P)).title === rgb("E8EAEC"), JSON.stringify(await look(P)));
      await context.close();
    }
    {
      const { context, P } = await open("/dark", scopeFix);
      const after = await look(P);
      check("styling: fix 2 keeps the rule out of the form, and on the page's own h1", after.title === rgb("E8EAEC") && after.h1 === rgb("14181b"), JSON.stringify(after));
      await context.close();
    }

    // Tailwind 3's preflight, outside a layer and then as the page says.
    fs.writeFileSync(path.join(app, "src/index.css"), unlayered);
    {
      await new Promise((r) => setTimeout(r, 1500));
      const { context, P, warnings } = await open("/");
      await P.waitForTimeout(500);
      const reset = await look(P);
      check("styling: Tailwind 3's preflight outside a layer takes the fields' borders, and the form warns", reset.border === "0px" && warnings.some((w) => w.includes("this form's controls have no border")), `${JSON.stringify(reset)} ${warnings.join(" | ")}`);
      await context.close();
    }
    fs.writeFileSync(path.join(app, "src/index.css"), byFile("src/index.css"));
    {
      await new Promise((r) => setTimeout(r, 1500));
      const { context, P, warnings } = await open("/");
      await P.waitForTimeout(500);
      const layered = await look(P);
      const served = await (await fetch(`${base}/src/index.css`)).text();
      check("styling: with the page's @layer reset, Tailwind still runs and the fields keep their borders, with no warning", served.includes("@layer reset") && layered.border !== "0px" && !warnings.some((w) => w.includes("no border")), `${JSON.stringify(layered)} ${warnings.join(" | ")}`);
      await P.screenshot({ path: path.join(DIR, "styling-tailwind-layer.png"), fullPage: true });
      await context.close();
    }
  } finally {
    vite.child.kill();
  }
}

/** Is anything listening on the port? */
const listening = (port) =>
  new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1", () => (socket.destroy(), resolve(true)));
    socket.on("error", () => resolve(false));
  });

/**
 * "Build an intake page in Next.js", word for word, in a new Next.js app.
 * Next.js, React and TypeScript are linked from apps/web, so no network is
 * used, and the tarball is installed offline. Three changes, for this script
 * only: a tsconfig.json like a new app's; the app is built and started (next
 * build, next start) on a free port rather than run with npm run dev, whose
 * server is a second process this script wouldn't hold; and a copy of
 * app/intake at app/broken, with a form file the form refuses, to see
 * onRenderError. The app sits under OUT, not the system's temp folder:
 * Next.js finds its own files by a relative path, so it must be on the same
 * drive as the workspace.
 */
async function nextjs(browser) {
  const tmp = fs.mkdtempSync(path.join(OUT, "next-app-"));
  try {
    await nextjsIn(tmp, browser);
  } finally {
    await new Promise((r) => setTimeout(r, 1000));
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
}

async function nextjsIn(tmp, browser) {
  const page = fs.readFileSync(path.join(DOCS, "integrate/tutorial-nextjs.mdx"), "utf8");
  const files = fencesOf("integrate/tutorial-nextjs");
  const names = ["app/layout.tsx", "lib/session.ts", "app/intake/intake-form.tsx", "app/intake/page.tsx", "app/intake/thank-you/page.tsx", "lib/store.ts", "app/api/submit/route.ts"];
  const app = path.join(tmp, "intake-next");
  fs.mkdirSync(path.join(app, "node_modules/@types"), { recursive: true });
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "intake-next", private: true, scripts: { dev: "next dev", build: "next build", start: "next start" } }, null, 2));

  // Step 1, then the rest of the app linked from the workspace.
  run(`npm install --offline --legacy-peer-deps --no-audit --no-fund "${TARBALL}"`, app);
  for (const name of ["next", "react", "react-dom", "typescript", "@types/react", "@types/react-dom", "@types/node"]) {
    fs.symlinkSync(fs.realpathSync(path.join(WEB, "node_modules", name)), path.join(app, "node_modules", name), "junction");
  }
  const version = (name) => JSON.parse(fs.readFileSync(path.join(app, "node_modules", name, "package.json"), "utf8")).version;
  const tested = /tested with Next\.js (\d+\.\d+\.\d+)/.exec(page)?.[1];
  check(`nextjs: the page's tested version is the one used (${version("next")})`, tested === version("next"), `page says ${tested}`);
  fs.writeFileSync(
    path.join(app, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );

  // Steps 2 to 7, word for word.
  fs.mkdirSync(path.join(app, "app/intake"), { recursive: true });
  fs.copyFileSync(path.join(DOCS, "integrate/intake-form.form.json"), path.join(app, "app/intake/intake-form.json"));
  for (const name of names) {
    if (!files.has(name)) throw new Error(`the tutorial has no block for ${name}`);
    fs.mkdirSync(path.dirname(path.join(app, name)), { recursive: true });
    fs.writeFileSync(path.join(app, name), files.get(name));
  }
  const form = JSON.parse(fs.readFileSync(path.join(app, "app/intake/intake-form.json"), "utf8"));
  const build = () => {
    const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { cwd: app, encoding: "utf8", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, timeout: 300000 });
    return { ok: result.status === 0, log: `${result.stdout}\n${result.stderr}` };
  };

  // Step 5's note on the server, 1: a static page with a form file the form refuses fails the build.
  const copy = (route, change = (s) => s) => {
    fs.mkdirSync(path.join(app, "app", route));
    fs.copyFileSync(path.join(app, "app/intake/intake-form.tsx"), path.join(app, "app", route, "intake-form.tsx"));
    fs.writeFileSync(path.join(app, "app", route, "page.tsx"), change(fs.readFileSync(path.join(app, "app/intake/page.tsx"), "utf8")));
    fs.writeFileSync(path.join(app, "app", route, "intake-form.json"), JSON.stringify({ ...form, schemaVersion: 3 }, null, 2));
  };
  copy("broken");
  const refused = build();
  check(
    "nextjs: a static page whose form file is refused fails next build, which prints the reason",
    !refused.ok && refused.log.includes("Upgrade @zoworkhq/forms to render it.") && refused.log.includes("/broken"),
    refused.log.slice(-800),
  );

  // 2 and 3: the same page rendered for each request, and then with the form inside <Suspense>.
  const dynamic = (s) => `export const dynamic = 'force-dynamic';\n${s}`;
  fs.rmSync(path.join(app, "app/broken"), { recursive: true });
  copy("broken", dynamic);
  copy("broken-suspense", (s) => `import { Suspense } from 'react';\n${dynamic(s).replace("<IntakeForm userId={user.id} />", "<Suspense><IntakeForm userId={user.id} /></Suspense>")}`);
  const built = build();
  if (!built.ok) throw new Error(`next build failed: ${built.log.slice(-1500)}`);
  check("nextjs: next build compiles the tutorial's files, strict TypeScript included, and lists /intake as static", /○ \/intake\s/.test(built.log) && /ƒ \/broken\s/.test(built.log), built.log.slice(-1500));

  const port = await freePort();
  const server = start([path.join("node_modules/next/dist/bin/next"), "start", "-p", String(port)], app);
  const base = `http://localhost:${port}`;
  try {
    await waitForUrl(`${base}/intake`);
    const open = async (route) => {
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
      // React tells a devtools hook its version as it starts: the React that really runs.
      await context.addInitScript(() => {
        window.__reactVersions = [];
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          supportsFiber: true,
          renderers: new Map(),
          inject: (renderer) => (window.__reactVersions.push(renderer.version), 1),
          onCommitFiberRoot() {},
          onCommitFiberUnmount() {},
          onPostCommitFiberRoot() {},
          checkDCE() {},
        };
      });
      const P = await context.newPage();
      const problems = [];
      const posted = [];
      P.on("pageerror", (e) => problems.push(e.message));
      // Failed requests are listed by address below, not by the console's line for them.
      P.on("console", (m) => {
        if (m.text().startsWith("Failed to load resource")) return;
        if (m.type() === "error" || (m.type() === "warning" && m.text().includes("@zoworkhq/forms"))) problems.push(m.text());
      });
      // A new app has a favicon; this one, made by hand, doesn't.
      P.on("response", (r) => r.status() >= 400 && !r.url().endsWith("/favicon.ico") && problems.push(`${r.status()} ${r.url()}`));
      P.on("request", (r) => {
        if (r.url().endsWith("/api/submit")) posted.push(JSON.parse(r.postData()));
      });
      await P.goto(`${base}${route}`);
      return { context, P, problems, posted };
    };
    const fill = async (P) => {
      await P.getByLabel("Preferred name", { exact: true }).fill("Demo Client");
      await P.getByLabel("Email address", { exact: true }).fill("client@example.org");
      await P.getByRole("radio", { name: "Video" }).check();
      await P.getByRole("radio", { name: "No", exact: true }).check();
    };
    const tabKey = (scope) => `@zoworkhq/forms:${form.formId}:${form.formVersionId}:${sha256(scope)}`;

    {
      const { context, P, problems, posted } = await open("/intake");
      await P.locator(".zf-form").waitFor({ timeout: 30000 });
      check("nextjs: the server page shows the form's title as its h1, and its description", (await P.locator("h1").textContent()) === form.title && (await P.getByText(form.description).count()) === 1);
      const look = await P.evaluate(() => ({
        border: getComputedStyle(document.querySelector(".zf-input")).borderTopStyle,
        background: getComputedStyle(document.querySelector(".zf-submit")).backgroundColor,
      }));
      check("nextjs: the layout's stylesheet applies", look.border !== "none" && look.background !== "rgba(0, 0, 0, 0)", JSON.stringify(look));
      const running = await P.evaluate(() => window.__reactVersions);
      check(
        `nextjs: the page runs Next.js's own React 19.2 (${running.join(", ")}), with React ${version("react")} installed`,
        running.length > 0 && running.every((v) => v.startsWith("19.2.")) && version("react").startsWith("18.") && page.includes("its own copy of React, 19.2, whichever React your app installs"),
      );
      await P.screenshot({ path: path.join(DIR, "nextjs-form.png"), fullPage: true });

      // Check it works, 1.
      await P.getByRole("button", { name: "Submit" }).click();
      await P.locator(".zf-error-summary").waitFor();
      check('nextjs: Submit with nothing answered shows "There is a problem", and sends nothing', ((await P.locator(".zf-error-summary").textContent()) || "").includes("There is a problem") && posted.length === 0);

      // Check it works, 2, and the scope.
      await fill(P);
      await P.reload();
      await P.locator(".zf-form").waitFor();
      check("nextjs: a refresh keeps the answers", (await P.getByLabel("Preferred name", { exact: true }).inputValue()) === "Demo Client");
      const keys = await P.evaluate(() => Object.keys(sessionStorage));
      check("nextjs: the tab's copy is keyed by the signed-in user's scope", keys.includes(tabKey("user-demo-1")), keys.join(", "));

      // Check it works, 3.
      await P.getByRole("button", { name: "Submit" }).click();
      await P.waitForURL(`${base}/intake/thank-you`);
      check("nextjs: after the submit, onSuccess moves to the thank-you page", (await P.locator("h1").textContent()) === "Thank you");
      const [body] = posted;
      await new Promise((r) => setTimeout(r, 300));
      check("nextjs: the form posts once, and the terminal prints Stored and the key", posted.length === 1 && server.log.includes(`Stored ${body?.idempotencyKey}`), server.log);
      check("nextjs: no errors in the browser, hydration included", problems.length === 0, problems.join(" | "));
      await context.close();
    }

    // A different user in the same tab never gets the copy: the same copy, under another user's scope, isn't restored.
    {
      const { context, P } = await open("/intake");
      await P.locator(".zf-form").waitFor();
      await fill(P);
      await P.waitForFunction((key) => sessionStorage.getItem(key) !== null, tabKey("user-demo-1"));
      await P.evaluate(([mine, theirs]) => {
        sessionStorage.setItem(theirs, sessionStorage.getItem(mine));
        sessionStorage.removeItem(mine);
      }, [tabKey("user-demo-1"), tabKey("user-demo-2")]);
      await P.reload();
      await P.locator(".zf-form").waitFor();
      check("nextjs: another user's copy in the same tab isn't restored", (await P.getByLabel("Preferred name", { exact: true }).inputValue()) === "");
      await context.close();
    }

    // "Stores a retried submission once": the first response is lost on its way back.
    {
      const { context, P, posted } = await open("/intake");
      await P.locator(".zf-form").waitFor();
      await fill(P);
      await P.route("**/api/submit", async (route) => {
        await route.fetch();
        await route.abort();
      });
      await P.getByRole("button", { name: "Submit" }).click();
      await P.getByText("Submission failed. Your answers have been kept — please try again.").waitFor();
      await P.unroute("**/api/submit");
      await P.getByRole("button", { name: "Submit" }).click();
      await P.waitForURL(`${base}/intake/thank-you`);
      await new Promise((r) => setTimeout(r, 300));
      const [first, second] = posted;
      const times = server.log.split(first?.idempotencyKey ?? "?").length - 1;
      check("nextjs: a retry carries the same key, and is stored once", posted.length === 2 && first.idempotencyKey === second.idempotencyKey && times === 1, `${times} times`);
      await context.close();
    }

    // onRenderError, on the same page and component with a form file the form refuses, rendered for each request.
    for (const [route, status, withPage] of [
      ["/broken", 500, false],
      ["/broken-suspense", 200, true],
    ]) {
      const response = await fetch(`${base}${route}`);
      const html = await response.text();
      check(`nextjs: ${route} answers ${status}, ${withPage ? "with" : "without"} the page`, response.status === status && html.includes(`<h1>${form.title}</h1>`) === withPage, `${response.status}`);
      const { context, P, problems } = await open(route);
      await P.getByText("This form can't be shown right now. Please try again later.").waitFor({ timeout: 30000 });
      check(
        `nextjs: in the browser, ${route} shows the page and the form's message, and onRenderError logs the reason`,
        (await P.locator("h1").textContent()) === form.title && problems.some((p) => p.includes("The intake form could not be shown") && p.includes("schemaVersion 3")),
        problems.join(" | "),
      );
      await context.close();
    }
    check("nextjs: the server logged the reason", server.log.includes("Upgrade @zoworkhq/forms to render it."));
  } finally {
    server.child.kill();
  }
  await new Promise((r) => setTimeout(r, 1000));
  check("nextjs: stopping next start's one process frees its port", !(await listening(port)));
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zowork-dev-docs-"));
  let browser;
  try {
    browser = await launchBrowser();
    const app = await quickstart(tmp, browser);
    await drafts(app, browser);
    await styling(app, browser);
    await nextjs(browser);
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
