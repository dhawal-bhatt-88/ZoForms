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
 */
export function Dialog({
  title,
  description,
  onClose,
  busy = false,
  width = "max-w-md",
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  /** A Tailwind max-width class. */
  width?: string;
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
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`flex max-h-[88vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-sm text-muted">
                {description}
              </p>
            )}
          </div>
          <button onClick={onClose} disabled={busy} className="text-muted hover:text-ink disabled:opacity-40" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
