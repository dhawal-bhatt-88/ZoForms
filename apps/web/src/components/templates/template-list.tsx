"use client";

import { useId } from "react";
import { Search } from "lucide-react";
import type { TemplateSummary } from "@/lib/api";

/** Templates whose name or description contains `query`, ignoring case. */
export function filterTemplates<T extends TemplateSummary>(templates: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...templates];
  return templates.filter((t) => `${t.name} ${t.description ?? ""}`.toLowerCase().includes(needle));
}

/** The search box above a template list. */
export function TemplateSearch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        id={id}
        data-autofocus
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="input w-full pl-9"
      />
    </div>
  );
}

/**
 * A list to choose one template from, as a set of pressed/unpressed buttons:
 * each names the template, says whether it is a system template or the
 * organisation's, and gives its description. `extra` goes first (e.g. "Blank form").
 */
export function TemplateChoices({
  templates,
  selected,
  onSelect,
  label,
  extra,
  empty,
}: {
  templates: readonly TemplateSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
  label: string;
  extra?: React.ReactNode;
  empty: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId}>
      <span id={headingId} className="sr-only">
        {label}
      </span>
      <ul className="flex flex-col gap-1">
        {extra}
        {templates.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              aria-pressed={selected === t.id}
              onClick={() => onSelect(t.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                selected === t.id ? "border-accent bg-accent-weak" : "border-transparent hover:bg-surface-2"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                <span className="flex-none rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                  {t.scope === "system" ? "System" : "Yours"}
                </span>
              </span>
              {t.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{t.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      {templates.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted">{empty}</div>}
    </div>
  );
}
