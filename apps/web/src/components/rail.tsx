"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, LayoutTemplate, Menu, Users } from "lucide-react";
import { Logo } from "@/components/logo";

/**
 * The left rail: the wordmark and the navigation, and nothing else. Who you are
 * and the way out live in the account bar.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/Rail.tsx. Compare against it on the next sync.
 *
 * Below `lg` it is a panel over the page (`.rail-panel` in globals.css), opened
 * by the Menu button: focus moves in on open and back on close, Escape and the
 * scrim close it, and the page underneath doesn't scroll.
 */

interface Item {
  href: string;
  label: string;
  Icon: typeof LayoutGrid;
}

const WORKSPACE: Item[] = [
  { href: "/app", label: "My forms", Icon: LayoutGrid },
  { href: "/app/templates", label: "Templates", Icon: LayoutTemplate },
  { href: "/app/team", label: "Team", Icon: Users },
];

/** The longest href the path sits inside, so one item is current, not two. */
function currentHref(pathname: string, hrefs: readonly string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function Rail() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Navigating closes it, so the menu never covers the screen just asked for.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const returnTo = trigger.current;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnTo?.focus();
    };
  }, [open]);

  // Above `lg` the Menu button is hidden, so nothing could close the panel or
  // release the scroll lock: reaching the breakpoint closes it.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 64rem)");
    const sync = () => wide.matches && setOpen(false);
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  const current = currentHref(pathname, WORKSPACE.map((i) => i.href));

  return (
    <div className="flex h-full flex-col gap-4 lg:gap-6">
      <div className="flex items-center justify-between gap-3">
        <Logo href="/app" />
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="app-rail"
          className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-2.5 py-1.5 text-[0.75rem] text-graphite lg:hidden"
        >
          <Menu aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          Menu
        </button>
      </div>

      {/* The scrim: a real button, so dismissing it is reachable by keyboard too. */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Hidden, the panel is `visibility: hidden`: out of the tab order and
          the accessibility tree, and still able to slide. */}
      <div
        id="app-rail"
        ref={panel}
        tabIndex={-1}
        data-open={open}
        className="rail-panel min-h-0 flex-1 flex-col gap-6 lg:flex"
      >
        <nav aria-label="App" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <div>
            <p className="eyebrow mb-1.5 px-2.5 text-graphite-soft">Workspace</p>
            <ul className="space-y-0.5">
              {WORKSPACE.map((item) => {
                const active = item.href === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-colors duration-200 ${
                        active ? "bg-accent-wash font-medium text-brand-deep" : "text-graphite hover:bg-paper-sunk hover:text-ink"
                      }`}
                    >
                      <item.Icon
                        aria-hidden="true"
                        strokeWidth={2}
                        className={`h-3.5 w-3.5 shrink-0 ${active ? "text-brand-deep" : "text-graphite-soft"}`}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* The one link back to the rest of the family. */}
        <p className="px-2.5 text-[0.6875rem] text-graphite-soft">
          <a href="https://zoblocks.design" className="link">
            zoblocks.design
          </a>
        </p>
      </div>
    </div>
  );
}
