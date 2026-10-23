import fs from "node:fs";
import path from "node:path";

/*
 * The installed @zoworkhq/forms (vendor/zoworkhq-forms-<version>.tgz), read on
 * the server at build time. Neither file is in the package's `exports`, so they
 * are read from disk rather than imported.
 */

const PACKAGE_DIR = path.join(process.cwd(), "node_modules", "@zoworkhq", "forms");

/** The installed version, e.g. "0.26.0": the top bar and every "Applies to". */
export function rendererVersion(): string {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8")).version;
}

/** The package's default stylesheet, for the live examples' shadow roots. */
export function rendererStyles(): string {
  return fs.readFileSync(path.join(PACKAGE_DIR, "dist", "styles.css"), "utf8");
}
