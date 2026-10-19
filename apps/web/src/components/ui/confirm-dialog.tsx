"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, type ButtonVariant } from "./button";
import { Callout } from "./callout";

/*
 * A confirmation that states its consequence before it accepts one.
 *
 * The rules come from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/components/ui/ConfirmSubmit.tsx: say what happens, to whom, and
 * what can't be undone (a confirmation without a consequence is "Are you
 * sure?"), and the confirm button repeats the action's own name. Adapted to a
 * modal on the builder's `Dialog`, as an `alertdialog`, because these actions
 * run from menus and table rows rather than from a form ZoBlocks can arm in
 * place.
 *
 * - Focus starts on Cancel, so a second Enter can't confirm by accident.
 * - Escape, the backdrop and Cancel close it and focus returns to the opener
 *   (`Dialog`); not while the action is running.
 * - A failure stays in the dialog as `role="alert"`, because a live region
 *   outside a modal dialog may not be announced. Success closes it; the
 *   caller raises the toast.
 * - `danger` is the wash and the word, never a filled red.
 */
export function ConfirmDialog({
  title,
  consequence,
  confirmLabel,
  variant = "danger",
  onConfirm,
  onClose,
}: {
  title: string;
  /** What actually happens: to whom, and what can't be undone. */
  consequence: string;
  /** The action's name, e.g. "Delete form". */
  confirmLabel: string;
  variant?: ButtonVariant;
  /** Runs the action. Throw to keep the dialog open with the message. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <Dialog
      role="alertdialog"
      title={title}
      description={
        <span className="flex items-start gap-1.5">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          {consequence}
        </span>
      }
      onClose={onClose}
      busy={pending}
      width="max-w-md"
      footer={
        <>
          <Button data-autofocus onClick={() => !pending && onClose()} aria-disabled={pending || undefined}>
            Cancel
          </Button>
          <Button variant={variant} onClick={confirm} pending={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <Callout role="alert" tone="fail" title={`Couldn't ${confirmLabel.toLowerCase()}`}>
          {error}
        </Callout>
      )}
    </Dialog>
  );
}
