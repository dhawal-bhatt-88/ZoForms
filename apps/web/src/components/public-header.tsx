"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatusChip, buttonClasses } from "@/components/ui";

/**
 * The header of the public pages: the home page and the docs.
 *
 * One set of links, laid out two ways. From 640px they sit in the row after
 * the logo. Below it they don't fit beside the logo in 343px, so a Menu button
 * (a disclosure, like the app rail's) shows them as a panel under the row.
 * Every control exists once, so the tab order is the order on screen at both
 * widths and there's no second theme toggle to fall out of step.
 *
 * The docs' variant (docs brief, "Common layout") spans the full width, names
 * the docs after the logo, and holds search, the package version and Release
 * notes in place of Docs and Get started. Signed in, Sign in becomes Open my
 * forms.
 */

const LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Sign in", href: "/login" },
];

const linkClasses =
  "block rounded-lg px-2.5 py-2 text-[0.8125rem] text-graphite transition-colors duration-200 hover:bg-paper-sunk hover:text-ink sm:py-1.5";

export function PublicHeader({
  docs,
}: {
  /** The docs' variant: the package version and the search box, which the docs layout passes in so the home page never loads it. */
  docs?: { version: string; search: React.ReactNode };
} = {}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="border-b border-rule"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className={`${docs ? "" : "mx-auto max-w-6xl "}flex flex-wrap items-center gap-x-3 px-4 py-3 sm:px-6`}>
        <Logo />
        {docs && (
          <>
            <span aria-hidden="true" className="text-rule-strong">
              /
            </span>
            <Link href="/docs" className="text-[0.8125rem] font-medium text-ink">
              Docs
            </Link>
          </>
        )}

        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="public-menu"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rule px-2.5 py-1.5 text-[0.75rem] text-graphite sm:hidden"
        >
          {open ? (
            <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Menu aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Menu
        </button>

        {/* Following a link closes the panel: the docs keep this header mounted. */}
        <div
          id="public-menu"
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          className={`${open ? "flex" : "hidden"} mt-3 basis-full flex-col gap-3 border-t border-rule pb-1 pt-3 sm:ml-auto sm:mt-0 sm:flex sm:basis-auto sm:flex-row sm:items-center sm:border-0 sm:p-0`}
        >
          {docs?.search}
          <nav aria-label="Main">
            <ul className="flex flex-col gap-1 sm:flex-row sm:items-center">
              {docs ? (
                <>
                  <li className="px-2.5 py-2 font-mono text-[0.75rem] text-graphite sm:py-1.5">@zoworkhq/forms {docs.version}</li>
                  {/* No page yet (docs brief, decision 9): plain text, marked "soon", as in the footer. */}
                  <li className="flex items-center gap-1.5 px-2.5 py-2 text-[0.8125rem] text-graphite sm:py-1.5">
                    Release notes <StatusChip>soon</StatusChip>
                  </li>
                  {/* One of the two shows, by the session (globals.css): the docs look the same either way. */}
                  <li className="signed-out-only">
                    <Link href="/login" className={linkClasses}>
                      Sign in
                    </Link>
                  </li>
                  <li className="signed-in-only">
                    <Link href="/app" className={linkClasses}>
                      Open my forms
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={linkClasses}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li className="mt-1 sm:ml-1 sm:mt-0">
                    <Link href="/signup" className={buttonClasses({ variant: "primary", className: "w-full sm:w-auto" })}>
                      Get started
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
          <ThemeToggle label="Color theme" className="self-start sm:self-auto" />
        </div>
      </div>
    </header>
  );
}
