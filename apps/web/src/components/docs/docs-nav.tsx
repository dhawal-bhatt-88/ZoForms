"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@formbuilder/ui";
import { docsHref, isGroup, type DocsNavGroup, type DocsNavPage, type DocsNavSection } from "@/lib/docs/nav";

/**
 * The docs' side navigation: every live page, grouped as content/docs/nav.ts
 * orders them, the current one marked with `aria-current="page"`.
 *
 * From 760px it is a column beside the page. Below that it would be a long
 * list above the content, so a "Docs menu" disclosure opens it, and following
 * a link closes it again.
 *
 * Each group (Question types, Reference, …) is a disclosure of its own. The
 * group holding the current page starts open and the rest closed; the reader's
 * choices are kept in localStorage and applied once mounted, so the server's
 * render is always the default. A reader can close the current page's group,
 * but going to a page inside it opens it again.
 */

/** Group key → open, for the groups the reader has opened or closed. */
type Choices = Record<string, boolean>;

export const NAV_GROUPS_KEY = "docs-nav-groups";

function readChoices(): Choices {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(NAV_GROUPS_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Choices) : {};
  } catch {
    return {};
  }
}

function writeChoices(choices: Choices) {
  try {
    localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(choices));
  } catch {
    // Storage blocked or full: the choice still holds until the page is left.
  }
}

const groupKey = (section: DocsNavSection, group: DocsNavGroup) => `${section.title}/${group.title}`;

/** The key of the group holding the page at `pathname`, if it is in one. */
function currentGroup(sections: DocsNavSection[], pathname: string): string | undefined {
  for (const section of sections) {
    for (const item of section.items) {
      if (isGroup(item) && item.pages.some((page) => docsHref(page.slug) === pathname)) return groupKey(section, item);
    }
  }
  return undefined;
}

export function DocsNav({ home, sections }: { home: DocsNavPage; sections: DocsNavSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Choices>({});
  const listId = useId();
  const current = currentGroup(sections, pathname);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => setChoices(readChoices()), []);

  // Runs after the read above on the first render, so the current group wins over a stored "closed".
  useEffect(() => {
    if (!current) return;
    setChoices((c) => (c[current] ? c : { ...c, [current]: true }));
    writeChoices({ ...readChoices(), [current]: true });
  }, [current, pathname]);

  const isOpen = (key: string) => choices[key] ?? key === current;
  const toggle = (key: string) => {
    const next = { ...choices, [key]: !isOpen(key) };
    setChoices(next);
    writeChoices(next);
  };

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
          <Section key={section.title} section={section} pathname={pathname} isOpen={isOpen} toggle={toggle} />
        ))}
      </div>
    </nav>
  );
}

function Section({
  section,
  pathname,
  isOpen,
  toggle,
}: {
  section: DocsNavSection;
  pathname: string;
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
}) {
  const id = useId();
  return (
    <div className="mt-5">
      <p id={id} className="eyebrow px-2.5 text-graphite-soft">
        {section.title}
      </p>
      <ul aria-labelledby={id} className="mt-1.5">
        {section.items.map((item) => {
          if (!isGroup(item)) {
            return (
              <li key={item.slug}>
                <NavLink page={item} pathname={pathname} />
              </li>
            );
          }
          const key = groupKey(section, item);
          return <Group key={item.title} group={item} pathname={pathname} open={isOpen(key)} onToggle={() => toggle(key)} />;
        })}
      </ul>
    </div>
  );
}

/** A group's heading, a button that shows and hides its pages. */
function Group({ group, pathname, open, onToggle }: { group: DocsNavGroup; pathname: string; open: boolean; onToggle: () => void }) {
  const listId = useId();
  return (
    <li className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-left text-[0.75rem] font-medium text-graphite transition-colors duration-200 hover:bg-paper-sunk hover:text-ink"
      >
        {group.title}
        <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      <ul id={listId} hidden={!open} className="ml-2.5 border-l border-rule pl-1.5">
        {group.pages.map((page) => (
          <li key={page.slug}>
            <NavLink page={page} pathname={pathname} />
          </li>
        ))}
      </ul>
    </li>
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
