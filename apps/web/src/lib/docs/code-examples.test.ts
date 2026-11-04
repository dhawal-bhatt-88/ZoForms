import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import { beforeAll, describe, expect, it } from "vitest";
import { prepareSubmission, type FormSchema } from "@zoworkhq/forms/core";
import { classNames } from "@zoworkhq/forms/react";
import { compileExamples, examplesOf, fenceProblem, FORM_FILES, isDeveloperPage, pageFolder, writeProject, type CodeExample } from "./code-examples";
import { getLivePages } from "./content";

/*
 * Every code example on the developer pages (docs brief, "Every code example
 * is tested"): extracted, compiled against the installed package in each
 * module system, and run. `prebuild` runs this file, so a page whose code
 * doesn't compile fails the build. code-examples-render.test.tsx renders the
 * browser examples; e2e/verify-dev-docs-apps.js follows the quickstart in a
 * real app.
 */

const pages = getLivePages().filter((p) => isDeveloperPage(p.slug));
const examples = pages.flatMap(examplesOf);

/** Commands a page may tell a reader to run. Each is one the real-app check runs too, or is its plain form. */
const COMMANDS = new Set([
  "npm create vite@latest intake-app -- --template react",
  "cd intake-app",
  "npm install",
  "npm install @zoworkhq/forms",
  "npm install express@4",
  "node server.js",
  "npm run dev",
]);

/** The real downloads the pages' code loads, by the form= word. */
const FORMS: Record<string, { file: string; required: string; answers: Record<string, unknown> }> = {
  intake: {
    file: FORM_FILES["intake-form.json"],
    required: "preferred_name",
    answers: {
      preferred_name: { state: "answered", value: "Demo Client" },
      contact_email: { state: "answered", value: "client@example.org" },
      attend_format: { state: "answered", value: "video" },
      sees_therapist: { state: "answered", value: "no" },
      reason_for_visit: { state: "empty" },
    },
  },
  "intake-server": {
    file: FORM_FILES["intake-server.json"],
    required: "preferred_name",
    answers: {
      preferred_name: { state: "answered", value: "Demo Client" },
      contact_email: { state: "answered", value: "client@example.org" },
      attend_format: { state: "answered", value: "video" },
      sees_therapist: { state: "answered", value: "no" },
      reason_for_visit: { state: "empty" },
    },
  },
  "visit-feedback": {
    file: FORM_FILES["visit-feedback.json"],
    required: "booking_ease",
    answers: {
      booking_ease: { state: "answered", value: 4 },
      waiting_time: { state: "answered", value: 3 },
      session_rating: { state: "answered", value: 5 },
    },
  },
};

const formOf = (example: CodeExample) => FORMS[example.words.form ?? "intake"];
const readForm = (form = FORMS.intake) => JSON.parse(fs.readFileSync(form.file, "utf8")) as FormSchema;

/** A body as the browser posts it: the demo ids the pages show, on the real form. */
function validBody(form = FORMS.intake, key = "demo-key-1") {
  return {
    idempotencyKey: key,
    schemaVersion: 2,
    formId: "form-demo-1",
    formVersionId: "version-demo-3",
    submittedAt: "2026-10-30T09:15:00.000Z",
    answers: form.answers,
    derived: {},
  };
}

beforeAll(() => {
  for (const page of pages) writeProject(page.slug, examplesOf(page));
});

/** A fence of the self-test below. */
const broken = (check: CodeExample["check"], lang: string, code: string, file: string): CodeExample => ({
  page: "integrate/_self-test",
  line: 1,
  lang,
  code,
  words: {},
  check,
  file,
});

