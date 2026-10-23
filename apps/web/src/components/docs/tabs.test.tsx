// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./tabs";

afterEach(cleanup);

const TABS = ["Preview", "Schema", "Payload"].map((label) => ({ id: label.toLowerCase(), label, content: <p>{label} panel</p> }));

describe("Tabs", () => {
  it("is one tab stop, with the selected tab's panel shown", () => {
    render(<Tabs label="Example" tabs={TABS} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(screen.getByRole("tabpanel", { name: "Preview" }).textContent).toBe("Preview panel");
    expect(screen.queryByRole("tabpanel", { name: "Schema" })).toBeNull();
  });

  it("moves and selects with the arrow keys, wrapping, and jumps with Home and End", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Example" tabs={TABS} />);
    const selected = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

    await user.click(screen.getByRole("tab", { name: "Preview" }));
    await user.keyboard("{ArrowRight}");
    expect([selected(), document.activeElement?.textContent]).toEqual(["Schema", "Schema"]);
    await user.keyboard("{End}");
    expect(selected()).toBe("Payload");
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("Preview");
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe("Payload");
    await user.keyboard("{Home}");
    expect([selected(), document.activeElement?.textContent]).toEqual(["Preview", "Preview"]);
  });

  it("keeps every panel mounted, so a form keeps its answers", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Example" tabs={[{ id: "a", label: "A", content: <input aria-label="Answer" /> }, { id: "b", label: "B", content: null }]} />);
    await user.type(screen.getByRole("textbox", { name: "Answer" }), "kept");
    await user.click(screen.getByRole("tab", { name: "B" }));
    await user.click(screen.getByRole("tab", { name: "A" }));
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Answer" }).value).toBe("kept");
  });
});
