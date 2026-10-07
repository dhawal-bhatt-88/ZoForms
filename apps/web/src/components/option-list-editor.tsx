"use client";

import { memo, useMemo, useRef } from "react";
import { Plus, Upload, X } from "lucide-react";
import type { Option, OptionProblem } from "@formbuilder/form-schema";

type RowHandlers = {
  onLabel: (index: number, label: string) => void;
  /** Called only when the label field is left after its label was changed (contract §13.3). */
  onLabelLeave: (index: number) => void;
  onCode: (index: number, code: string) => void;
  onCodeFocus: (index: number) => void;
  onCodeLeave: (index: number) => void;
  onRemove: (index: number) => void;
};

/**
 * The inspector's editor for one coded list (contract §13): a block's options,
 * a matrix's rows, or a matrix's columns. Each option has a code, then a label.
 * The editor page owns the rules: it fills an empty code when the label field
 * is left after a change, rewrites conditions when a code changes, and refuses removing an
 * option a condition uses. Everything shown here is plain text.
 *
 * Lists have no size limit (§13.9), so each row is memoised: typing in one
 * re-renders that row, not all of them.
 */
export function OptionListEditor({
  idPrefix,
  heading,
  noun,
  options,
  problems,
  status,
  onAdd,
  onImportFile,
  ...handlers
}: RowHandlers & {
  /** Unique on the page, for element ids: "options" or "columns". */
  idPrefix: string;
  /** "Options", "Rows" or "Columns". */
  heading: string;
  /** One entry, lower case: "option", "row" or "column". */
  noun: string;
  options: readonly Option[];
  /** This list's problems, from the save rules (`optionListProblems`). */
  problems: readonly OptionProblem[];
  /** "2 conditions updated to use …", announced politely. */
  status: string | null;
  onAdd: () => void;
  /** A .csv or .txt file the author chose; it is read in the browser, never uploaded (contract §13.9). */
  onImportFile: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  // The page passes new handler functions on every render; rows get stable ones that call the latest.
  const latest = useRef(handlers);
  latest.current = handlers;
  const stable = useMemo<RowHandlers>(
    () => ({
      onLabel: (i, v) => latest.current.onLabel(i, v),
      onLabelLeave: (i) => latest.current.onLabelLeave(i),
      onCode: (i, v) => latest.current.onCode(i, v),
      onCodeFocus: (i) => latest.current.onCodeFocus(i),
      onCodeLeave: (i) => latest.current.onCodeLeave(i),
      onRemove: (i) => latest.current.onRemove(i),
    }),
    [],
  );
  const listProblem = problems.find((p) => p.index === undefined);
  const byRow = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of problems) if (p.index !== undefined && p.field) map.set(`${p.index}:${p.field}`, p.detail);
    return map;
  }, [problems]);

  return (
    // min-w-0: a fieldset is min-content wide by default, which pushed the inspector sideways.
    <fieldset className="mb-4 min-w-0">
      <legend className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{heading}</legend>
      {listProblem && (
        <p role="alert" className="mb-1.5 text-xs text-red">
          {listProblem.detail}
        </p>
      )}
      {options.length > 0 && (
        <div className="mb-1 flex gap-1.5 pr-[38px] text-[11px] font-semibold uppercase tracking-wider text-faint" aria-hidden>
          <span className="w-24 flex-none">Code</span>
          <span className="flex-1">Label</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {options.map((o, i) => (
          <OptionRow
            key={i}
            idPrefix={idPrefix}
            noun={noun}
            index={i}
            label={o.label}
            code={o.code}
            labelError={byRow.get(`${i}:label`)}
            codeError={byRow.get(`${i}:code`)}
            handlers={stable}
          />
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 text-sm font-medium text-accent-2 hover:underline"
          >
            <Plus className="h-4 w-4" /> Add {noun}
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 text-sm font-medium text-accent-2 hover:underline"
          >
            {/* The visible text starts the accessible name (WCAG 2.5.3); the list tells a matrix's two apart. */}
            <Upload className="h-4 w-4" /> Import from file<span className="sr-only"> into {heading.toLowerCase()}</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // choosing the same file again (after fixing it) fires again
              if (file) onImportFile(file);
            }}
          />
        </div>
      </div>
      <p id={`${idPrefix}-note`} className="mt-2 text-xs text-muted">
        Changing a code after the form is in use will not match answers already stored under the old code.
      </p>
      <p role="status" aria-live="polite" className="mt-1 text-xs text-ink-2">
        {status}
      </p>
    </fieldset>
  );
}

const field =
  "min-w-0 rounded-lg border border-line-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak aria-[invalid=true]:border-red";

/** One option: code, label, remove. Re-renders only when its own values or messages change. */
const OptionRow = memo(function OptionRow({
  idPrefix,
  noun,
  index: i,
  label,
  code,
  labelError,
  codeError,
  handlers: h,
}: {
  idPrefix: string;
  noun: string;
  index: number;
  label: string;
  code: string;
  labelError?: string;
  codeError?: string;
  handlers: RowHandlers;
}) {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const base = `${idPrefix}-${i}`;
  // The label when its field gained focus: leaving it generates a code only if the
  // label was changed meanwhile, so tabbing past an untouched placeholder ("Option 3")
  // generates nothing (contract §13.3).
  const labelAtFocus = useRef<string | null>(null);
  return (
    <div>
      {/*
        Code first, then label, as in import files (contract §13.8). The DOM order is
        the visual and the tab order. The code field is a fixed-width slot (flex-none),
        so a code generated on leaving the label changes neither the layout nor focus.
      */}
      <div className="flex items-center gap-1.5">
        <input
          id={`${base}-code`}
          aria-label={`${Noun} ${i + 1} code`}
          value={code}
          placeholder="auto"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          onFocus={() => h.onCodeFocus(i)}
          onChange={(e) => h.onCode(i, e.target.value)}
          onBlur={() => h.onCodeLeave(i)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-invalid={!!codeError}
          aria-describedby={[codeError ? `${base}-code-error` : "", `${idPrefix}-note`].filter(Boolean).join(" ")}
          className={`${field} w-24 flex-none font-mono text-xs`}
        />
        <input
          id={`${base}-label`}
          aria-label={`${Noun} ${i + 1} label`}
          value={label}
          onChange={(e) => h.onLabel(i, e.target.value)}
          onFocus={() => {
            labelAtFocus.current = label;
          }}
          onBlur={() => {
            if (labelAtFocus.current !== null && label !== labelAtFocus.current) h.onLabelLeave(i);
            labelAtFocus.current = null;
          }}
          aria-invalid={!!labelError}
          aria-describedby={labelError ? `${base}-label-error` : undefined}
          className={`${field} flex-1`}
        />
        <button
          type="button"
          onClick={() => h.onRemove(i)}
          className="grid h-8 w-8 flex-none place-items-center rounded-lg text-faint hover:bg-surface-3 hover:text-ink"
          aria-label={`Remove ${noun} ${i + 1}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {codeError && (
        <p id={`${base}-code-error`} role="alert" className="mt-1 text-xs text-red">
          {codeError}
        </p>
      )}
      {labelError && (
        <p id={`${base}-label-error`} role="alert" className="mt-1 text-xs text-red">
          {labelError}
        </p>
      )}
    </div>
  );
});