describe("the compile check itself", () => {
  // Passing means nothing unless a wrong example fails, in each kind of block.
  it.each([
    ["a missing argument, in ES modules", broken("esm", "js", "import { prepareSubmission } from '@zoworkhq/forms/core';\nprepareSubmission();", "a.js")],
    ["an export that doesn't exist, in CommonJS", broken("cjs", "js", "const { nope } = require('@zoworkhq/forms/core');\nconsole.log(nope);", "b.cjs")],
    ["a validator's value used without checking it, once typed", broken("esm", "js", "/** @type {import('@zoworkhq/forms/core').FieldValidator[]} */\nexport const v = [{ field: 'a', validate: ({ value }) => value.length }];", "c.js")],
    ["a strict TypeScript error", broken("esm", "ts", "import { prepareSubmission } from '@zoworkhq/forms/core';\nconst r = prepareSubmission({} as never, {});\nexport const s: string = r.ok;", "d.ts")],
    ["a prop that doesn't exist", broken("fragment", "jsx", '<FormRenderer schema={schema} endpoints="/x" />', "e.tsx")],
    ["a name outside the prelude", broken("fragment", "jsx", "<FormRenderer schema={schema} endpoint={missing} />", "f.tsx")],
    ["a bare import of the package", broken("browser", "jsx", "import x from '@zoworkhq/forms';\nexport default x;", "g.jsx")],
    ["a form file without its cast, in TypeScript", broken("browser", "tsx", "import { FormRenderer } from '@zoworkhq/forms/react';\nimport schema from './intake-form.json';\nexport const A = () => <FormRenderer schema={schema} endpoint=\"/x\" />;", "h.tsx")],
  ])("fails on %s", { timeout: 60_000 }, (_, example) => {
    writeProject(example.page, [example]);
    expect(compileExamples([example]).errors).not.toEqual([]);
  });

  it("accepts, without a cast, a form file with no condition, page, drafts mode or progress style", { timeout: 60_000 }, () => {
    // The cast rule the pages give (renderer 0.28.1): visit-feedback has questions, a group and scores only.
    const example = broken("browser", "tsx", "import { FormRenderer } from '@zoworkhq/forms/react';\nimport schema from './visit-feedback.json';\nexport const A = () => <FormRenderer schema={schema} endpoint=\"/x\" />;", "src/FeedbackNoCast.tsx");
    writeProject(example.page, [example]);
    expect(compileExamples([example]).errors).toEqual([]);
  });

  it("accepts the same form file with its cast", { timeout: 60_000 }, () => {
    const example = broken("browser", "tsx", "import { FormRenderer } from '@zoworkhq/forms/react';\nimport type { FormSchema } from '@zoworkhq/forms/core';\nimport data from './intake-form.json';\nexport const A = () => <FormRenderer schema={data as FormSchema} endpoint=\"/x\" />;", "src/IntakeCast.tsx");
    writeProject(example.page, [example]);
    expect(compileExamples([example]).errors).toEqual([]);
  });
});

