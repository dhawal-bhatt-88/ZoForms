/**
 * Docs pages the builder's own screens link to. Kept in one place so a test
 * (docs-links.test.ts) can hold each to a live page, and finds any other
 * /docs/ path written into the editor directly.
 */
export const DOCS_LINKS = {
  /** The editor's Save progress setting, "On the app's server". */
  drafts: "/docs/integrate/drafts",
} as const;
