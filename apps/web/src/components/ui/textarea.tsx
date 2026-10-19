import { forwardRef } from "react";
import { cn } from "@formbuilder/ui";
import { controlClasses } from "./control";

/*
 * A multi-line field, matching `Input` because it is the same field.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Textarea.tsx. Compare against it on the next sync.
 * `resize-y`: dragging a field wider than its container breaks the layout.
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; mono?: boolean }
>(function Textarea({ className, invalid, mono, ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"]}
      className={cn(
        controlClasses({ invalid: invalid || Boolean(props["aria-invalid"]), mono }),
        "resize-y leading-relaxed",
        className,
      )}
    />
  );
});