describe("the developer pages' code", () => {
  it("finds fences on every developer page that has code", () => {
    expect(examples.length).toBeGreaterThan(20);
    expect(new Set(examples.map((e) => e.page))).toContain("integrate/quickstart");
  });

  it("says how each JavaScript and TypeScript fence is checked", () => {
    const problems = examples.flatMap((e) => {
      const problem = fenceProblem(e);
      return problem ? [`${e.page}.mdx, the fence at line ${e.line} ${problem}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it("compiles against the installed package, in every module system used", { timeout: 120_000 }, () => {
    const { programs, errors } = compileExamples(examples);
    expect(errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
    expect(programs).toEqual(["Node, JavaScript", "Node, strict TypeScript", "bundler, JavaScript", "bundler, strict TypeScript"]);
  });

  it("imports only the package's three entry points", () => {
    const imported = examples.flatMap((e) => [...e.code.matchAll(/(?:from|import|require\()\s*['"](@zoworkhq\/forms[^'"]*)['"]/g)].map((m) => m[1]));
    expect(new Set(imported)).toEqual(new Set(["@zoworkhq/forms/react", "@zoworkhq/forms/core", "@zoworkhq/forms/styles.css"]));
  });

  it("tells readers to run only known commands", () => {
    const lines = examples.filter((e) => e.lang === "sh").flatMap((e) => e.code.split("\n"));
    expect(lines.filter((line) => !COMMANDS.has(line))).toEqual([]);
  });

  it("has JSON that parses, and bodies prepareSubmission accepts", () => {
    for (const example of examples.filter((e) => e.lang === "json")) {
      const parsed = JSON.parse(example.code) as { formId?: string; formVersionId?: string };
      if (example.check !== "body") continue;
      const result = prepareSubmission(readForm(formOf(example)), parsed);
      expect(result, `${example.page}.mdx, line ${example.line}`).toMatchObject({ ok: true });
    }
  });

  it("shows stored submissions exactly as prepareSubmission returns them", () => {
    for (const stored of examples.filter((e) => e.check === "stored")) {
      const body = examples.find((e) => e.page === stored.page && e.words.name === stored.words.of);
      expect(body, `${stored.page}.mdx, line ${stored.line}: no body named "${stored.words.of}"`).toBeDefined();
      const sent = JSON.parse(body!.code) as { formId: string; formVersionId: string };
      // The pages show demo ids; the real file has the builder's.
      const form = { ...readForm(formOf(body!)), formId: sent.formId, formVersionId: sent.formVersionId };
      const result = prepareSubmission(form, sent) as { submission: unknown };
      expect(JSON.parse(stored.code), `${stored.page}.mdx, line ${stored.line}`).toEqual(result.submission);
    }
  });

  it("names only real classes and custom properties in CSS", () => {
    const known = new Set<string>(Object.values(classNames));
    const css = fs.readFileSync(path.join(process.cwd(), "node_modules", "@zoworkhq", "forms", "dist", "styles.css"), "utf8");
    for (const example of examples.filter((e) => e.lang === "css")) {
      postcss.parse(example.code);
      for (const [, name] of example.code.matchAll(/\.(zf-[a-z0-9-]+)/g)) expect(known, example.page).toContain(name);
      for (const [name] of example.code.matchAll(/--zf-[a-z0-9-]+/g)) expect(css, example.page).toContain(name);
    }
  });
});

/** Stands in for the reader's storage while a server runs, and writes down what it is given. */
const storeStub = (file: string) => {
  const body = `const seen = new Set();
async function alreadyStored(key) { return seen.has(key); }
async function store(submission) {
  seen.add(submission.idempotencyKey);
  fs.appendFileSync(process.env.DOCS_STORE_FILE, JSON.stringify(submission) + '\\n');
}
`;
  return file.endsWith(".cjs")
    ? `const fs = require('node:fs');\n${body}module.exports = { alreadyStored, store };\n`
    : `import fs from 'node:fs';\n${body}export { alreadyStored, store };\n`;
};

type Post = (body: unknown, headers?: Record<string, string>) => Promise<{ status: number; json: () => Promise<unknown> }>;

/**
 * What every runnable endpoint must do, whatever it runs in: store a real
 * submission once, answer a retry with a 2xx, and refuse a bad body, plus
 * what its words ask for.
 */
async function endpointScenario(example: CodeExample, send: Post, storedFile: string) {
  const form = formOf(example);
  const auth: Record<string, string> = example.words.auth ? { Authorization: `Bearer ${example.words.auth}` } : {};
  const post: Post = (body, headers = {}) => send(body, { ...auth, ...headers });
  const stored = () => (fs.existsSync(storedFile) ? fs.readFileSync(storedFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);

  if (example.words.auth) expect((await send(validBody(form, "demo-key-0"), {})).status, "no sign-in").toBe(401);

  const body = validBody(form);
  expect((await post(body)).status).toBe(200);
  // A retry that reached the server the first time: answered, and not stored again.
  expect((await post(body)).status).toBe(200);
  // A page may store more beside the submission, such as its own receipt time, but the submission is whole.
  const expected = (prepareSubmission(readForm(form), body) as unknown as { submission: Record<string, unknown> }).submission;
  expect(stored().map((record) => Object.fromEntries(Object.keys(expected).map((k) => [k, record[k]])))).toEqual([expected]);

  const { [form.required]: _, ...missing } = body.answers;
  const refused = await post({ ...body, idempotencyKey: "demo-key-2", answers: missing });
  expect(refused.status).toBe(422);
  expect(((await refused.json()) as { errors: { blockId: string }[] }).errors.map((e) => e.blockId)).toEqual([form.required]);

  expect((await post({ answers: "nothing" })).status).toBe(422);

  if (example.words.rejects) {
    const long = { ...body, idempotencyKey: "demo-key-3", answers: { ...body.answers, [example.words.rejects]: { state: "answered", value: "x".repeat(60) } } };
    const response = await post(long);
    expect(response.status).toBe(422);
    expect(((await response.json()) as { errors: { blockId: string }[] }).errors.map((e) => e.blockId)).toEqual([example.words.rejects]);
  }
  if (example.words.limit) {
    const big = { ...body, idempotencyKey: "demo-key-4", padding: "x".repeat(2 * 1024 * 1024) };
    expect((await post(big)).status).toBe(413);
  }
  expect(stored()).toHaveLength(1);
}

/**
 * What a server keeping server-mode drafts must do (the "Save progress" guide):
 * give back the draft it was given for that scope and form, nothing for
 * another scope, nothing once deleted, and refuse a body without a scope.
 */
async function draftsScenario(example: CodeExample, base: string) {
  const call = async (action: string, body: unknown) => {
    const response = await fetch(`${base}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: response.headers.get("content-type")?.includes("json") ? ((await response.json()) as unknown) : null };
  };
  const form = readForm(formOf(example));
  const ref = { scope: "user-demo-1:client-demo-1", formId: form.formId };
  const draft = {
    formId: form.formId,
    formVersionId: form.formVersionId,
    schemaVersion: 2,
    answers: { preferred_name: { state: "answered", value: "Demo Client" }, therapist_name: { state: "answered", value: "Dr. Demo" } },
    idempotencyKey: "demo-key-5",
    currentPageId: "page_visit",
    visitedPageIds: ["page_about", "page_visit"],
    onReview: false,
    savedAt: "2026-11-03T09:15:00.000Z",
  };
  expect(await call("load", ref)).toEqual({ status: 200, body: { draft: null } });
  expect((await call("save", { scope: ref.scope, draft })).status).toBeLessThan(300);
  expect(await call("load", ref)).toEqual({ status: 200, body: { draft } });
  expect(await call("load", { ...ref, scope: "user-demo-2:client-demo-1" })).toEqual({ status: 200, body: { draft: null } });
  expect((await call("delete", ref)).status).toBeLessThan(300);
  expect(await call("load", ref)).toEqual({ status: 200, body: { draft: null } });
  expect((await call("load", { formId: form.formId })).status).toBe(400);
  expect((await call("save", { draft })).status).toBe(400);
}

/** Loaded before a server: any port it asks for becomes a free one, written to a file. */
const LISTEN_ANYWHERE = `import fs from 'node:fs';
import http from 'node:http';
const { listen } = http.Server.prototype;
http.Server.prototype.listen = function (...args) {
  const done = args.find((a) => typeof a === 'function');
  return listen.call(this, 0, '127.0.0.1', () => {
    fs.writeFileSync(process.env.DOCS_PORT_FILE, String(this.address().port));
    done?.();
  });
};
`;

async function waitFor<T>(read: () => T | undefined, what: string, ms = 20_000): Promise<T> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

describe("the runnable examples", () => {
  const servers = examples.filter((e) => e.run === "server");
  const handlers = examples.filter((e) => e.run === "handler");
  const scripts = examples.filter((e) => e.run === "node");

  it("includes a server and a CommonJS script", () => {
    expect(servers.length).toBeGreaterThan(0);
    expect(servers.some((e) => e.words.drafts)).toBe(true);
    expect(scripts.some((e) => e.check === "cjs")).toBe(true);
  });

  it.each(scripts.map((e) => [`${e.page}, ${e.file}`, e] as const))("%s runs in Node", { timeout: 30_000 }, async (_, example) => {
    const dir = pageFolder(example.page);
    const code = await new Promise<number | null>((resolve) => {
      spawn(process.execPath, [example.file], { cwd: dir, stdio: "ignore" }).on("exit", resolve);
    });
    expect(code).toBe(0);
  });

  it.each(servers.map((e) => [`${e.page}, ${e.file}`, e] as const))("%s stores a real submission once and rejects a bad one", { timeout: 60_000 }, async (_, example: CodeExample) => {
    const dir = pageFolder(example.page);
    for (const stub of examples.filter((e) => e.page === example.page && e.words.stub === "store")) fs.writeFileSync(path.join(dir, stub.file), storeStub(stub.file));
    const preload = path.join(dir, "_listen-anywhere.mjs");
    const portFile = path.join(dir, "_port");
    const storeFile = path.join(dir, "_stored.jsonl");
    fs.rmSync(portFile, { force: true });
    fs.rmSync(storeFile, { force: true });
    fs.writeFileSync(preload, LISTEN_ANYWHERE);

    let logged = "";
    const server = spawn(process.execPath, ["--import", pathToFileURL(preload).href, example.file], {
      cwd: dir,
      env: { ...process.env, DOCS_PORT_FILE: portFile, DOCS_STORE_FILE: storeFile },
    });
    server.stdout.on("data", (d) => (logged += d));
    server.stderr.on("data", (d) => (logged += d));
    try {
      const port = await waitFor(() => (fs.existsSync(portFile) ? fs.readFileSync(portFile, "utf8") || undefined : undefined), `${example.file} to listen. ${logged}`);
      const url = `http://127.0.0.1:${port}${example.words.route}`;
      await endpointScenario(
        example,
        (body, headers = {}) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }),
        storeFile,
      );
      if (example.words.drafts) await draftsScenario(example, `http://127.0.0.1:${port}${example.words.drafts}`);
    } catch (error) {
      throw new Error(`${(error as Error).message}\n\nThe server said:\n${logged}`);
    } finally {
      server.kill();
    }
  });

  it.each(handlers.map((e) => [`${e.page}, ${e.file}`, e] as const))("%s stores a real submission once and rejects a bad one", { timeout: 60_000 }, async (_, example: CodeExample) => {
    const dir = pageFolder(example.page);
    for (const stub of examples.filter((e) => e.page === example.page && e.words.stub === "store")) fs.writeFileSync(path.join(dir, stub.file), storeStub(stub.file));
    const storeFile = path.join(dir, "_stored-handler.jsonl");
    fs.rmSync(storeFile, { force: true });
    process.env.DOCS_STORE_FILE = storeFile;
    const { POST } = (await import(/* @vite-ignore */ path.join(dir, example.file))) as { POST: (request: Request) => Promise<Response> };
    await endpointScenario(
      example,
      (body, headers = {}) =>
        POST(new Request(`http://localhost${example.words.route}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) })),
      storeFile,
    );
  });
});
