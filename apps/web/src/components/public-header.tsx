"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClasses } from "@/components/ui";

/**
 * The header of the public pages: the home page and the docs.
 *
 * One set of links, laid out two ways. From 640px they sit in the row after
 * the logo. Below it they don't fit beside the logo in 343px, so a Menu button
 * (a disclosure, like the app rail's) shows them as a panel under the row.
 * Every control exists once, so the tab order is the order on screen at both
 * widths and there's no second theme toggle to fall out of step.
 */

const LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Sign in", href: "/login" },
];

export function PublicHeader() {
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 py-3 sm:px-6">
        <Logo />

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
          <nav aria-label="Main">
            <ul className="flex flex-col gap-1 sm:flex-row sm:items-center">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-lg px-2.5 py-2 text-[0.8125rem] text-graphite transition-colors duration-200 hover:bg-paper-sunk hover:text-ink sm:py-1.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="mt-1 sm:ml-1 sm:mt-0">
                <Link href="/signup" className={buttonClasses({ variant: "primary", className: "w-full sm:w-auto" })}>
                  Get started
                </Link>
              </li>
            </ul>
          </nav>
          <ThemeToggle label="Color theme" className="self-start sm:self-auto" />
        </div>
      </div>
    </header>
  );
}
