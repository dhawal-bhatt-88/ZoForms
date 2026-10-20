"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, MoreHorizontal, type LucideIcon } from "lucide-react";

export type MenuItem =
  | {
      label: string;
      icon?: LucideIcon;
      /** An action. */
      onSelect?: () => void;
      /** A navigation: rendered as a link, so it opens in a new tab like one. */
      href?: string;
      /** Destructive: the fail colour, and the word carries it. */
      danger?: boolean;
      /**
       * One of a set of choices (a `menuitemradio`): `true` for the chosen one,
       * which shows a tick. Choosing it keeps the menu's focus behaviour.
       */
      checked?: boolean;
    }
  | "separator";

/**
 * A "⋯" button with a menu (the ARIA menu button pattern). Opening it moves
 * focus to the first item; Up and Down move between items, Home and End to
 * the ends; Escape closes it and puts focus back on the button, as does
 * choosing an item — so a dialog an item opens returns focus to the button.
 *
 * Styled like the ZoBlocks account menu, after github.com/zoworkhq/zoblocks at
 * 9aaefe0, apps/app/src/components/AccountMenu.tsx: a `.surface` card, the
 * shared item padding, `fail` for a destructive item.
 */
export function MenuButton({
  label,
  items,
  className = "",
  align = "right",
  placement = "below",
}: {
  /** The button's accessible name, e.g. `More actions for group "Smoking"`. */
  label: string;
  items: MenuItem[];
  className?: string;
  align?: "left" | "right";
  /** `above` for a trigger at the bottom of a card. */
  placement?: "below" | "above";
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')?.focus();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    button.current?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const all = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ?? []);
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

  const itemClass = (danger?: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] transition-colors duration-150 focus:outline-none ${
      danger
        ? "text-fail hover:bg-fail-wash focus:bg-fail-wash"
        : "text-graphite hover:bg-paper-sunk hover:text-ink focus:bg-paper-sunk focus:text-ink"
    }`;

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
        className={
          className ||
          "grid h-8 w-8 place-items-center rounded-lg text-graphite transition-colors duration-200 hover:bg-paper-sunk hover:text-ink aria-expanded:bg-paper-sunk aria-expanded:text-ink"
        }
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            className={`rise-in surface absolute z-40 w-56 p-1.5 shadow-[0_18px_44px_-18px_rgb(2_20_17/0.28)] ${
              placement === "above" ? "bottom-10" : "top-9"
            } ${align === "right" ? "right-0" : "left-0"}`}
          >
            {items.map((item, i) => {
              if (item === "separator") return <div key={`sep-${i}`} role="separator" className="-mx-1.5 my-1.5 h-px bg-rule" />;
              const { label: itemLabel, icon: ItemIcon, onSelect, href, danger, checked } = item;
              const content = (
                <>
                  {ItemIcon && <ItemIcon aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5 shrink-0" />}
                  <span className="flex-1">{itemLabel}</span>
                  {checked && <Check aria-hidden="true" strokeWidth={2.5} className="h-3.5 w-3.5 shrink-0 text-brand-deep" />}
                </>
              );
              return href ? (
                <Link key={itemLabel} href={href} role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={itemClass(danger)}>
                  {content}
                </Link>
              ) : (
                <button
                  key={itemLabel}
                  type="button"
                  role={checked === undefined ? "menuitem" : "menuitemradio"}
                  aria-checked={checked}
                  tabIndex={-1}
                  onClick={() => {
                    closeMenu();
                    onSelect?.();
                  }}
                  className={itemClass(danger)}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
