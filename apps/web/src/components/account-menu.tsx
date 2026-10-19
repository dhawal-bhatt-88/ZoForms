"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";

/**
 * The account pill, top right: who you are, and the way out.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/AccountMenu.tsx. Compare against it on the next
 * sync. The builder has no account-settings or password screens, so the menu
 * holds the identity and Log out only.
 *
 * A real button with `aria-expanded`: a hover card can't be opened from a
 * keyboard or by touch, and this holds the only way to log out.
 */
export function AccountMenu({
  name,
  email,
  role,
  onLogout,
}: {
  name: string;
  email: string;
  role: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  // Focus goes in and comes back; Escape and a click elsewhere close it.
  useEffect(() => {
    if (!open) return;
    const returnTo = trigger.current;
    menu.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Here, not in the cleanup: by the time that runs the menu has left the
      // DOM and taken focus with it, so the check there never sees it inside.
      returnTo?.focus();
      setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      if (wrapper.current?.contains(document.activeElement)) returnTo?.focus();
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="menu"
        className={`group flex max-w-[15rem] items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition-colors duration-200 ${
          open ? "border-rule-strong bg-paper-sunk" : "border-rule bg-paper hover:bg-paper-sunk"
        }`}
      >
        <Initials name={name || email} />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-[0.75rem] font-medium leading-tight">{name || email}</span>
          <span className="block truncate text-[0.625rem] leading-tight text-graphite-soft">{email}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2}
          className={`h-3.5 w-3.5 shrink-0 text-graphite-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label="Account"
          className="rise-in surface absolute right-0 z-50 mt-2 w-[15rem] overflow-hidden p-0 shadow-[0_18px_44px_-18px_rgb(2_20_17/0.28)]"
        >
          <div className="border-b border-rule bg-paper-sunk px-3.5 py-3">
            <p className="truncate text-[0.8125rem] font-semibold">{name || email}</p>
            <p className="truncate text-[0.6875rem] text-graphite">{email}</p>
            <p className="eyebrow mt-1.5 text-brand-deep">{role}</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] text-fail transition-colors duration-150 hover:bg-fail-wash"
            >
              <LogOut aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5 shrink-0" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Two letters from the name: honest, and legible at 28px. */
function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-solid font-mono text-[0.625rem] font-medium text-accent-on"
    >
      {letters || "?"}
    </span>
  );
}
