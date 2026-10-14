import { describeBlockPath, gridColumnName } from "@formbuilder/form-schema";

type RawBlock = { type?: unknown; label?: unknown; title?: unknown; blocks?: RawBlock[]; columns?: unknown };

/**
 * Turn the first schema validation issue into a message a person can act on,
 * naming the innermost block it's in by its path — inside a page or group, the
 * question, not the container — the same way the save rules name blocks.
 * Follows the issue's own path (blocks.2.blocks.0…) down the raw input, so it
 * visits one chain of blocks, not the whole tree.
 */
export function describeSchemaError(
  raw: unknown,
  error: { issues: { path: (string | number)[]; message: string; code?: string }[] },
): string {
  const issue = error.issues[0];
  let list = (raw as { blocks?: RawBlock[] } | null)?.blocks;
  const chain: RawBlock[] = [];
  const indices: number[] = [];
  let consumed = 0;
  while (
    issue.path[consumed] === "blocks" &&
    typeof issue.path[consumed + 1] === "number" &&
    Array.isArray(list)
  ) {
    const index = issue.path[consumed + 1] as number;
    const block: RawBlock = list[index] ?? {};
    chain.push(block);
    indices.push(index);
    list = block.blocks;
    consumed += 2;
  }
  if (consumed === 0) {
    return `Invalid form schema${issue.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue.message}`;
  }
  const block = chain[chain.length - 1];
  // A matrix's `options` are its rows (contract §13.1); name them as the author sees them.
  const rest = issue.path.slice(consumed).map((step, k) =>
    k === 0 && step === "options" && block?.type === "matrix" ? "rows" : step,
  );
  const subject = describeBlockPath(chain, indices);
  // Inside a grid column, name the column as the save rules do (contract §14.4). An
  // unknown type, or a column that isn't an object, reads straight after its name.
  if (block?.type === "grid" && rest[0] === "columns" && typeof rest[1] === "number") {
    const column = Array.isArray(block.columns) ? (block.columns[rest[1]] as { label?: unknown } | null) : null;
    const name = gridColumnName(typeof column === "object" && column !== null ? column : {}, rest[1]);
    const inner = rest.slice(2);
    if (issue.code === "invalid_union_discriminator" || inner.length === 0) return `${subject}: ${name} ${issue.message}`;
    return `${subject}: ${name} (${inner.join(".")}): ${issue.message}`;
  }
  const where = rest.length ? ` (${rest.join(".")})` : "";
  return `${subject}${where}: ${issue.message}`;
}
