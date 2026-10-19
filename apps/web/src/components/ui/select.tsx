import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@formbuilder/ui";
import { controlClasses } from "./control";

/*
 * A native select, dressed to match the kit.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/Select.tsx. Compare against it on the next sync.
 *
 * Native, not a custom listbox: the lists are short, and the platform control
 * is already keyboard-operable, announced correctly, typeahead-searchable and
 * opens the system picker on a phone. `appearance-none` plus our own chevron,
 * because the browser's arrow can't be recoloured for dark mode.
 */
export const Select = forwardRef<
  HTMLSelectElement,
  // `size` is left out of the DOM props: on a <select> it means visible rows.
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
    invalid?: boolean;
    mono?: boolean;
    size?: "sm" | "md";
    /** Classes for the wrapper, e.g. a width. */
    wrapperClassName?: string;
  }
>(function Select({ className, wrapperClassName, invalid, mono, size = "md", children, ...props }, ref) {
  return (
    <span className={cn("relative inline-flex w-full items-center", wrapperClassName)}>
      <select
        {...props}
        ref={ref}
        aria-invalid={invalid || props["aria-invalid"]}
        className={cn(
          controlClasses({ invalid, mono, size }),
          "cursor-pointer appearance-none",
          size === "md" ? "pr-9" : "pr-8",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={2}
        className={cn(
          "pointer-events-none absolute text-graphite-soft",
          size === "md" ? "right-3 h-4 w-4" : "right-2.5 h-3.5 w-3.5",
        )}
      />
    </span>
  );
});
