import { DocsNav } from "@/components/docs/docs-nav";
import { SearchBox } from "@/components/docs/search-box";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { DOCS_HOME, visibleNav } from "@/lib/docs/nav";
import { rendererVersion } from "@/lib/docs/renderer";

/**
 * The docs' frame (docs brief, "Common layout"): the public header in its docs
 * variant, the side navigation, the page, the public footer. Like the home
 * page, nothing here needs a session or calls the API; the docs are public by
 * having no sign-in check, and nothing else changes.
 *
 * Not in the (public) group: its layout wraps every page in one `<main>`, and
 * the side navigation belongs beside the main content, not inside it, so the
 * skip link lands on the page itself.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-3 py-2 text-[0.8125rem] font-medium text-ink shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <PublicHeader docs={{ version: rendererVersion(), search: <SearchBox /> }} />
      <div className="flex-1 min-[760px]:grid min-[760px]:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-b border-rule min-[760px]:border-b-0 min-[760px]:border-r">
          <DocsNav home={DOCS_HOME} sections={visibleNav()} />
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 px-4 outline-none sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
      <PublicFooter />
    </div>
  );
}
