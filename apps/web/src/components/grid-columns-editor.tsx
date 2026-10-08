"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import {
  GRID_COLUMN_TYPE_LABELS,
  GRID_COLUMN_TYPES,
  isChoiceColumn,
  type GridColumn,
  type GridColumnType,
  type OptionProblem,
} from "@formbuilder/form-schema";
import { OptionRow, type RowHandlers } from "./option-list-editor";

/**
 * The inspector's editor for a grid's columns (contract §14.6). Each column
 * has its code and label — the option editor's own row, so both behave the
 * same way (§13.8) — then its type, a Required switch, Move up / Move down,
 * and, for radio and dropdown, its own option editor (`renderOptions`).
 * Columns can't be imported from a file. The editor page owns the rules: it
 * asks before a choice column becomes text, and fills an empty code when a
 * changed label is left. The note about changing codes is the page's, once
 * for the whole grid (`noteId`). Everything shown here is plain text.
 */
export function GridColumnsEditor({
  columns,
  problems,
  noteId,
  onAdd,
  onMove,
  onType,
  onRequired,
  renderOptions,
  ...handlers
}: RowHandlers & {
  columns: readonly GridColumn[];
  /** The columns list's problems, from the save rules (`optionListProblems`, list "columns"). */
  problems: readonly OptionProblem[];
  /** The grid's one note about changing codes, which the code fields point at (shown by the page). */
  noteId: string;
  onAdd: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  /** Change column `index`'s type; the page may ask first. */
  onType: (index: number, type: GridColumnType) => void;
  onRequired: (index: number, required: boolean) => void;
  /** Column `index`'s own option editor (radio and dropdown only). */
  renderOptions: (index: number) => ReactNode;
}) {
  const root = useRef<HTMLFieldSetElement>(null);
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
  const problemAt = (i: number, field: "code" | "label") =>
    problems.find((p) => p.index === i && p.field === field)?.detail;
  // After the page re-renders: put focus back on a control by id (columns are keyed by position).
  const refocus = (id: string, fallback?: string) =>
    requestAnimationFrame(() => {
      const el = root.current?.querySelector<HTMLElement>(`#${id}`);
      const target = el && !(el as HTMLButtonElement).disabled ? el : fallback ? root.current?.querySelector<HTMLElement>(`#${fallback}`) : null;
      target?.focus();
    });

  return (
    <fieldset ref={root} className="mb-4 min-w-0">
      <legend className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Columns</legend>
      {listProblem && (
        <p role="alert" className="mb-1.5 text-xs text-red">
          {listProblem.detail}
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {columns.map((column, i) => {
          const name = column.label.trim() || `Column ${i + 1}`;
          const base = `grid-col-${i}`;
          return (
            <div
              key={i}
              role="group"
              aria-labelledby={`${base}-heading`}
              data-grid-column={i}
              className="rounded-lg border border-line bg-surface-2 p-2.5"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span id={`${base}-heading`} className="text-[11px] font-bold uppercase tracking-wider text-faint">
                  Column {i + 1}
                </span>
                <div className="flex gap-0.5">
                  {([-1, 1] as const).map((direction) => {
                    const id = `${base}-move-${direction === -1 ? "up" : "down"}`;
                    const to = i + direction;
                    return (
                      <button
                        key={direction}
                        id={id}
                        type="button"
                        disabled={to < 0 || to >= columns.length}
                        onClick={() => {
                          onMove(i, direction);
                          // Follow the column to its new place; at an end, the other arrow.
                          refocus(`grid-col-${to}-move-${direction === -1 ? "up" : "down"}`, `grid-col-${to}-move-${direction === -1 ? "down" : "up"}`);
                        }}
                        aria-label={`Move column ${i + 1} ${direction === -1 ? "up" : "down"}`}
                        className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-ink disabled:opacity-30"
                      >
                        {direction === -1 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <OptionRow
                idPrefix="grid-columns"
                noteId={noteId}
                noun="column"
                index={i}
                label={column.label}
                code={column.code}
                labelError={problemAt(i, "label")}
                codeError={problemAt(i, "code")}
                handlers={stable}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <select
                  id={`${base}-type`}
                  aria-label={`Column ${i + 1} type`}
                  value={column.type}
                  onChange={(e) => {
                    onType(i, e.target.value as GridColumnType);
                    // A confirmation may have taken focus; it comes back here, whatever the answer.
                    refocus(`${base}-type`);
                  }}
                  className="min-w-0 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-weak"
                >
                  {GRID_COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {GRID_COLUMN_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <span className="flex items-center gap-2 text-[13px]">
                  <span aria-hidden>Required</span>
                  <button
                    id={`${base}-required`}
                    type="button"
                    role="switch"
                    aria-checked={!!column.required}
                    aria-label={`Required — ${name}`}
                    onClick={() => onRequired(i, !column.required)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${column.required ? "bg-accent" : "bg-line-2"}`}
                  >
                    <span
                      // left-0: without it the knob starts from the button's centre and ends up outside the track.
                      className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform ${column.required ? "translate-x-[18px]" : "translate-x-0.5"}`}
                    />
                  </button>
                </span>
              </div>
              {isChoiceColumn(column) && <div className="mt-2.5">{renderOptions(i)}</div>}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 self-start text-sm font-medium text-accent-2 hover:underline"
        >
          <Plus className="h-4 w-4" /> Add column
        </button>
      </div>
    </fieldset>
  );
}
