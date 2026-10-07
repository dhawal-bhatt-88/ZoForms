/*
 * Test-only helpers for coded options (contract §13). Excluded from the build
 * (tsconfig), never imported by index.ts.
 *
 * code() is a simplified form of the real rule (generateCode, contract §13.3):
 * lower case, whitespace runs to "_", anything outside a–z, 0–9, ".", "-", "_"
 * dropped. Enough for readable fixtures, and independent of the code under
 * test. The renderer's test helper is the same.
 */
import type { Option } from "../index";

export function code(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "");
}

/** opts("Yes", "Not sure") → [{ code: "yes", label: "Yes" }, { code: "not_sure", label: "Not sure" }] */
export function opts(...labels: string[]): Option[] {
  return labels.map((label) => ({ code: code(label), label }));
}
