"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SETTINGS_PANE_KEY_STEP,
  STORED_PANE_WIDTH_MAX,
  settingsPaneLimits,
  settingsPaneWidth,
} from "@formbuilder/form-schema";
import { updatePreferences } from "@/lib/api";

/** The pane's element id, which the handle's `aria-controls` points at. */
export const SETTINGS_PANE_ID = "settings-pane";
/** The pane's accessible name, which the handle shares (W3C APG window splitter). */
export const SETTINGS_PANE_NAME = "Field settings";
/** How long after the last drag or key press the width is saved. */
const SAVE_DELAY_MS = 500;
/** On <html> while a drag is in progress: col-resize everywhere and no text selection (globals.css). */
const RESIZING_CLASS = "pane-resizing";

export type SettingsPane = ReturnType<typeof useSettingsPane>;

/**
 * The editor's resizable settings pane: its width, and the handle's props.
 *
 * `saved` is the author's width from their account (`me().settingsPaneWidth`):
 * undefined while it is loading, null for the default. It is held within this
 * screen's limits when shown, but the held value isn't saved, so the width
 * comes back on a wider screen. The author's own changes are saved once they
 * stop (a drag ends, or a pause after key presses); a double-click saves null,
 * so the pane follows the default from then on. A save that fails is logged and
 * the width kept for this session: it never interrupts editing.
 */
export function useSettingsPane(saved: number | null | undefined) {
  // The author's choice in this session: undefined = none yet (use `saved`), null = the default.
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const limits = settingsPaneLimits(viewport);
  const width = settingsPaneWidth(chosen === undefined ? saved : chosen, viewport);
  const clamp = (w: number) => Math.min(limits.max, Math.max(limits.min, Math.round(w)));

  // What the account holds, so an unchanged width (a click without a drag) isn't sent.
  const stored = useRef<number | null | undefined>(undefined);
  if (stored.current === undefined && saved !== undefined) stored.current = saved;
  const pending = useRef<{ value: number | null } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (!next || next.value === stored.current) return;
    const value = next.value;
    updatePreferences({ settingsPaneWidth: value })
      .then(() => {
        stored.current = value;
      })
      .catch((err) => console.warn("Couldn't save the settings pane width. It stays as it is until you reload.", err));
  }, []);

  const save = (value: number | null) => {
    // A screen wider than 8000px could allow more than the account can store.
    pending.current = { value: value === null ? null : Math.min(value, STORED_PANE_WIDTH_MAX) };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  };

  // Leaving the editor, or the page, sends a save that is still waiting.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null);
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    document.documentElement.classList.remove(RESIZING_CLASS);
    if (d.width !== d.startWidth) save(d.width);
  };
  useEffect(() => () => document.documentElement.classList.remove(RESIZING_CLASS), []);

  const separator = {
    role: "separator",
    tabIndex: 0,
    "aria-orientation": "vertical",
    "aria-label": SETTINGS_PANE_NAME,
    "aria-controls": SETTINGS_PANE_ID,
    "aria-valuenow": width,
    "aria-valuemin": limits.min,
    "aria-valuemax": limits.max,
    "aria-valuetext": `${width} pixels`,
    "data-dragging": dragging || undefined,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      // No text selection or native drag from here; focus as a click would have.
      e.preventDefault();
      e.currentTarget.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      document.documentElement.classList.add(RESIZING_CLASS);
      drag.current = { startX: e.clientX, startWidth: width, width };
      setDragging(true);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      // The pane is on the right: moving the handle left widens it.
      const next = clamp(d.startWidth + d.startX - e.clientX);
      if (next === d.width) return;
      d.width = next;
      setChosen(next);
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      let next: number;
      switch (e.key) {
        case "ArrowLeft":
          next = width + SETTINGS_PANE_KEY_STEP;
          break;
        case "ArrowRight":
          next = width - SETTINGS_PANE_KEY_STEP;
          break;
        case "Home":
          next = limits.min;
          break;
        case "End":
          next = limits.max;
          break;
        default:
          // Enter would collapse the pane in the APG pattern; collapsing isn't offered.
          return;
      }
      e.preventDefault();
      next = clamp(next);
      if (next === width) return;
      setChosen(next);
      save(next);
    },
    onDoubleClick: () => {
      setChosen(null);
      save(null);
    },
  } as const;

  return { width, separator };
}

/**
 * The handle between the canvas and the pane: a zero-width grid column with
 * an 8px hit area over the pane's border, showing an accent line on hover,
 * focus and drag, and a focus ring for the keyboard.
 */
export function SettingsPaneHandle({ pane }: { pane: SettingsPane }) {
  return (
    <div className="relative z-20 w-0">
      <div
        {...pane.separator}
        title="Drag to resize. Double-click to reset."
        className="group absolute inset-y-0 -left-1 w-2 cursor-col-resize touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent group-data-[dragging=true]:bg-accent"
        />
      </div>
    </div>
  );
}
