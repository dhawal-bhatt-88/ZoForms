// @vitest-environment jsdom
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "f1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
    return <a ref={ref} {...props} />;
  }),
}));

const role = { current: "EDITOR" };
vi.mock("@/lib/api", async (actual) => ({
  ...(await actual<typeof import("@/lib/api")>()),
  me: () => Promise.resolve({ id: "u1", email: "a@example.test", name: "A", role: role.current, orgId: "o1", emailVerified: true, settingsPaneWidth: null }),
  updatePreferences: () => Promise.resolve({ settingsPaneWidth: null }),
  getForm: () =>
    Promise.resolve({
      id: "f1",
      title: "Visit",
      versions: [
        {
          schema: {
            title: "Visit",
            blocks: [
              { id: "q", type: "short", label: "Email address" },
              { id: "t", type: "text", label: "Text", content: "Welcome" },
              { id: "s", type: "scale", label: "How likely", min: 1, max: 5 },
              { id: "h", type: "heading", label: "Before you arrive", level: 2 },
            ],
          },
        },
      ],
    }),
}));

const { default: FormEditor } = await import("./editor");

// jsdom has no layout: the dialog's focus trap and dnd-kit's measuring need these.
Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
// The theme toggle follows the system theme when nothing is stored.
window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;

beforeEach(() => {
  role.current = "EDITOR";
});
afterEach(cleanup);

async function open() {
  render(<FormEditor />);
  await screen.findByRole("textbox", { name: "Form description" });
  const pane = () => within(document.getElementById("settings-pane")!);
  const select = async (id: string) => {
    await userEvent.click(document.querySelector(`[data-block-id="${id}"]`)!);
  };
  return { pane, select };
}

describe("the settings pane's fields have names", () => {
  it("Help text, marked optional", async () => {
    const { pane, select } = await open();
    await select("q");
    const help = pane().getByRole("textbox", { name: "Help text optional" });
    expect(help.getAttribute("placeholder")).toBeNull();
    // Only the exception is marked: the label is just "Label".
    expect(pane().getByRole("textbox", { name: "Label" }).id).toBe("block-label");
  });

  it("Content", async () => {
    const { pane, select } = await open();
    await select("t");
    expect((pane().getByRole("textbox", { name: "Content" }) as HTMLTextAreaElement).value).toBe("Welcome");
  });

  it("Min and Max", async () => {
    const { pane, select } = await open();
    await select("s");
    expect((pane().getByRole("spinbutton", { name: "Min" }) as HTMLInputElement).value).toBe("1");
    expect((pane().getByRole("spinbutton", { name: "Max" }) as HTMLInputElement).value).toBe("5");
  });

  it("a heading's Level, as a radio group with its state", async () => {
    const { pane, select } = await open();
    await select("h");
    const group = pane().getByRole("radiogroup", { name: "Level" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => [r.textContent, r.getAttribute("aria-checked")])).toEqual([
      ["H1", "false"],
      ["H2", "true"],
      ["H3", "false"],
    ]);
    // One tab stop, and the arrow keys move the choice.
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    radios[1].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(within(pane().getByRole("radiogroup", { name: "Level" })).getByRole("radio", { name: "H3" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("a viewer", () => {
  it("gets the read-only treatment: no Save or Cancel, and a note saying why", async () => {
    role.current = "VIEWER";
    await open();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.getByText("You have view access, so changes here can't be saved.")).toBeTruthy();
    // Editing never makes it dirty, so there is nothing to warn about on leaving.
    await userEvent.type(screen.getByRole("textbox", { name: "Form description" }), "x");
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    expect(screen.getByText("View only")).toBeTruthy();
  });

  it("an author keeps Save and Cancel, blocked with one reason while there is nothing to save", async () => {
    await open();
    const save = screen.getByRole("button", { name: "Save" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(save.getAttribute("aria-describedby")!)?.textContent).toBe("No changes to save");
    expect(cancel.getAttribute("aria-describedby")).toBe(save.getAttribute("aria-describedby"));
  });
});

describe("Save progress", () => {
  it("links 'On the app's server' to its setup guide, in a new tab, named for where it goes", async () => {
    const { pane } = await open();
    await userEvent.click(screen.getAllByRole("button", { name: "Form settings" })[0]);
    const link = pane().getByRole("link", { name: "Developer setup guide: Save progress (drafts) (opens in a new tab)" });
    expect(link.getAttribute("href")).toBe("/docs/integrate/drafts");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    // Outside the option's label, so the radio keeps its own name; still usable while the option is unavailable.
    const radio = pane().getByRole("radio", { name: /^On the app's server/ });
    expect(radio.closest("label")?.contains(link)).toBe(false);
    expect((radio as HTMLInputElement).disabled).toBe(true);
  });
});
