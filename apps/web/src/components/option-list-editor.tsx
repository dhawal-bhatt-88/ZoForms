"use client";

import { memo, useMemo, useRef } from "react";
import { Plus, Upload, X } from "lucide-react";
import type { Option, OptionProblem } from "@formbuilder/form-schema";
import { cn } from "@formbuilder/ui";
import { Button, controlClasses } from "@/components/ui";

export type RowHandlers = {
  onLabel: (index: number, label: string) => void;
  /** Called only when the label field is left after its label was changed (contract §13.3). */
  onLabelLeave: (index: number) => void;
  onCode: (index: number, code: string) => void;
  onCodeFocus: (index: number) => void;
  onCodeLeave: (index: number) => void;
  onRemove: (index: number) => void;
  /** An option's score (contract §17.1): a number, or undefined when the field is cleared. */
  onScore?: (index: number, score: number | undefined) => void;
};

/**
 * The inspector's editor for one coded list (contract §13): a block's options,
 * a matrix's rows or columns, a grid's rows, or one grid column's options.
 * Each option has a code, then a label.
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
  owner,
  sharedNoteId,
  showScores = false,
  onAdd,
  onImportFile,
  ...handlers
}: RowHandlers & {
  /** Unique on the page, for element ids: "options", "columns", "rows", or one per grid column. */
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
  /**
   * Whose list this is, when the inspector shows several of the same kind — a
   * grid column's options: "column 2". Added to every control's accessible
   * name, so each one says which column it belongs to.
   */
  owner?: string;
  /**
   * The id of a note about changing codes shown elsewhere, once for several
   * lists (a grid's rows and all its columns). This editor then doesn't show
   * its own, and its code fields point at that one. Absent: it shows its own.
   */
  sharedNoteId?: string;
  /**
   * Show a Score field on each option (contract §17.9): for the options of a
   * choice, dropdown, checkbox or multiselect, or a matrix's columns, while the
   * question is within reach of a scored group. Scores stay when it isn't.
   */
  showScores?: boolean;
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
      onScore: (i, v) => latest.current.onScore?.(i, v),
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
      <legend className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
        {heading}
        {owner && <span className="sr-only"> for {owner}</span>}
      </legend>
      {listProblem && (
        <p role="alert" data-field-error className="mb-1.5 text-[0.75rem] text-fail">
          {listProblem.detail}
        </p>
      )}
      {options.length > 0 && (
        <div className="eyebrow mb-1 flex gap-1.5 pr-[38px] text-graphite-soft" aria-hidden>
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
            owner={owner}
            noteId={sharedNoteId}
            index={i}
            label={o.label}
            code={o.code}
            score={showScores ? o.score : undefined}
            showScore={showScores}
            labelError={byRow.get(`${i}:label`)}
            codeError={byRow.get(`${i}:code`)}
            scoreError={byRow.get(`${i}:score`)}
            handlers={stable}
          />
        ))}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Button variant="ghost" size="sm" onClick={onAdd} className="-ml-2.5">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add {noun}
            {/* Words, not punctuation: browsers may put a space before an out-of-flow span. */}
            {owner && <span className="sr-only"> to {owner}</span>}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()} className="-ml-2.5">
            {/* The visible text starts the accessible name (WCAG 2.5.3); the list tells a matrix's two apart. */}
            <Upload aria-hidden="true" className="h-3.5 w-3.5" /> Import from file
            <span className="sr-only">
              {" "}
              into {heading.toLowerCase()}
              {owner ? ` for ${owner}` : ""}
            </span>
          </Button>
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
      {!sharedNoteId && <CodeChangeNote id={`${idPrefix}-note`} />}
      <p role="status" aria-live="polite" className="mt-1 text-[0.75rem] text-ink">
        {status}
      </p>
    </fieldset>
  );
}

/** The standing note under code fields (contract §13.8). */
export function CodeChangeNote({ id, className = "mt-2" }: { id: string; className?: string }) {
  return (
    <p id={id} className={`${className} text-[0.75rem] text-graphite`}>
      Changing a code after the form is in use will not match answers already stored under the old code.
    </p>
  );
}

/**
 * A row's field: the kit's control at table size. `leading-5` on every field
 * keeps code, label and score one height, though the code and score text is
 * smaller than the label's. It goes last: a font size after it would drop it
 * (tailwind-merge reads a size as setting the line height too).
 */
const field = (invalid: boolean, className: string) =>
  controlClasses({ size: "sm", invalid, className: cn("min-w-0", className, "leading-5") });

