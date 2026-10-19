"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * The app's on/off switch: a 36 × 20 track and a 14px knob that slides from
 * the left edge (off) to the right edge (on). It is a button with
 * `role="switch"`, so click, Space and Enter all toggle it. Give it an
 * accessible name with `aria-label` or `aria-labelledby`.
 *
 * Off is outlined and on is filled, so the two states differ in more than the
 * knob's position and a hue. Every part clears the 3:1 WCAG 1.4.11 asks of a
 * control's boundary and its state, in both themes:
 *   - off: a `graphite-soft` border on `paper` (5.47:1 against surface in
 *     light, 5.84:1 in dark) and a `graphite-soft` knob (5.17:1 / 6.22:1);
 *   - on: a `brand-deep` track (5.56:1 / 12.28:1) and a `paper` knob
 *     (5.26:1 / 13.07:1).
 * The off track was `rule-strong`, 1.59:1 against surface.
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
      className={`relative h-5 w-9 flex-none rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "border-brand-deep bg-brand-deep" : "border-graphite-soft bg-paper"
      } ${className}`}
    >
      <span
        aria-hidden
        // left-0: without it the knob starts from the button's centre and ends up outside the track.
        className={`absolute left-0 top-[2px] h-3.5 w-3.5 rounded-full transition-transform duration-200 ${
          checked ? "translate-x-[18px] bg-paper" : "translate-x-[2px] bg-graphite-soft"
        }`}
      />
    </button>
  );
}
