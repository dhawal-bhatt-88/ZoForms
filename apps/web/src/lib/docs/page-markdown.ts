import { readCss, readExampleForm, readReference, readTypes, type DocsPage } from "./content";
import { pageMarkdown } from "./markdown";
import { rendererVersion } from "./renderer";
import { siteOrigin } from "./site";

/** A page's Markdown version with everything it reads filled in: the `.md` route, Copy page and the tests. */
export function markdownFor(page: DocsPage, origin = siteOrigin()): string {
  return pageMarkdown({
    page,
    origin,
    version: rendererVersion(),
    exampleForm: (name) => readExampleForm(page.slug, name).schema,
    reference: readReference(page.slug),
    types: readTypes(page.slug),
    css: readCss(page.slug),
  });
}
