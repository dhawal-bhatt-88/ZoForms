"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { StatusChip } from "@/components/ui";

export type SaveState = "saving" | "dirty" | "saved";

/** The chip's words. "All changes saved", not "Saved": "saved" is also inside "Unsaved changes". */
export const SAVE_STATE_TEXT: Record<SaveState, string> = {
  saving: "Saving…",
  dirty: "Unsaved changes",
  saved: "All changes saved",
};

/**
 * What a screen reader hears about saving: a save's outcome, once ("All
 * changes saved", "Changes discarded"), and nothing while the author types.
 *
 * The chip itself isn't a live region, because it changes on every first
 * keystroke after a save. The outcome goes into a separate polite region
 * instead, and that region is emptied silently as soon as there are edits
 * again, so the next outcome is new content and is announced, even when it
 * is the same words. A failed save isn't announced here: its critical
 * notice is an alert.
 */
export function useSaveAnnouncement(dirty: boolean) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (dirty) setText("");
  }, [dirty]);
  const announce = useCallback((message: string) => setText(message), []);
  return { text, announce };
}

/**
 * The editor's save state as a chip with a word, always, and the region that
 * announces outcomes (`useSaveAnnouncement`).
 */
export function SaveStatus({ state, announcement }: { state: SaveState; announcement: string }) {
  return (
    <>
      <span data-save-state={state} className="flex-none">
        <StatusChip
          tone={state === "dirty" ? "warn" : state === "saved" ? "pass" : "neutral"}
          icon={
            state === "saving" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : state === "saved" ? (
              <Check className="h-3 w-3" strokeWidth={2.5} />
            ) : undefined
          }
        >
          {SAVE_STATE_TEXT[state]}
        </StatusChip>
      </span>
      <span role="status" aria-live="polite" className="sr-only" data-save-announcement>
        {announcement}
      </span>
    </>
  );
}
