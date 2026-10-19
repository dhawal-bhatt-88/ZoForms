// @vitest-environment jsdom
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// The App Router's Link needs a mounted router; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
    return <a ref={ref} {...props} />;
  }),
}));

const { LeaveLink } = await import("./leave-link");

// jsdom has no layout; the dialog's focus trap skips elements without an offsetParent.
Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });

beforeEach(() => push.mockClear());
afterEach(cleanup);

function setup(dirty: boolean) {
  render(
    <LeaveLink href="/app" dirty={dirty} aria-label="Back">
      ←
    </LeaveLink>,
  );
  return screen.getByRole("link", { name: "Back" });
}

describe("leaving with unsaved changes", () => {
  it("doesn't ask when there is nothing to lose", async () => {
    const link = setup(false);
    // jsdom doesn't navigate, so an unprevented click is the link doing its job.
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks first, and says what is lost", async () => {
    const link = setup(true);
    await userEvent.click(link);
    const dialog = screen.getByRole("alertdialog", { name: "Leave without saving?" });
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toContain("unsaved changes will be lost");
    expect(push).not.toHaveBeenCalled();
  });

  it("Cancel stays, with focus back on the link", async () => {
    const link = setup(true);
    await userEvent.click(link);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(link);
  });

  it("Escape stays too", async () => {
    const link = setup(true);
    await userEvent.click(link);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("confirming navigates", async () => {
    const link = setup(true);
    await userEvent.click(link);
    await userEvent.click(screen.getByRole("button", { name: "Leave without saving" }));
    expect(push).toHaveBeenCalledWith("/app");
  });

  it("a click that opens a new tab isn't asked about", () => {
    const link = setup(true);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    link.dispatchEvent(event);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
