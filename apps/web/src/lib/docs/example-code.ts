type Node = { id?: unknown; blocks?: Node[] } & Record<string, unknown>;

/**
 * One field of one block in a form file, as JSON: `"enableWhen": [ … ]`. For
 * quoting a form file on a page without copying it by hand. Throws when the
 * block or field isn't there, so a regenerated file can't leave a page quoting
 * something that is gone.
 */
export function formExcerpt(schema: Record<string, unknown>, blockId: string, field: string): string {
  const find = (blocks: Node[]): Node | undefined => {
    for (const b of blocks) {
      if (b.id === blockId) return b;
      const inner = b.blocks && find(b.blocks);
      if (inner) return inner;
    }
  };
  const block = find((schema.blocks as Node[]) ?? []);
  if (!block) throw new Error(`The form file has no block "${blockId}"`);
  if (!(field in block)) throw new Error(`Block "${blockId}" has no "${field}"`);
  return `${JSON.stringify(field)}: ${JSON.stringify(block[field], null, 2)}`;
}

/**
 * The "React code" tab: what a host writes to render this example. The docs
 * page itself adds two things a host doesn't need, a shadow root that keeps
 * the builder's own CSS off the form and a stand-in endpoint, so the tab says
 * so rather than showing them.
 */
export function exampleReactCode(name: string): string {
  const component = name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());
  return [
    "import { FormRenderer } from '@zoworkhq/forms/react';",
    "import '@zoworkhq/forms/styles.css';",
    `import schema from './${name}.json';`,
    "",
    `export function ${component}() {`,
    "  return <FormRenderer schema={schema} endpoint=\"/api/submissions\" />;",
    "}",
    "",
  ].join("\n");
}
