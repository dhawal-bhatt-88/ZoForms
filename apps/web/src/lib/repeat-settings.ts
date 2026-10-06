/*
 * Pure helpers for a repeating group in the editor (contract §12): the canvas
 * badge, the inspector's preview of what the respondent sees, and reading the
 * entry-count fields. The rules themselves live in form-schema.
 */

import { REPEAT_DEFAULTS, type GroupBlock } from "@formbuilder/form-schema";

/** The canvas badge on a repeating group: "Repeats · 1–3", "Repeats · 0 or more", "Repeats · exactly 2". */
export function repeatBadgeText(group: Pick<GroupBlock, "minOccurs" | "maxOccurs">): string {
  const min = group.minOccurs ?? REPEAT_DEFAULTS.minOccurs;
  const max = group.maxOccurs;
  if (max === undefined) return `Repeats · ${min} or more`;
  if (max === min) return `Repeats · exactly ${min}`;
  return `Repeats · ${min}–${max}`;
}

/**
 * The respondent-facing text for one entry, as the renderer writes it (§12.2,
 * §12.6): "Patient 1 · Add another patient · Remove patient 1". `repeatLabel`
 * is used verbatim, with its first character upper-cased in the heading. Null
 * while the name is blank.
 */
export function repeatPreviewText(repeatLabel: string | undefined): string | null {
  if (!repeatLabel?.trim()) return null;
  const heading = repeatLabel.charAt(0).toUpperCase() + repeatLabel.slice(1);
  return `${heading} 1 · Add another ${repeatLabel} · Remove ${repeatLabel} 1`;
}

/**
 * An entry-count field's value as stored: blank is "not set" (the default
 * minimum, or no maximum); anything else is kept as typed, even a fraction or a
 * negative number, so the save rule can show its message under the field.
 */
export function parseCount(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isNaN(n) ? undefined : n;
}
