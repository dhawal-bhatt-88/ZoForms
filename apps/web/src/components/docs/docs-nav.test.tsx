// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DocsNavSection } from "@/lib/docs/nav";
import { DocsNav, NAV_GROUPS_KEY } from "./docs-nav";

let pathname = "/docs";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const HOME = { title: "Docs home", slug: "", status: "live" as const };
const SECTIONS: DocsNavSection[] = [
  {
    title: "Build forms",
    items: [
      {
        title: "Question types",
        pages: [
          { title: "Dropdown", slug: "build/question-types/dropdown", status: "live" },
          { title: "Short answer", slug: "build/question-types/short-answer", status: "live" },
        ],
      },
      { title: "Structure", pages: [{ title: "Groups", slug: "build/structure/groups", status: "live" }] },
    ],
  },
  {
    title: "Integrate forms",
    items: [
      { title: "Quickstart", slug: "integrate/quickstart", status: "live" },
      { title: "Reference", pages: [{ title: "FormRenderer", slug: "integrate/reference/form-renderer", status: "live" }] },
    ],
  },
];

const nav = () => render(<DocsNav home={HOME} sections={SECTIONS} />);
const group = (name: string) => screen.getByRole("button", { name });
const link = (name: string) => screen.queryByRole("link", { name });
const stored = () => JSON.parse(localStorage.getItem(NAV_GROUPS_KEY) ?? "{}");

beforeEach(() => {
  pathname = "/docs";
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DocsNav groups", () => {
  it("opens only the group holding the current page, each heading a button controlling its list", () => {
    pathname = "/docs/build/question-types/short-answer";
    nav();
    expect(group("Question types").getAttribute("aria-expanded")).toBe("true");
    expect(group("Structure").getAttribute("aria-expanded")).toBe("false");
    expect(group("Reference").getAttribute("aria-expanded")).toBe("false");
    const list = document.getElementById(group("Structure").getAttribute("aria-controls")!)!;
    expect(list.hidden).toBe(true);
    expect(link("Short answer")?.getAttribute("aria-current")).toBe("page");
    // Pages outside a group are always shown.
    expect(link("Quickstart")).not.toBeNull();
  });

  it("toggles with a click, Enter and Space, and remembers the choice", async () => {
    const user = userEvent.setup();
    nav();
    await user.click(group("Reference"));
    expect(group("Reference").getAttribute("aria-expanded")).toBe("true");
    expect(link("FormRenderer")).not.toBeNull();

    group("Structure").focus();
    await user.keyboard("{Enter}");
    expect(group("Structure").getAttribute("aria-expanded")).toBe("true");
    await user.keyboard(" ");
    expect(group("Structure").getAttribute("aria-expanded")).toBe("false");

    expect(stored()).toEqual({ "Integrate forms/Reference": true, "Build forms/Structure": false });
  });

  it("applies stored choices on mount", () => {
    localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify({ "Integrate forms/Reference": true }));
    nav();
    expect(group("Reference").getAttribute("aria-expanded")).toBe("true");
    expect(group("Question types").getAttribute("aria-expanded")).toBe("false");
  });

  it("lets the reader close the current group, and opens it again on going to a page in it", async () => {
    const user = userEvent.setup();
    pathname = "/docs/build/question-types/dropdown";
    localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify({ "Build forms/Question types": false }));
    const view = nav();
    expect(group("Question types").getAttribute("aria-expanded")).toBe("true");

    await user.click(group("Question types"));
    expect(group("Question types").getAttribute("aria-expanded")).toBe("false");

    pathname = "/docs/build/question-types/short-answer";
    view.rerender(<DocsNav home={HOME} sections={SECTIONS} />);
    expect(group("Question types").getAttribute("aria-expanded")).toBe("true");
    expect(stored()["Build forms/Question types"]).toBe(true);
  });

  it("works when storage throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    pathname = "/docs/integrate/reference/form-renderer";
    nav();
    expect(group("Reference").getAttribute("aria-expanded")).toBe("true");
    await user.click(group("Structure"));
    expect(group("Structure").getAttribute("aria-expanded")).toBe("true");
  });
});
