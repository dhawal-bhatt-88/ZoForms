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
