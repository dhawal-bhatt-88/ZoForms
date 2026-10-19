"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonVariant } from "./button";

/*
 * Copy, and say so — in the button, where the reader is looking, with a polite
 * live region because a changed label alone isn't announced by every screen
 * reader. It reverts after two seconds so the button doesn't lie about its
 * next action.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/CopyButton.tsx. Compare against it on the next sync.
 */
export function CopyButton({
  value,
  children = "Copy",
  variant = "secondary",
  size = "sm",
}: {
  value: string;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            // A refused clipboard is the reader's choice; the value is on screen to select.
          }
        }}
      >
        {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-pass" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
        {copied ? "Copied" : children}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to the clipboard" : ""}
      </span>
    </>
  );
}
