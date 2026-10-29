"use client";

import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { Button, Callout } from "@/components/ui";

/*
 * Save was refused because the form was saved again after this editor opened
 * it, in another tab or by a teammate (409 VERSION_CONFLICT). Nothing was
 * saved. The author chooses: take the latest version and lose these edits, or
 * save these edits on top of it, as the next version. Either way nothing is
 * lost for good: every version stays in version history.
 *
 * - Focus starts on Keep editing, so a stray Enter changes nothing.
 * - Escape, the backdrop and Keep editing close it with the edits kept, unsaved.
 */
export function StaleSaveDialog({
  base,
  latest,
  onLoadLatest,
  onSaveMine,
  onClose,
}: {
  /** The version this editor started from. */
  base: number;
  /** The latest version, saved since. */
  latest: number;
  onLoadLatest: () => Promise<void>;
  onSaveMine: () => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<"load" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(which: "load" | "save", action: () => Promise<void>) {
    setPending(which);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog
      role="alertdialog"
      title="This form changed since you opened it"
      description={`Version ${latest} was saved after you started editing from version ${base}, in another tab or by a teammate.`}
      onClose={onClose}
      busy={pending !== null}
      width="max-w-xl"
      footer={
        <>
          <Button data-autofocus onClick={() => pending === null && onClose()} aria-disabled={pending !== null || undefined}>
            Keep editing
          </Button>
          <Button onClick={() => run("load", onLoadLatest)} pending={pending === "load"} aria-disabled={pending === "save" || undefined}>
            Load the latest version
          </Button>
          <Button variant="primary" onClick={() => run("save", onSaveMine)} pending={pending === "save"} aria-disabled={pending === "load" || undefined}>
            Save mine as a new version
          </Button>
        </>
      }
    >
      <dl className="space-y-3 text-[0.875rem]">
        <div>
          <dt className="font-medium text-ink">Load the latest version</dt>
          <dd className="text-graphite">Your unsaved edits here will be lost.</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Save mine as a new version</dt>
          <dd className="text-graphite">Becomes version {latest + 1}. The other changes stay in version history.</dd>
        </div>
      </dl>
      {error && (
        <Callout role="alert" tone="fail" title="Couldn't finish" className="mt-4">
          {error}
        </Callout>
      )}
    </Dialog>
  );
}
