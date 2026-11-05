import fs from "node:fs";
import path from "node:path";
import { readJson } from "./content";

/*
 * The installed @zoworkhq/zoforms (vendor/zoworkhq-zoforms-<version>.tgz), read on
 * the server at build time. Neither file is in the package's `exports`, so they
 * are read from disk rather than imported.
 */

const PACKAGE_DIR = path.join(process.cwd(), "node_modules", "@zoworkhq", "zoforms");

/** The installed version, e.g. "0.29.0": shown in the docs' top bar. */
export function rendererVersion(): string {
  return (readJson(path.join(PACKAGE_DIR, "package.json")) as { version: string }).version;
}

/** The package's default stylesheet, for the live examples' shadow roots. */
export function rendererStyles(): string {
  return fs.readFileSync(path.join(PACKAGE_DIR, "dist", "styles.css"), "utf8");
}
