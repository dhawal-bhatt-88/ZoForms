import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { buildArtifact, REPEAT_DEFAULT_MAX } from "@formbuilder/form-schema";
import { RendererCore, rendererCoreFile, type MountChecks } from "./renderer-core";

const manifest = (app: string) => JSON.parse(readFileSync(join(__dirname, "../../..", app, "package.json"), "utf8"));
const IDS = { formId: "00000000-0000-4000-8000-000000000001", formVersionId: "00000000-0000-4000-8000-000000000002" };

describe("the API's renderer is the web app's", () => {
  it("both install @zoworkhq/zoforms from the same vendored tarball", () => {
    const api = manifest("api").dependencies["@zoworkhq/zoforms"];
    expect(api).toMatch(/^file:\.\.\/\.\.\/vendor\/zoworkhq-zoforms-\d+\.\d+\.\d+\.tgz$/);
    expect(api).toBe(manifest("web").dependencies["@zoworkhq/zoforms"]);
  });

  it("the installed /core is that version", () => {
    const pkg = JSON.parse(readFileSync(join(rendererCoreFile(), "../../../package.json"), "utf8"));
    expect(`file:../../vendor/zoworkhq-zoforms-${pkg.version}.tgz`).toBe(manifest("api").dependencies["@zoworkhq/zoforms"]);
  });

  it("the save rules use the renderer's default maximum number of entries", async () => {
    const core = (await import(pathToFileURL(rendererCoreFile()).href)) as { DEFAULT_MAX_OCCURS: number };
    expect(REPEAT_DEFAULT_MAX).toBe(core.DEFAULT_MAX_OCCURS);
  });
});

describe("RendererCore", () => {
  // The API starts on this: without /core it doesn't start. The runner can't do the real
  // import() (see below), so this compiles the file to CommonJS, as `nest build` does, and
  // starts it in plain Node, in the API's node_modules so the lookup finds the installed package.
  it("loads /core from the installed package as the built API does at start-up", () => {
    const dir = mkdtempSync(join(__dirname, "../../node_modules/.renderer-core-"));
    try {
      const source = readFileSync(join(__dirname, "renderer-core.ts"), "utf8");
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true, esModuleInterop: true },
      });
      writeFileSync(join(dir, "renderer-core.js"), outputText);
      const start = join(dir, "start.js");
      writeFileSync(
        start,
        `const { RendererCore } = require("./renderer-core.js");
        const core = new RendererCore();
        core.onModuleInit().then(() => console.log(JSON.stringify(core.mountProblem(JSON.parse(process.argv[2])))));`,
      );
      const good = buildArtifact({ title: "T", blocks: [{ id: "a", type: "short", label: "A", required: false }] }, IDS);
      expect(execFileSync(process.execPath, [start, JSON.stringify(good)], { encoding: "utf8" }).trim()).toBe("null");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes a file the renderer shows, and names why it would refuse one", async () => {
    const core = new RendererCore();
    // The same file the API loads, through the test runner's own import().
    await core.onModuleInit(() => import(pathToFileURL(rendererCoreFile()).href) as Promise<MountChecks>);
    const good = buildArtifact({ title: "T", blocks: [{ id: "a", type: "short", label: "A", required: false }] }, IDS);
    expect(core.mountProblem(good)).toBeNull();
    const twice = { ...good, blocks: [good.blocks[0], good.blocks[0]] };
    expect(core.mountProblem(twice)).toMatch(/a/);
    expect(core.mountProblem(twice)).not.toContain("\n");
  });
});
