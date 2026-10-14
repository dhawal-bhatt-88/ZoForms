"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export type MenuItem = { label: string; icon?: React.ComponentType<{ className?: string }>; onSelect: () => void };

/**
 * A "⋯" button with a menu (the ARIA menu button pattern). Opening it moves
 * focus to the first item; Up and Down move between items, Home and End to
 * the ends; Escape closes it and puts focus back on the button, as does
 * choosing an item — so a dialog an item opens returns focus to the button.
 */
export function MenuButton({
  label,
  items,
  className = "",
  align = "right",
}: {
  /** The button's accessible name, e.g. `More actions for group "Smoking"`. */
  label: string;
  items: MenuItem[];
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    button.current?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const all = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => all[(i + all.length) % all.length]?.focus();
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      go(at - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(all.length - 1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={className || "grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink"}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            className={`absolute top-8 z-40 w-56 rounded-xl border border-line bg-surface p-1 shadow-pop ${align === "right" ? "right-0" : "left-0"}`}
          >
            {items.map(({ label: itemLabel, icon: Icon, onSelect }) => (
              <button
                key={itemLabel}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  closeMenu();
                  onSelect();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink focus:bg-surface-2 focus:text-ink focus:outline-none"
              >
                {Icon && <Icon className="h-4 w-4" />}
                {itemLabel}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
