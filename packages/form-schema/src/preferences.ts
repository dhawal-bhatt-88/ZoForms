/*
 * Author preferences — builder only. They belong to a user account, not to a
 * form, so none of this is in the contract and the renderer never sees it. The
 * API stores them on the user and sends them with the signed-in user
 * (`GET /v1/auth/me`); the editor reads them from there.
 */
import { z } from "zod";

/** The editor's settings pane: its width in px until the author resizes it. */
export const SETTINGS_PANE_DEFAULT_WIDTH = 300;
/** The narrowest the author can make it, in px. Wins over the maximum on a small screen. */
export const SETTINGS_PANE_MIN_WIDTH = 280;
/** The widest the author can make it, as a share of the viewport's width. */
export const SETTINGS_PANE_MAX_SHARE = 0.5;
/** One Left or Right arrow press on the pane's handle, in px. */
export const SETTINGS_PANE_KEY_STEP = 16;

/**
 * A stored width is a whole number of px in this range, or null for "the
 * default". The range is wider than any screen's limits: a width is checked
 * against the screen when it is used, not when it is saved.
 */
export const STORED_PANE_WIDTH_MIN = 200;
export const STORED_PANE_WIDTH_MAX = 4000;

/** The pane's limits on a viewport this wide: at most half of it, but never under the minimum. */
export function settingsPaneLimits(viewportWidth: number): { min: number; max: number } {
  const min = SETTINGS_PANE_MIN_WIDTH;
  return { min, max: Math.max(min, Math.floor(viewportWidth * SETTINGS_PANE_MAX_SHARE)) };
}

/**
 * The width to show: the saved one (or the default when there is none) held
 * within this viewport's limits, since the screen may differ from the one it
 * was saved on.
 */
export function settingsPaneWidth(saved: number | null | undefined, viewportWidth: number): number {
  const { min, max } = settingsPaneLimits(viewportWidth);
  const width = typeof saved === "number" && Number.isFinite(saved) ? saved : SETTINGS_PANE_DEFAULT_WIDTH;
  return Math.round(Math.min(max, Math.max(min, width)));
}

const paneWidthMessage = `settingsPaneWidth must be a whole number of pixels from ${STORED_PANE_WIDTH_MIN} to ${STORED_PANE_WIDTH_MAX}, or null.`;

const preferencesPatch = z
  .object({
    settingsPaneWidth: z
      .number({ invalid_type_error: paneWidthMessage, required_error: paneWidthMessage })
      .int(paneWidthMessage)
      .min(STORED_PANE_WIDTH_MIN, paneWidthMessage)
      .max(STORED_PANE_WIDTH_MAX, paneWidthMessage)
      .nullable(),
  })
  .strict();

export type PreferencesPatch = z.infer<typeof preferencesPatch>;

/**
 * Checks a request to change the signed-in author's preferences. `null`
 * clears the width, so the pane follows the default, even if the default
 * changes later.
 */
export function parsePreferencesPatch(body: unknown): { ok: true; value: PreferencesPatch } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Send an object: { settingsPaneWidth }." };
  }
  const result = preferencesPatch.safeParse(body);
  if (result.success) return { ok: true, value: result.data };
  const issue = result.error.issues[0];
  if (issue.code === "unrecognized_keys") return { ok: false, message: `Unknown preference: ${issue.keys.join(", ")}.` };
  return { ok: false, message: issue.message };
}
