"use client";

import { useMemo, useState } from "react";
import {
  canApplyImport,
  previewImport,
  type ImportMode,
  type ImportPreviewRow,
  type Option,
  type ParsedImport,
} from "@formbuilder/form-schema";

/**
 * The preview before options are imported from a file (contract §13.9). Every
 * row shows its code — as given, or generated — and its label, with any flags.
 * Apply stays disabled while a row is flagged: the author fixes the file and
 * chooses it again. Nothing is stored until the form is saved.
 */
export function OptionImportDialog({
  fileName,
  plural,
  parsed,
  existing,
  owner,
  onApply,
  onClose,
}: {
  fileName: string;
  /** The list, lower case: "options", "rows" or "columns". */
  plural: string;
  /** Whose list, when it isn't the block's own: a grid column, e.g. `column 2 ("Frequency")`. Plain text. */
  owner?: string;
  parsed: ParsedImport;
  existing: readonly Option[];
  onApply: (mode: ImportMode, preview: ImportPreviewRow[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ImportMode>("add");
  const preview = useMemo(
    () => (parsed.ok ? previewImport(parsed.rows, existing, mode) : []),
    [parsed, existing, mode],
  );
  const flagged = preview.filter((r) => r.flags.length).length;
  const canApply = canApplyImport(preview);
  const blocked = !parsed.ok
    ? null
    : preview.length === 0
      ? `The file has no ${plural}.`
      : flagged
        ? `${flagged === 1 ? "1 row is" : `${flagged} rows are`} flagged. Fix the file, then choose it again.`
        : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id="import-title" className="text-base font-semibold">
          Import {plural}
          {owner ? ` for ${owner}` : ""} from “{fileName}”
        </h2>

        {!parsed.ok ? (
          <p role="alert" className="mt-2 text-sm text-red">
            {parsed.message}
          </p>
        ) : (
          <>
            <fieldset className="mt-3 flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">How to import</legend>
              {(
                [
                  ["add", `Add to existing ${plural}`],
                  ["replace", `Replace all ${plural}`],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="import-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    autoFocus={value === "add"}
                    className="accent-brand-deep"
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            <p className="mt-2 text-xs text-muted" aria-live="polite">
              {preview.length} {preview.length === 1 ? "row" : "rows"}
              {flagged ? ` · ${flagged} flagged` : ""}
              {mode === "replace" ? ` · replaces the ${existing.length} current ${plural}` : ""}
            </p>
            {parsed.hint && <p className="mt-1.5 text-xs text-warn">{parsed.hint}</p>}
            <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Rows read from the file</caption>
                <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wider text-faint">
                  <tr>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Line</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Code</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Label</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.line} data-flagged={r.flags.length > 0 || undefined} className="border-t border-line align-top data-[flagged]:bg-fail-wash">
                      <td className="px-2 py-1 tabular-nums text-muted">{r.line}</td>
                      <td className="px-2 py-1 font-mono">
                        {r.code}
                        {r.generated && <span className="ml-1 font-sans text-faint">(generated)</span>}
                      </td>
                      <td className="whitespace-pre-wrap break-words px-2 py-1">{r.label}</td>
                      <td className="px-2 py-1 text-red">{r.flags.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {blocked && (
          <p id="import-blocked" className="mt-2 text-sm text-red">
            {blocked}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-outline btn-sm" autoFocus={!parsed.ok}>
            Cancel
          </button>
          {parsed.ok && (
            <button
              onClick={() => onApply(mode, preview)}
              disabled={!canApply}
              aria-describedby={blocked ? "import-blocked" : undefined}
              className="btn btn-primary btn-sm disabled:opacity-40"
            >
              {mode === "add" ? `Add ${preview.length}` : `Replace with ${preview.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
