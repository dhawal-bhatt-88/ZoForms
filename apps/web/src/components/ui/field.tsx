"use client";

import { forwardRef, useId } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@formbuilder/ui";
import { controlClasses } from "./control";

/*
 * A labelled control, with its hint and error bound to it.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Field.tsx. Compare against it on the next sync.
 *
 * A hint in a `<p>` beside an input is invisible to a screen reader, and an
 * error that is only red is invisible to anyone who can't see red, so both go
 * through `aria-describedby`, and an error also sets `aria-invalid`.
 * `children` gets the props to spread, so the control can be anything.
 *
 * Adapted: the hint stays visible beside an error. ZoBlocks hides it but keeps
 * its id in `aria-describedby`, which then points at nothing.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  /** Why this field exists, or what a good value looks like. */
  hint?: React.ReactNode;
  /** What went wrong and how to fix it. */
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
    required: boolean | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
        {label}
        {/* The exception is marked, not the rule. The `{" "}` keeps "optional"
            a separate word in the accessible name. */}
        {!required && (
          <>
            {" "}
            <span className="ml-1 text-[0.6875rem] font-normal text-graphite-soft">optional</span>
          </>
        )}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required || undefined,
      })}

      {hint && (
        <p id={hintId} className="mt-1.5 text-[0.75rem] leading-relaxed text-graphite">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex gap-1.5 text-[0.75rem] leading-relaxed text-fail">
          {/* Decorative; the words carry the meaning. */}
          <AlertTriangle aria-hidden="true" strokeWidth={2} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** The default text input, so every screen's fields are the same object. */
export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean; controlSize?: "sm" | "md" }
>(function Input({ className, mono, controlSize, ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      className={controlClasses({ invalid: Boolean(props["aria-invalid"]), mono, size: controlSize, className })}
    />
  );
});
