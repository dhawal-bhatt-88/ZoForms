"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@formbuilder/ui";

/*
 * Action results, where the reader is looking.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Toast.tsx. Compare against it on the next sync.
 * Adapted: ids from a counter (two toasts can be raised in one millisecond by
 * code, if not by a hand), and `show` is stable across renders.
 *
 * Two rules:
 *   - Failures don't auto-dismiss: they are something to read and act on.
 *     Successes go after six seconds.
 *   - It is an addition, not a replacement. A `Callout` stays for anything a
 *     reader needs to keep looking at while they fix it.
 *
 * The live region exists while empty, because a region added at the same
 * moment as its content isn't announced. It is polite: a result follows a
 * deliberate action and needn't interrupt. A failure card is `role="alert"`.
 */

export type ToastTone = "pass" | "fail" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastApi {
  show: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

/** A no-op outside a provider: losing a confirmation is bad, losing the screen is worse. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => undefined };
}

/** How long a success stays, in ms. */
export const TOAST_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((toast: Omit<Toast, "id">) => {
    const id = next.current++;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        data-toasts
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICON = { pass: Check, fail: AlertTriangle, info: Info };

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const Icon = ICON[toast.tone];

  useEffect(() => {
    if (toast.tone === "fail") return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.tone, toast.id, onDismiss]);

  return (
    <div
      role={toast.tone === "fail" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto w-full max-w-[26rem] rounded-xl border px-4 py-3 shadow-lg",
        "motion-safe:animate-[toast-in_240ms_var(--ease-out-expo)]",
        toast.tone === "pass" && "border-pass/25 bg-pass-wash",
        toast.tone === "fail" && "border-fail/30 bg-fail-wash",
        toast.tone === "info" && "border-rule bg-surface",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          aria-hidden="true"
          strokeWidth={2}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            toast.tone === "pass" && "text-pass",
            toast.tone === "fail" && "text-fail",
            toast.tone === "info" && "text-brand-deep",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold text-ink">{toast.title}</p>
          {toast.detail && <p className="body-sm mt-0.5 break-words text-graphite">{toast.detail}</p>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded p-1 text-graphite-soft transition-colors duration-200 hover:text-ink"
        >
          <X aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
