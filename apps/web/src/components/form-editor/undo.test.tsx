// @vitest-environment jsdom
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormSchema } from "@formbuilder/form-schema";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "f1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
    return <a ref={ref} {...props} />;
  }),
}));

const stored: FormSchema = { title: "Visit", description: "As saved", blocks: [{ id: "q", type: "short", label: "Name", required: false }] } as FormSchema;
let role = "EDITOR";
const saveSchema = vi.fn();

vi.mock("@/lib/api", async (actual) => ({
  ...(await actual<typeof import("@/lib/api")>()),
  me: () => Promise.resolve({ id: "u1", email: "a@example.test", name: "A", role, orgId: "o1", emailVerified: true, settingsPaneWidth: null }),
  updatePreferences: () => Promise.resolve({ settingsPaneWidth: null }),
  getForm: () => Promise.resolve({ id: "f1", title: "Visit", createdAt: "", updatedAt: "", versions: [{ id: "v4", version: 4, schema: stored }] }),
  saveSchema: (...args: unknown[]) => saveSchema(...args),
}));

const { default: FormEditor } = await import("./editor");

Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  role = "EDITOR";
  saveSchema.mockReset();
  saveSchema.mockImplementation(async (_id: string, schema: FormSchema) => ({ ok: true, versionId: "v5", version: 5, schema }));
});
afterEach(cleanup);

const undo = () => screen.getByRole("button", { name: "Undo" });
const redo = () => screen.getByRole("button", { name: "Redo" });
const blocked = (button: HTMLElement) => button.getAttribute("aria-disabled") === "true";
const saveButton = () => screen.getByRole("button", { name: /^Save/ });
const announcement = () => document.querySelector("[data-editor-announcement]")!.textContent;

async function open() {
  render(<FormEditor />);
  return screen.findByRole("textbox", { name: "Form description" });
}
/** Type in a field, then leave it: one step. */
async function typeAndLeave(field: HTMLElement, text: string) {
  await userEvent.type(field, text);
  await userEvent.click(document.body);
}

describe("undo and redo in the editor", () => {
  it("has nothing to undo or redo on a form just opened, and says so", async () => {
    await open();
    expect([blocked(undo()), blocked(redo())]).toEqual([true, true]);
    expect(document.getElementById(undo().getAttribute("aria-describedby")!)?.textContent).toBe("Nothing to undo");
    expect(document.getElementById(redo().getAttribute("aria-describedby")!)?.textContent).toBe("Nothing to redo");
  });

  it("undoes all the typing in one field as one step, and redoes it", async () => {
    const description = (await open()) as HTMLTextAreaElement;
    await typeAndLeave(description, ", then typed");
    expect(blocked(undo())).toBe(false);
    expect(undo().title).toBe("Undo: edit form description (Ctrl+Z)");

    await userEvent.click(undo());
    expect(description.value).toBe("As saved");
    expect(announcement()).toBe("Undone: edit form description.");
    expect([blocked(undo()), blocked(redo())]).toEqual([true, false]);
    expect(redo().title).toBe("Redo: edit form description (Ctrl+Y)");

    await userEvent.click(redo());
    expect(description.value).toBe("As saved, then typed");
    expect(announcement()).toBe("Redone: edit form description.");
    expect([blocked(undo()), blocked(redo())]).toEqual([false, true]);
  });

  it("makes typing in two fields two steps", async () => {
    const description = (await open()) as HTMLTextAreaElement;
    const title = screen.getByRole("textbox", { name: "Form title in the top bar" }) as HTMLInputElement;
    await typeAndLeave(description, "!");
    await typeAndLeave(title, " two");
    await userEvent.click(undo());
    expect([title.value, description.value]).toEqual(["Visit", "As saved!"]);
    expect(announcement()).toBe("Undone: edit form title.");
    await userEvent.click(undo());
    expect(description.value).toBe("As saved");
  });

  it("drops a step that ends where it began", async () => {
    const description = await open();
    await typeAndLeave(description, "x{Backspace}");
    expect(blocked(undo())).toBe(true);
  });

  it("clears redo on a new change after an undo", async () => {
    const description = await open();
    await typeAndLeave(description, " one");
    await userEvent.click(undo());
    expect(blocked(redo())).toBe(false);
    await typeAndLeave(description, " two");
    expect(blocked(redo())).toBe(true);
  });

  it("keeps the history across a save, and undoing after it makes the form unsaved again", async () => {
    const description = (await open()) as HTMLTextAreaElement;
    await typeAndLeave(description, " and more");
    await userEvent.click(saveButton());
    await waitFor(() => expect(blocked(saveButton())).toBe(true));
    expect(blocked(undo())).toBe(false);

    await userEvent.click(undo());
    expect(description.value).toBe("As saved");
    expect(blocked(saveButton())).toBe(false);
    await userEvent.click(redo());
    expect(blocked(saveButton())).toBe(true);
  });

  it("forgets the history on Cancel", async () => {
    const description = (await open()) as HTMLTextAreaElement;
    await typeAndLeave(description, " and more");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(description.value).toBe("As saved"));
    expect([blocked(undo()), blocked(redo())]).toEqual([true, true]);
  });

  it("answers Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y outside a text field, Cmd on a Mac", async () => {
    const description = (await open()) as HTMLTextAreaElement;
    await typeAndLeave(description, " and more");
    const z = (init: KeyboardEventInit) => fireEvent.keyDown(document.body, { key: "z", ...init });
    z({ ctrlKey: true });
    await waitFor(() => expect(description.value).toBe("As saved"));
    z({ ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(description.value).toBe("As saved and more"));
    z({ metaKey: true });
    await waitFor(() => expect(description.value).toBe("As saved"));
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    await waitFor(() => expect(description.value).toBe("As saved and more"));
    z({ metaKey: true });
    await waitFor(() => expect(description.value).toBe("As saved"));
    z({ metaKey: true, shiftKey: true });
    await waitFor(() => expect(description.value).toBe("As saved and more"));
  });

  it("leaves the shortcuts to the browser while focus is in a text field", async () => {
    const description = (await open()) as HTMLTextAreaElement;
    await typeAndLeave(description, " and more");
    const title = screen.getByRole("textbox", { name: "Form title in the top bar" });
    title.focus();
    const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    title.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(description.value).toBe("As saved and more");
    expect(blocked(undo())).toBe(false);
  });

  it("gives a viewer no Undo or Redo, and no shortcut", async () => {
    role = "VIEWER";
    const description = (await open()) as HTMLTextAreaElement;
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redo" })).toBeNull();
    await typeAndLeave(description, " and more");
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(description.value).toBe("As saved and more");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});
