"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readStoredTheme, resolveTheme, writeTheme, type Theme } from "@/lib/theme";
import { segmentClasses, segmentTrackClasses } from "@/components/ui";

/**
 * Light or dark.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ThemeToggle.tsx. Compare against it on the next sync.
 *
 * With nothing stored, the boot script follows `prefers-color-scheme`. The
 * class is applied before first paint by that script (app/layout.tsx); this
 * component only handles changes. See lib/theme.ts for why it's a cookie.
 *
 * Adapted: the selected segment is marked with `segmentClasses`' border
 * (docs/ZOBLOCKS-UPSTREAM-NOTES.md, note 6), and it is a radio group to the
 * keyboard too: one tab stop, the arrow keys move the choice.
 */

/** The choices, shared with the editor's ⋯ menu, which offers the same ones below 1024px. */
export const THEME_CHOICES: readonly { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];
const CHOICES = THEME_CHOICES;

/** The chosen theme, and a way to choose: stored, and applied at once. */
export function useThemeChoice(): [Theme, (value: Theme) => void] {
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
  return [choice, select];
}

/** `label`: the public pages are in US English, the app in British. */
export function ThemeToggle({ className, label = "Colour theme" }: { className?: string; label?: string } = {}) {
  const [choice, select] = useThemeChoice();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + CHOICES.length) % CHOICES.length;
    select(CHOICES[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={segmentTrackClasses(className)}>
      {CHOICES.map(({ value, label, Icon }, i) => (
        <button
          key={value}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          tabIndex={choice === value ? 0 : -1}
          onClick={() => select(value)}
          onKeyDown={(e) => onKey(e, i)}
          className={segmentClasses({ selected: choice === value, size: "icon" })}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
