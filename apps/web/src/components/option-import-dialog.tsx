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
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui";

/**
 * The preview before options are imported from a file (contract §13.9). Every
 * row shows its code — as given, or generated — and its label, with any flags.
 * Apply is blocked while a row is flagged, with the reason under it: the author
 * fixes the file and chooses it again. Nothing is stored until the form is
 * saved. On the shared `Dialog`, so focus moves in, stays in and comes back.
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
    <Dialog
      title={`Import ${plural}${owner ? ` for ${owner}` : ""} from “${fileName}”`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button size="sm" onClick={onClose} data-autofocus={!parsed.ok || undefined}>
            Cancel
          </Button>
          {parsed.ok && (
            <Button variant="primary" size="sm" onClick={() => onApply(mode, preview)} reason={canApply ? undefined : (blocked ?? `Nothing to import.`)}>
              {mode === "add" ? `Add ${preview.length}` : `Replace with ${preview.length}`}
            </Button>
          )}
        </>
      }
    >
      {!parsed.ok ? (
        <p role="alert" className="text-[0.8125rem] text-fail">
          {parsed.message}
        </p>
      ) : (
        <>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] text-ink">
            <legend className="sr-only">How to import</legend>
            {(
              [
                ["add", `Add to existing ${plural}`],
                ["replace", `Replace all ${plural}`],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="import-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  data-autofocus={value === "add" || undefined}
                  className="h-4 w-4 accent-brand-deep"
                />
                {text}
              </label>
            ))}
          </fieldset>
          <p className="tabular mt-2 text-[0.75rem] text-graphite" aria-live="polite">
            {preview.length} {preview.length === 1 ? "row" : "rows"}
            {flagged ? ` · ${flagged} flagged` : ""}
            {mode === "replace" ? ` · replaces the ${existing.length} current ${plural}` : ""}
          </p>
          {parsed.hint && <p className="mt-1.5 text-[0.75rem] text-warn">{parsed.hint}</p>}
          <div className="surface scroll-x relative mt-3 max-h-[50vh] overflow-auto">
            <table className="w-full text-left text-[0.75rem]">
              <caption className="sr-only">Rows read from the file</caption>
              <thead className="sticky top-0 bg-paper-sunk">
                <tr>
                  {["Line", "Code", "Label", "Problem"].map((h) => (
                    <th key={h} scope="col" className="border-b border-rule px-3 py-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.11em] text-graphite-soft">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.line} data-flagged={r.flags.length > 0 || undefined} className="border-t border-rule align-top data-[flagged]:bg-fail-wash">
                    <td className="tabular px-3 py-1.5 text-graphite">{r.line}</td>
                    <td className="px-3 py-1.5 font-mono text-ink">
                      {r.code}
                      {r.generated && <span className="ml-1 font-sans text-graphite-soft">(generated)</span>}
                    </td>
                    <td className="whitespace-pre-wrap break-words px-3 py-1.5 text-ink">{r.label}</td>
                    <td className="px-3 py-1.5 text-fail">{r.flags.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
}
