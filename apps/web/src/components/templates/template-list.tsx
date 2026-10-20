"use client";

import { useId } from "react";
import { Search } from "lucide-react";
import { Input, StatusChip } from "@/components/ui";
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
      <Search aria-hidden="true" strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite-soft" />
      <Input
        id={id}
        data-autofocus
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        controlSize="sm"
        className="pl-8"
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
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${
                selected === t.id ? "border-brand-deep bg-accent-wash" : "border-transparent hover:bg-paper-sunk"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-ink">{t.name}</span>
                <StatusChip className="flex-none">{t.scope === "system" ? "System" : "Yours"}</StatusChip>
              </span>
              {t.description && <span className="mt-0.5 line-clamp-2 block text-[0.75rem] text-graphite">{t.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      {templates.length === 0 && <div className="body-sm px-3 py-6 text-center text-graphite">{empty}</div>}
    </div>
  );
}
