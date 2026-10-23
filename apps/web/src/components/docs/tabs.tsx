"use client";

import { useId, useRef, useState } from "react";
import { segmentClasses, segmentTrackClasses } from "@/components/ui";

export type TabSpec = { id: string; label: string; content: React.ReactNode };

/**
 * Tabs, as the ARIA Authoring Practices describe them: one tab stop for the
 * list, the arrow keys move between tabs and select as they go, Home and End
 * jump to the ends. Every panel stays mounted and inactive ones are `hidden`,
 * so a half-filled form on Preview keeps its answers while the reader looks at
 * another tab.
 */
export function Tabs({ label, tabs, initial }: { label: string; tabs: readonly TabSpec[]; initial?: string }) {
  const base = useId();
  const [selected, setSelected] = useState(initial ?? tabs[0]?.id);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  function onKey(e: React.KeyboardEvent, i: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setSelected(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className={segmentTrackClasses("max-w-full flex-wrap")}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected === tab.id}
            aria-controls={panelId(tab.id)}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={() => setSelected(tab.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={segmentClasses({ selected: selected === tab.id, size: "sm" })}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          hidden={selected !== tab.id}
          tabIndex={0}
          className="mt-3 rounded-lg focus-visible:outline-offset-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
