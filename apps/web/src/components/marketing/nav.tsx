"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  GitBranch,
  LayoutTemplate,
  Menu,
  PenLine,
  Puzzle,
  Sparkles,
  X,
} from "lucide-react";
import { Logo } from "./logo";

const productMenu = [
  { icon: PenLine, title: "Block editor", body: "Write forms like a doc", href: "/#features" },
  { icon: GitBranch, title: "Logic & calc", body: "Branch, score, pipe answers", href: "/#features" },
  { icon: Sparkles, title: "AI generation", body: "Draft a form from a prompt", href: "/#features" },
  { icon: BarChart3, title: "Analytics", body: "Views, funnel & drop-off", href: "/#features" },
  { icon: Puzzle, title: "Integrations", body: "Sheets, Slack, webhooks", href: "/#integrations" },
  { icon: LayoutTemplate, title: "Templates", body: "Start from a proven form", href: "/app" },
];

const links = [
  { label: "Customers", href: "/#customers" },
  { label: "Security", href: "/#security" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-line glass shadow-[0_1px_0_rgba(20,22,28,0.03)]" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
        <Logo />

        <nav className="ml-4 hidden items-center gap-1 text-sm font-medium md:flex">
          {/* Product mega-menu */}
          <div className="group relative">
            <button className="nav-link flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-ink/70 transition-colors hover:text-ink">
              Product
              <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full translate-y-1 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="w-[440px] rounded-2xl border border-line bg-surface p-2 shadow-pop">
                <div className="grid grid-cols-2 gap-1">
                  {productMenu.map((m) => (
                    <Link
                      key={m.title}
                      href={m.href}
                      className="group/item flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-accent-weak text-accent-2 transition-transform duration-300 group-hover/item:scale-110">
                        <m.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink">{m.title}</span>
                        <span className="block truncate text-xs text-muted">{m.body}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="nav-link rounded-lg px-2.5 py-1.5 text-ink/70 transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Log in
          </Link>
          <Link
            href="/signup"
            className="btn btn-dark btn-shine btn-sm transition-transform hover:-translate-y-0.5"
          >
            Start for free
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-ink transition-colors hover:bg-line md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-t border-line bg-surface transition-[max-height,opacity] duration-300 md:hidden ${
          open ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-6 py-4">
          <Link href="/#features" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink/80 hover:bg-bg">
            Product
          </Link>
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink/80 hover:bg-bg"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            <Link href="/login" onClick={() => setOpen(false)} className="btn btn-outline w-full">
              Log in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-dark w-full">
              Start for free
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
