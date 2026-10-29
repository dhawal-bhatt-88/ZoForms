import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { describe, expect, it } from "vitest";
import { buildArtifact } from "@formbuilder/form-schema";
import { RendererCore, rendererCoreFile, type MountChecks } from "./renderer-core";

const manifest = (app: string) => JSON.parse(readFileSync(join(__dirname, "../../..", app, "package.json"), "utf8"));
const IDS = { formId: "00000000-0000-4000-8000-000000000001", formVersionId: "00000000-0000-4000-8000-000000000002" };

describe("the API's renderer is the web app's", () => {
  it("both install @zoworkhq/forms from the same vendored tarball", () => {
    const api = manifest("api").dependencies["@zoworkhq/forms"];
    expect(api).toMatch(/^file:\.\.\/\.\.\/vendor\/zoworkhq-forms-\d+\.\d+\.\d+\.tgz$/);
    expect(api).toBe(manifest("web").dependencies["@zoworkhq/forms"]);
  });

  it("the installed /core is that version", () => {
    const pkg = JSON.parse(readFileSync(join(rendererCoreFile(), "../../../package.json"), "utf8"));
    expect(`file:../../vendor/zoworkhq-forms-${pkg.version}.tgz`).toBe(manifest("api").dependencies["@zoworkhq/forms"]);
  });
});

describe("RendererCore", () => {
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
