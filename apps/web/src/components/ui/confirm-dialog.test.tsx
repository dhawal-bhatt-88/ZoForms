// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

// jsdom has no layout, so `offsetParent` is always null; the dialog's focus
// trap uses it to skip hidden controls. Treat every element as laid out.
Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });

function Harness({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete…</button>
      {open && (
        <ConfirmDialog
          title={'Delete "Intake"?'}
          consequence="Removes the form and all its versions. This can't be undone."
          confirmLabel="Delete form"
          onConfirm={onConfirm}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

async function open(onConfirm = vi.fn(() => Promise.resolve())) {
  render(<Harness onConfirm={onConfirm} />);
  const opener = screen.getByRole("button", { name: "Delete…" });
  await userEvent.click(opener);
  return { opener, onConfirm, dialog: screen.getByRole("alertdialog") };
}

describe("ConfirmDialog", () => {
  it("is named by its title and described by its consequence", async () => {
    const { dialog } = await open();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe('Delete "Intake"?');
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toContain("can't be undone");
  });

  it("starts on Cancel, so a second Enter doesn't confirm", async () => {
    const { onConfirm } = await open();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Escape cancels and returns focus to the opener", async () => {
    const { opener, onConfirm } = await open();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it("keeps Tab inside the dialog", async () => {
    await open();
    const dialog = screen.getByRole("alertdialog");
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("confirms, closes and returns focus to the opener", async () => {
    const { opener, onConfirm } = await open();
    await userEvent.click(screen.getByRole("button", { name: "Delete form" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("can't be closed while the action runs", async () => {
    let finish!: () => void;
    await open(vi.fn(() => new Promise<void>((resolve) => (finish = resolve))));
    await userEvent.click(screen.getByRole("button", { name: "Delete form" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    finish();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("a failure stays in the dialog and is announced", async () => {
    await open(vi.fn(() => Promise.reject(new Error("The form is in use."))));
    await userEvent.click(screen.getByRole("button", { name: "Delete form" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The form is in use.");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
