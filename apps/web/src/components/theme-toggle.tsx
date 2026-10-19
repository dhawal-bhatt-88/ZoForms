"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readStoredTheme, resolveTheme, writeTheme, type Theme } from "@/lib/theme";

/**
 * Light or dark.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ThemeToggle.tsx. Compare against it on the next sync.
 *
 * With nothing stored, the boot script follows `prefers-color-scheme`. The
 * class is applied before first paint by that script (app/layout.tsx); this
 * component only handles changes. See lib/theme.ts for why it's a cookie.
 */

const CHOICES: readonly { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle() {
  // Starts light on server and client and is corrected in an effect: reading
  // storage during render would make the two disagree and fail hydration.
  const [choice, setChoice] = useState<Theme>("light");

  useEffect(() => {
    const resolved = resolveTheme(readStoredTheme());
    if (resolved === "light" || resolved === "dark") setChoice(resolved);
  }, []);

  const select = (value: Theme) => {
    setChoice(value);
    writeTheme(value);
    applyTheme(value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-rule bg-paper-sunk p-0.5"
    >
      {CHOICES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          onClick={() => select(value)}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200 ${
            choice === value ? "bg-paper text-ink shadow-sm" : "text-graphite-soft hover:text-graphite"
          }`}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
