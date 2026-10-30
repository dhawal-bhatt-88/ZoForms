import { Injectable, OnModuleInit } from "@nestjs/common";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { pathToFileURL } from "url";
import type * as Core from "@zoworkhq/forms/core";

/** What the renderer runs on a form file before it shows it. */
type MountChecks = Pick<typeof Core, "assertSchemaIntegrity" | "resolveNavigation" | "resolveDrafts">;

/**
 * Where `@zoworkhq/forms/core` is installed for this package: the same tarball
 * as the web app's (vendor/, checked by renderer-version.test.ts). Found by
 * Node's own lookup paths, so it doesn't depend on the working directory.
 */
export function rendererCoreFile(): string {
  for (const dir of require.resolve.paths("@zoworkhq/forms") ?? []) {
    const manifest = join(dir, "@zoworkhq", "forms", "package.json");
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { exports: { "./core": { import: { default: string } } } };
      return join(dirname(manifest), pkg.exports["./core"].import.default);
    }
  }
  throw new Error("@zoworkhq/forms isn't installed for the API.");
}

// /core has an ES module entry and a CommonJS one, and rendererCoreFile() names
// the ES module. The API compiles to CommonJS, where TypeScript would turn
// import() into require(), which can't load that file: so a real import().
const nativeImport = new Function("url", "return import(url)") as (url: string) => Promise<unknown>;

export type { MountChecks };

export async function loadRendererCore(): Promise<MountChecks> {
  return (await nativeImport(pathToFileURL(rendererCoreFile()).href)) as MountChecks;
}

/**
 * The renderer's own checks, run on a built form file before Download hands it
 * out: the ones `@zoworkhq/forms/react` runs as it mounts the form. Loaded once
 * at start-up; the API doesn't start without them.
 */
@Injectable()
export class RendererCore implements OnModuleInit {
  private checks?: MountChecks;

  /** `load` is for tests, whose runner has its own import(); Nest calls this with none. */
  async onModuleInit(load: () => Promise<MountChecks> = loadRendererCore) {
    this.checks = await load();
  }

  /** Why the renderer would refuse this file (its first line), or null if it would show it. */
  mountProblem(artifact: unknown): string | null {
    if (!this.checks) throw new Error("The renderer's checks aren't loaded.");
    try {
      const schema = artifact as Core.FormSchema;
      this.checks.assertSchemaIntegrity(schema);
      this.checks.resolveNavigation(schema);
      this.checks.resolveDrafts(schema);
      return null;
    } catch (e) {
      return String((e as Error)?.message ?? e).split("\n")[0];
    }
  }
}
