// @vitest-environment jsdom
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormSchema } from "@formbuilder/form-schema";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "f1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
    return <a ref={ref} {...props} />;
  }),
}));

const stored = (description: string): FormSchema => ({ title: "Visit", description, blocks: [{ id: "q", type: "short", label: "Name", required: false }] }) as FormSchema;
const server = { version: 4, schema: stored("v4") };
const saveSchema = vi.fn();
const getForm = vi.fn(async () => ({ id: "f1", title: "Visit", createdAt: "", updatedAt: "", versions: [{ id: `v${server.version}`, version: server.version, schema: server.schema }] }));

vi.mock("@/lib/api", async (actual) => ({
  ...(await actual<typeof import("@/lib/api")>()),
  me: () => Promise.resolve({ id: "u1", email: "a@example.test", name: "A", role: "EDITOR", orgId: "o1", emailVerified: true, settingsPaneWidth: null }),
  updatePreferences: () => Promise.resolve({ settingsPaneWidth: null }),
  getForm: () => getForm(),
  saveSchema: (...args: unknown[]) => saveSchema(...args),
}));

const { default: FormEditor } = await import("./editor");

Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;

/** The server's answer to a save from `base`: the next version, or 409 if `base` isn't the latest. */
function serverSaves() {
  saveSchema.mockImplementation(async (_id: string, schema: FormSchema, base: number) => {
    if (base !== server.version) throw new ApiError("This form was saved elsewhere. Reload to get the latest version.", 409, "VERSION_CONFLICT", server.version);
    server.version += 1;
    server.schema = schema;
    return { ok: true, versionId: `v${server.version}`, version: server.version, schema };
  });
}

beforeEach(() => {
  server.version = 4;
  server.schema = stored("v4");
  saveSchema.mockReset();
  getForm.mockClear();
  serverSaves();
});
afterEach(cleanup);

async function openAndEdit(text: string) {
  render(<FormEditor />);
  const description = await screen.findByRole("textbox", { name: "Form description" });
  await userEvent.clear(description);
  await userEvent.type(description, text);
  return description;
}
const save = () => userEvent.click(screen.getByRole("button", { name: /^Save/ }));

describe("every form save sends the version it started from", () => {
  it("the first save sends the loaded version, the next one the version it just made", async () => {
    const description = await openAndEdit("first");
    await save();
    expect(saveSchema).toHaveBeenLastCalledWith("f1", expect.objectContaining({ description: "first" }), 4);
    await userEvent.type(description, " and second");
    await save();
    expect(saveSchema).toHaveBeenLastCalledWith("f1", expect.objectContaining({ description: "first and second" }), 5);
  });
});

describe("a save from a tab that is behind", () => {
  async function staleDialog() {
    await openAndEdit("mine");
    // Another tab saves version 5 after this one opened version 4.
    server.version = 5;
    server.schema = stored("theirs");
    await save();
    return screen.findByRole("alertdialog", { name: "This form changed since you opened it" });
  }

  it("saves nothing and asks, naming both versions", async () => {
    const dialog = await staleDialog();
    expect(server.version).toBe(5);
    expect(dialog.textContent).toContain("Version 5 was saved after you started editing from version 4, in another tab or by a teammate.");
    expect(dialog.textContent).toContain("Your unsaved edits here will be lost.");
    expect(dialog.textContent).toContain("Becomes version 6. The other changes stay in version history.");
  });

  it("Save mine as a new version saves these edits as version 6", async () => {
    const dialog = await staleDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save mine as a new version" }));
    expect(saveSchema).toHaveBeenLastCalledWith("f1", expect.objectContaining({ description: "mine" }), 5);
    expect(server.version).toBe(6);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Load the latest version replaces these edits with version 5", async () => {
    const dialog = await staleDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Load the latest version" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((screen.getByRole("textbox", { name: "Form description" }) as HTMLTextAreaElement).value).toBe("theirs");
    expect(server.version).toBe(5);
  });

  it("Keep editing closes it with the edits kept and nothing saved", async () => {
    const dialog = await staleDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((screen.getByRole("textbox", { name: "Form description" }) as HTMLTextAreaElement).value).toBe("mine");
    expect(server.version).toBe(5);
  });
});
