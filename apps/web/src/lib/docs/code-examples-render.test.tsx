// @vitest-environment jsdom
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { CHECK_DIR, examplesOf, isDeveloperPage, pageFolder, writeProject } from "./code-examples";
import { getLivePages } from "./content";

/*
 * The browser examples on the developer pages, rendered with the real
 * FormRenderer. Each must show a form, not "This form can't be shown right
 * now." Statements (clearDrafts and the like) are run. Its own copy of the
 * files, because Vitest runs this beside code-examples.test.ts, which rewrites
 * its folders.
 */

const ROOT = path.join(CHECK_DIR, "_render");
const pages = getLivePages().filter((p) => isDeveloperPage(p.slug));
const examples = pages.flatMap(examplesOf);
const rendered = examples.filter((e) => e.check === "fragment" || e.run === "browser");
const statements = examples.filter((e) => e.check === "statements");

const load = (page: string, file: string) => import(/* @vite-ignore */ path.join(pageFolder(page, ROOT), file)) as Promise<Record<string, unknown>>;

beforeAll(() => {
  for (const page of pages) writeProject(page.slug, examplesOf(page), ROOT);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const named = (e: (typeof examples)[number]) => [`${e.page}.mdx, line ${e.line}`, e] as const;

describe("the developer pages' browser examples", () => {
  it("has some", () => {
    expect(rendered.length).toBeGreaterThan(10);
    expect(statements.length).toBeGreaterThan(0);
  });

  it.each(rendered.map(named))("%s renders the form", { timeout: 30_000 }, async (_, example) => {
    const module = await load(example.page, example.file);
    const Component = (module.default ?? Object.values(module).find((v) => typeof v === "function")) as ComponentType;
    const { container } = render(createElement(Component));
    // Device and server modes look for a saved draft first, so the form comes a moment later.
    // A form with pages starts with Next rather than Submit.
    await waitFor(() => expect(container.querySelector(".zf-submit, .zf-next, .zf-unavailable")).not.toBeNull());
    expect(container.querySelector(".zf-unavailable")?.textContent ?? null).toBeNull();
    expect(container.querySelector(".zf-submit, .zf-next")).not.toBeNull();
  });

  it.each(statements.map(named))("%s runs", { timeout: 30_000 }, async (_, example) => {
    const module = await load(example.page, example.file);
    await expect((module.default as () => Promise<void>)()).resolves.toBeUndefined();
  });
});
