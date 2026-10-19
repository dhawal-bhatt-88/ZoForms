// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

afterEach(cleanup);

describe("Button's reason", () => {
  it("blocks the action but keeps the button focusable", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} reason="This is the current version.">
        Restore
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Restore" });

    expect(button).toHaveProperty("disabled", false);
    expect(button.getAttribute("aria-disabled")).toBe("true");

    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    await userEvent.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows the reason and binds it to the button", () => {
    render(<Button reason="This is the current version.">Restore</Button>);
    const button = screen.getByRole("button", { name: "Restore" });
    const reason = screen.getByText("This is the current version.");
    expect(button.getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("gives every blocked button its own reason", () => {
    render(
      <>
        <Button reason="First reason.">One</Button>
        <Button reason="Second reason.">Two</Button>
      </>,
    );
    const one = screen.getByRole("button", { name: "One" });
    const two = screen.getByRole("button", { name: "Two" });
    expect(one.getAttribute("aria-describedby")).not.toBe(two.getAttribute("aria-describedby"));
    expect(document.getElementById(one.getAttribute("aria-describedby")!)?.textContent).toBe("First reason.");
    expect(document.getElementById(two.getAttribute("aria-describedby")!)?.textContent).toBe("Second reason.");
  });

  it("runs the action when there is no reason", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Restore</Button>);
    const button = screen.getByRole("button", { name: "Restore" });
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    expect(button.hasAttribute("aria-describedby")).toBe(false);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("while pending, takes no second click and stays focused", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} pending pendingLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    button.focus();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(button);
  });
});
