import * as React from "react";
import { cn } from "./cn";

/** The accent "eyebrow" pill used above section headings. */
export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2 rounded-full border border-accent-weak bg-accent-weak px-3 py-1.5 text-[13px] font-semibold text-accent-2",
      className,
    )}
    {...props}
  />
));
Badge.displayName = "Badge";
