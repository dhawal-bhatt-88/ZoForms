"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null) : [];
}

/**
 * A modal dialog, with the builder's focus rules: focus moves in when it
 * opens (to the element marked `data-autofocus`, else the first control),
 * Tab and Shift+Tab stay inside it, Escape and the backdrop close it (not
 * while `busy`), and when it closes focus goes back to the control that had
 * it before — the one that opened it. Named by its title, described by
 * `description` when given.
 *
 * Styled as a ZoBlocks surface (radius, rules, a `paper-sunk` footer like
 * `Panel`'s), after github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Panel.tsx.
 */
export function Dialog({
  title,
  description,
  onClose,
  busy = false,
  width = "max-w-md",
  role = "dialog",
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  /** A Tailwind max-width class. */
  width?: string;
  /** `alertdialog` for a confirmation that interrupts. */
  role?: "dialog" | "alertdialog";
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    (node?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables(node)[0] ?? node)?.focus();
    return () => {
      // Back to the opener, if it's still on the page (a menu item that opened us has gone).
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busyRef.current) close.current();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusables(ref.current);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[1px]"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`rise-in flex max-h-[88vh] w-full ${width} flex-col overflow-hidden rounded-[0.875rem] border border-rule bg-surface text-ink shadow-[0_24px_60px_-20px_rgb(2_20_17/0.35)] outline-none`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-start gap-3 border-b border-rule px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-[0.9375rem] font-semibold tracking-[-0.008em]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="body-sm mt-1 text-graphite">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-graphite transition-colors duration-200 hover:bg-paper-sunk hover:text-ink disabled:cursor-not-allowed disabled:text-graphite-soft"
            aria-label="Close"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-paper-sunk px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
