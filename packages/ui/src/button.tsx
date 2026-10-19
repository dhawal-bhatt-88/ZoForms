import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/** Button variants mirror the `.btn-*` classes so markup can migrate incrementally. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-paper hover:bg-cta-hover",
        accent: "bg-accent text-paper hover:bg-accent-2",
        dark: "bg-primary text-paper hover:bg-ink-2",
        ghost: "text-ink hover:bg-line",
        outline: "border border-line bg-surface text-ink hover:bg-bg",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        default: "h-10 px-4 text-sm",
        lg: "h-12 rounded-xl px-6 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
