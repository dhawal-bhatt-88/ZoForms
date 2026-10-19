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
import { Switch } from "./switch";
import { Button, Select } from "./ui";

/**
 * The inspector's editor for a grid's columns (contract §14.6). Each column
 * has its code and label — the option editor's own row, so both behave the
 * same way (§13.8) — then its type, a Required switch, Move up / Move down,
 * and, for radio and dropdown, its own option editor (`renderOptions`).
 * Columns can't be imported from a file. The editor page owns the rules: it
 * asks before a choice column becomes text (a `ConfirmDialog`, which puts
 * focus back on the type select whatever the answer), and fills an empty code when a
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
      <legend className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Columns</legend>
      {listProblem && (
        <p role="alert" data-field-error className="mb-1.5 text-[0.75rem] text-fail">
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
              className="rounded-lg border border-rule bg-paper-sunk p-2.5"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span id={`${base}-heading`} className="eyebrow text-graphite-soft">
                  Column {i + 1}
                </span>
                <div className="flex gap-0.5">
                  {([-1, 1] as const).map((direction) => {
                    const id = `${base}-move-${direction === -1 ? "up" : "down"}`;
                    const to = i + direction;
                    return (
                      <Button
                        key={direction}
                        id={id}
                        variant="ghost"
                        size="icon"
                        disabled={to < 0 || to >= columns.length}
                        onClick={() => {
                          onMove(i, direction);
                          // Follow the column to its new place; at an end, the other arrow.
                          refocus(`grid-col-${to}-move-${direction === -1 ? "up" : "down"}`, `grid-col-${to}-move-${direction === -1 ? "down" : "up"}`);
                        }}
                        aria-label={`Move column ${i + 1} ${direction === -1 ? "up" : "down"}`}
                        className="text-graphite hover:text-ink"
                      >
                        {direction === -1 ? <ArrowUp aria-hidden="true" className="h-4 w-4" /> : <ArrowDown aria-hidden="true" className="h-4 w-4" />}
                      </Button>
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
                <Select
                  size="sm"
                  id={`${base}-type`}
                  aria-label={`Column ${i + 1} type`}
                  value={column.type}
                  onChange={(e) => onType(i, e.target.value as GridColumnType)}
                  wrapperClassName="min-w-0 flex-1"
                >
                  {GRID_COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {GRID_COLUMN_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
                <span className="flex flex-none items-center gap-2 text-[0.8125rem] font-medium">
                  <span aria-hidden>Required</span>
                  <Switch
                    id={`${base}-required`}
                    checked={!!column.required}
                    aria-label={`Required — ${name}`}
                    onChange={(on) => onRequired(i, on)}
                  />
                </span>
              </div>
              {isChoiceColumn(column) && <div className="mt-2.5">{renderOptions(i)}</div>}
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={onAdd} className="-ml-2.5 self-start">
          <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add column
        </Button>
      </div>
    </fieldset>
  );
}
