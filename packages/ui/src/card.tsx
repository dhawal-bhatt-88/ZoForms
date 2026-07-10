import * as React from "react";
import { cn } from "./cn";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-line bg-surface shadow-soft",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";
