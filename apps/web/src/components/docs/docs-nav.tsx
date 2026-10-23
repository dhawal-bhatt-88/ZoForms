"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@formbuilder/ui";
import { docsHref, isGroup, type DocsNavPage, type DocsNavSection } from "@/lib/docs/nav";

/**
 * The docs' side navigation: every live page, grouped as content/docs/nav.ts
 * orders them, the current one marked with `aria-current="page"`.
 *
 * From 760px it is a column beside the page. Below that it would be a long
 * list above the content, so a "Docs menu" disclosure opens it, and following
 * a link closes it again.
 */
export function DocsNav({ home, sections }: { home: DocsNavPage; sections: DocsNavSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const listId = useId();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <nav aria-label="Docs" className="min-[760px]:sticky min-[760px]:top-0 min-[760px]:max-h-screen min-[760px]:overflow-y-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center justify-between px-4 py-3 text-[0.8125rem] font-medium text-ink min-[760px]:hidden"
      >
        Docs menu
        <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div id={listId} className={cn(open ? "block" : "hidden", "border-t border-rule px-3 pb-6 pt-3 min-[760px]:block min-[760px]:border-0 min-[760px]:pt-6")}>
        <ul>
          <li>
            <NavLink page={home} pathname={pathname} />
          </li>
        </ul>
        {sections.map((section) => (
          <Section key={section.title} section={section} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function Section({ section, pathname }: { section: DocsNavSection; pathname: string }) {
  const id = useId();
  return (
    <div className="mt-5">
      <p id={id} className="eyebrow px-2.5 text-graphite-soft">
        {section.title}
      </p>
      <ul aria-labelledby={id} className="mt-1.5">
        {section.items.map((item) =>
          isGroup(item) ? (
            <li key={item.title} className="mt-2">
              <p className="px-2.5 py-1 text-[0.75rem] font-medium text-graphite">{item.title}</p>
              <ul className="ml-2.5 border-l border-rule pl-1.5">
                {item.pages.map((page) => (
                  <li key={page.slug}>
                    <NavLink page={page} pathname={pathname} />
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={item.slug}>
              <NavLink page={item} pathname={pathname} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function NavLink({ page, pathname }: { page: DocsNavPage; pathname: string }) {
  const href = docsHref(page.slug);
  const current = pathname === href;
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "block rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-colors duration-200",
        current ? "bg-accent-wash font-medium text-brand-deep" : "text-graphite hover:bg-paper-sunk hover:text-ink",
      )}
    >
      {page.title}
    </Link>
  );
}
