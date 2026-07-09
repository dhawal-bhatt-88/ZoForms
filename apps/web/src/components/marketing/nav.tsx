"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";

const links = [
  { label: "Product", href: "/#features" },
  { label: "Customers", href: "/#customers" },
  { label: "Security", href: "/#security" },
  { label: "Pricing", href: "/pricing" },
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
      className={`sticky top-0 z-50 transition-all ${
        scrolled
          ? "border-b border-line bg-bg/80 backdrop-blur-md"
          : "border-b border-transparent bg-bg/0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
        <Logo />
        <nav className="ml-4 hidden gap-7 text-sm font-medium text-ink/70 md:flex">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-dark btn-sm">
            Start for free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-line md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-surface px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
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
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            <Link href="/login" onClick={() => setOpen(false)} className="btn btn-outline w-full">
              Log in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-dark w-full">
              Start for free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
