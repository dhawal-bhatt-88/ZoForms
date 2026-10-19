import { forwardRef, useId } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@formbuilder/ui";

/*
 * The one button.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Button.tsx. Compare against it on the next sync.
 * Adapted:
 *   - The reason's id comes from `useId`. ZoBlocks builds it from
 *     `props.id ?? "action"`, so two blocked buttons without ids share one id
 *     and each describes itself with the other's reason
 *     (docs/ZOBLOCKS-UPSTREAM-NOTES.md).
 *   - `pending` stands in for ZoBlocks' SubmitButton, which reads a server
 *     form's status. The builder calls its API from the client, so the caller
 *     says when the action is running.
 *   - `forwardRef`, for React 18.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
/** `sm` for controls in a table row or beside a field; `icon` is square, for a glyph alone. */
export type ButtonSize = "sm" | "md" | "icon";

const SIZES: Record<ButtonSize, string> = {
  md: "px-3.5 py-2 text-[0.8125rem]",
  sm: "px-2.5 py-1.5 text-[0.75rem]",
  icon: "p-1.5",
};

/**
 * The button's appearance, without the button, so a navigation can look like
 * a button and stay a link: middle-click, open in a new tab and the right role
 * all survive.
 */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  blocked = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  blocked?: boolean;
  className?: string;
} = {}): string {
  return cn(
    // A transparent border on every variant keeps them one height side by side.
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent font-medium",
    SIZES[size],
    "transition-[background-color,border-color,color] duration-200",
    !blocked && variant === "primary" && "bg-cta text-paper hover:bg-cta-hover",
    !blocked && variant === "secondary" && "border-rule-strong bg-surface text-ink hover:bg-paper-sunk",
    !blocked && variant === "ghost" && "text-brand-deep hover:bg-accent-wash",
    // Never a filled red: red only ever means critical, and the word carries it.
    !blocked && variant === "danger" && "border-fail/30 bg-fail-wash text-fail hover:bg-fail-wash/70",
    blocked && "cursor-not-allowed border-rule bg-paper-sunk text-graphite-soft",
    className,
  );
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Present means blocked. The button stays focusable (`aria-disabled`, not
   * `disabled`) and the reason is shown beneath it and bound with
   * `aria-describedby`, so a keyboard or screen-reader user finds out why.
   */
  reason?: string;
  /** The action is running: a spinner, and no second click. */
  pending?: boolean;
  /** The label while pending; defaults to the button's own. */
  pendingLabel?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", reason, pending = false, pendingLabel, className, children, type = "button", onClick, ...props },
  ref,
) {
  const reasonId = `${useId()}-reason`;
  const blocked = Boolean(reason);
  const inert = blocked || pending;

  const button = (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-disabled={inert || undefined}
      aria-busy={pending || undefined}
      aria-describedby={blocked ? reasonId : props["aria-describedby"]}
      onClick={inert ? (event) => event.preventDefault() : onClick}
      className={buttonClasses({ variant, size, blocked, className: cn(pending && "cursor-progress", className) })}
    >
      {pending && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );

  if (!blocked) return button;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {button}
      <span id={reasonId} className="max-w-[34ch] text-[0.6875rem] leading-snug text-graphite">
        {reason}
      </span>
    </span>
  );
});