/**
 * One option: code, label, remove. Re-renders only when its own values or
 * messages change. Also a grid column's code and label (the columns editor),
 * so both behave the same way.
 */
export const OptionRow = memo(function OptionRow({
  idPrefix,
  noun,
  owner,
  noteId,
  index: i,
  label,
  code,
  score,
  showScore = false,
  labelError,
  codeError,
  scoreError,
  handlers: h,
}: {
  idPrefix: string;
  noun: string;
  /** See OptionListEditor's `owner`. */
  owner?: string;
  /** The note the code field points at; by default the list's own (`{idPrefix}-note`). */
  noteId?: string;
  index: number;
  label: string;
  code: string;
  /** The option's score, when the Score field is shown (contract §17.9). */
  score?: number;
  showScore?: boolean;
  labelError?: string;
  codeError?: string;
  scoreError?: string;
  handlers: RowHandlers;
}) {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const base = `${idPrefix}-${i}`;
  const of = owner ? `, ${owner}` : "";
  // The label when its field gained focus: leaving it generates a code only if the
  // label was changed meanwhile, so tabbing past an untouched placeholder ("Option 3")
  // generates nothing (contract §13.3).
  const labelAtFocus = useRef<string | null>(null);
  return (
    <div>
      {/*
        Code first, then label, as in import files (contract §13.8). The DOM order is
        the visual and the tab order: code, label, score, remove. The code field is a
        fixed-width slot (flex-none), so a code generated on leaving the label changes
        neither the layout nor focus. The label grows to fill the row from a minimum
        of 8rem; with a score (contract §17.9), the fixed-width score shares the
        label's line while both fit and wraps below the label when they don't. That
        depends only on the room there is, so no breakpoint. The row's other controls
        stay on the first line.
      */}
      <div className="flex items-start gap-1.5">
        <input
          id={`${base}-code`}
          aria-label={`${Noun} ${i + 1} code${of}`}
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
          aria-describedby={[codeError ? `${base}-code-error` : "", noteId ?? `${idPrefix}-note`].filter(Boolean).join(" ")}
          // Mono: a code is an identifier, compared down the column.
          className={field(!!codeError, "w-24 flex-none font-mono text-[0.75rem]")}
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
          <input
            id={`${base}-label`}
            aria-label={`${Noun} ${i + 1} label${of}`}
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
            // Grows from 8rem; narrower only when the pane is (min-w-0 keeps it inside the row).
            className={field(!!labelError, "w-auto flex-[1_1_8rem]")}
          />
          {showScore && (
            <div data-score className="flex flex-none items-center gap-1.5">
              <label htmlFor={`${base}-score`} className="text-[0.75rem] font-medium text-graphite">
                Score
              </label>
              <input
                id={`${base}-score`}
                type="number"
                step="any"
                inputMode="decimal"
                // Starts with the visible "Score" (WCAG 2.5.3) and says which option, as every row has one.
                aria-label={`Score for ${noun} ${i + 1}${of}`}
                // A stored value that isn't a number (sent through the API) shows empty; its message says why.
                value={typeof score === "number" ? score : ""}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  h.onScore?.(i, e.target.value === "" || !Number.isFinite(n) ? undefined : n);
                }}
                aria-invalid={!!scoreError}
                aria-describedby={scoreError ? `${base}-score-error` : undefined}
                // About 6 characters wide. text-xs, as the code field: at text-sm in
                // Instrument Sans, "Score" and the field outgrow the label at the
                // narrowest pane. leading-5 keeps the fields one height.
                className={field(!!scoreError, "w-[calc(6ch+1.25rem)] flex-none px-2 text-[0.75rem] tabular-nums")}
              />
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => h.onRemove(i)}
          // Centred on the fields' line, wherever the score is.
          className="h-8 w-8 flex-none text-graphite hover:text-ink"
          aria-label={`Remove ${noun} ${i + 1}${of}`}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
      {codeError && (
        <p id={`${base}-code-error`} role="alert" data-field-error className="mt-1 text-[0.75rem] text-fail">
          {codeError}
        </p>
      )}
      {labelError && (
        <p id={`${base}-label-error`} role="alert" data-field-error className="mt-1 text-[0.75rem] text-fail">
          {labelError}
        </p>
      )}
      {scoreError && (
        <p id={`${base}-score-error`} role="alert" data-field-error className="mt-1 text-[0.75rem] text-fail">
          {scoreError}
        </p>
      )}
    </div>
  );
});
