"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * The app's on/off switch: a 36 × 20 track and a 16px knob that slides from
 * the left edge (off) to the right edge (on). It is a button with
 * `role="switch"`, so click, Space and Enter all toggle it. Give it an
 * accessible name with `aria-label` or `aria-labelledby`.
 */
export function Switch({
  checked,
  onChange,
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role" | "type"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 flex-none rounded-full transition-colors disabled:opacity-60 ${checked ? "bg-accent" : "bg-line-2"} ${className}`}
    >
      <span
        aria-hidden
        // left-0: without it the knob starts from the button's centre and ends up outside the track.
        className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
      />
    </button>
  );
}
