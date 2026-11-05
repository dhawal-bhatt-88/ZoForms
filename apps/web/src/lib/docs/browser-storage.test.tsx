// @vitest-environment jsdom
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormRenderer, clearDrafts, type DraftsOptions } from "@zoworkhq/zoforms/react";
import type { FormSchema } from "@zoworkhq/zoforms/core";
import { CONTENT_DIR, getPage } from "./content";
import { textOf, walk, type MdNode } from "./mdast";

/*
 * The tab's copy, as "What is stored in the browser" describes it, held to the
 * real FormRenderer: its keys, its fields, and each thing the page says
 * deletes it (docs brief, CP3). jsdom has no IndexedDB, so the device draft is
 * checked in a real browser by e2e/verify-dev-docs-apps.js.
 */

const SLUG = "integrate/concepts/browser-storage";
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "integrate", name), "utf8")) as FormSchema;
const intake = read("intake-form.form.json");
const paged = read("intake-server.form.json");
const device = read("intake-device.form.json");
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const SCOPE = "user-demo-1:client-demo-1";
const OWNER = "user-demo-1";
const PREFIX = "@zoworkhq/zoforms:";

const page = getPage(SLUG)!;
/** A table on the page, by its first header cell, as rows of cell text. */
function table(firstHeader: string): string[][] {
  const found = [...walk(page.tree)].find((n) => n.type === "table" && textOf(n.children![0].children![0]) === firstHeader);
  if (!found) throw new Error(`${SLUG} has no table headed "${firstHeader}"`);
  return (found.children ?? []).slice(1).map((row: MdNode) => (row.children ?? []).map(textOf));
}
/** A key pattern from the page, with its {placeholders} filled in. */
const keyFor = (pattern: string, values: Record<string, string>) => pattern.replace(/\{(\w+)\}/g, (_, name: string) => values[name]);
const [unscopedPattern, scopedPattern] = table("The form has").map((row) => row[1]);

const ours = () => Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX));
const entry = (key: string) => JSON.parse(sessionStorage.getItem(key) ?? "null") as Record<string, unknown> | null;

/** Every field seen in a tab's copy, across the tests, for the page's table. */
const seen = new Set<string>();
const note = (key: string) => Object.keys(entry(key) ?? {}).forEach((f) => seen.add(f));

function show(schema: FormSchema, drafts?: DraftsOptions, extra: Record<string, unknown> = {}) {
  return render(createElement(FormRenderer, { schema, endpoint: "/api/submit", drafts, ...extra }));
}
async function ready() {
  await waitFor(() => expect(document.querySelector(".zf-submit, .zf-next")).not.toBeNull());
}
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Answer the intake's first questions, and answer then hide "Therapist's name". */
function fillIntake() {
  type(/^Preferred name/, "Demo Client");
  fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
  type(/^Therapist's name/, "Dr. Demo");
  fireEvent.click(screen.getByRole("radio", { name: "No" }));
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the tab's copy", () => {
  it("is keyed as the page says, without a scope, and holds visible answers only", async () => {
    show(intake);
    await ready();
    fillIntake();
    const key = keyFor(unscopedPattern, { formId: intake.formId, formVersionId: intake.formVersionId });
    await waitFor(() => expect(ours()).toEqual([key]));
    const value = entry(key)!;
    note(key);
    expect(Object.keys(value.answers as object)).toContain("preferred_name");
    expect(value.answers).not.toHaveProperty("therapist_name");
    expect(value.idempotencyKey).toEqual(expect.any(String));
    expect(new Date(value.startedAt as string).toISOString()).toBe(value.startedAt);
    expect(value.address).toBe(location.href.split("#")[0]);
    expect(value).not.toHaveProperty("ownerHash");
  });

  it("is keyed by the scope's hash, and holds the owner's, when the form has them", async () => {
    show(intake, { scope: SCOPE, owner: OWNER });
    await ready();
    fillIntake();
    const key = keyFor(scopedPattern, { formId: intake.formId, formVersionId: intake.formVersionId, scopeHash: sha256(SCOPE) });
    await waitFor(() => expect(ours()).toEqual([key]));
    note(key);
    expect(entry(key)!.ownerHash).toBe(sha256(OWNER));
    expect(entry(key)!.answers).not.toHaveProperty("therapist_name");
  });

  it("is a session copy, with startedAt and address, when device mode falls back", async () => {
    const problems: unknown[] = [];
    const getKey = () => crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    show(device, { scope: SCOPE, owner: OWNER, getKey }, { onDraftProblem: (p: unknown) => problems.push(p) });
    await ready();
    expect(problems).toEqual([{ type: "drafts-unavailable", mode: "device", reason: "no-indexeddb" }]);
    fillIntake();
    const key = keyFor(scopedPattern, { formId: device.formId, formVersionId: device.formVersionId, scopeHash: sha256(SCOPE) });
    await waitFor(() => expect(ours()).toEqual([key]));
    expect(entry(key)).toMatchObject({ startedAt: expect.any(String), address: expect.any(String) });
    expect(entry(key)!.answers).not.toHaveProperty("therapist_name");
  });

  it("holds the page and the pages visited on a form with pages", async () => {
    show(paged);
    await ready();
    type(/^Preferred name/, "Demo Client");
    type(/^Email address/, "client@example.org");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const key = keyFor(unscopedPattern, { formId: paged.formId, formVersionId: paged.formVersionId });
    await waitFor(() => expect(entry(key)?.currentPageId).toBe("page_visit"));
    note(key);
    expect(entry(key)!.visitedPageIds).toEqual(["page_about", "page_visit"]);
  });

  it("is marked awaitingChoice while the prompt is up", async () => {
    const key = keyFor(unscopedPattern, { formId: intake.formId, formVersionId: intake.formVersionId });
    sessionStorage.setItem(key, JSON.stringify({ answers: { preferred_name: { state: "answered", value: "Demo Client" } }, idempotencyKey: "demo-key-7" }));
    show(intake);
    await screen.findByText("Continue where you left off?");
    expect(entry(key)!.awaitingChoice).toBe(true);
    note(key);
  });

  it("isn't written at all with mode: 'off'", async () => {
    show(intake, { mode: "off" });
    await ready();
    fillIntake();
    await new Promise((r) => setTimeout(r, 100));
    expect(ours()).toEqual([]);
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("has every field the page lists, and no other", () => {
    // onReview needs a review page, which the page's forms don't have.
    expect([...seen, "onReview"].sort()).toEqual(table("Field").map((row) => row[0]).sort());
  });
});

describe("what deletes the tab's copy", () => {
  const unscoped = () => keyFor(unscopedPattern, { formId: intake.formId, formVersionId: intake.formVersionId });
  const deletes = (what: string) => expect(page.body).toContain(what);

  it("a submit", async () => {
    deletes("the form is submitted;");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    show(intake);
    await ready();
    type(/^Preferred name/, "Demo Client");
    type(/^Email address/, "client@example.org");
    fireEvent.click(screen.getByRole("radio", { name: "Video" }));
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    await waitFor(() => expect(ours()).toEqual([unscoped()]));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Form submitted successfully.");
    expect(ours()).toEqual([]);
  });

  it("Clear form", async () => {
    deletes("the respondent chooses **Clear form** or **Start over**;");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    show(intake);
    await ready();
    fillIntake();
    await waitFor(() => expect(ours()).toEqual([unscoped()]));
    fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
    await waitFor(() => expect(ours()).toEqual([]));
  });

  it("Start over", async () => {
    sessionStorage.setItem(unscoped(), JSON.stringify({ answers: { preferred_name: { state: "answered", value: "Demo Client" } }, idempotencyKey: "demo-key-8" }));
    show(intake);
    fireEvent.click(await screen.findByRole("button", { name: "Start over" }));
    await ready();
    expect(ours()).toEqual([]);
  });

  it("nothing left worth keeping", async () => {
    deletes("nothing is left worth keeping: no question answered and the respondent still on the first page;");
    show(intake);
    await ready();
    type(/^Preferred name/, "Demo Client");
    await waitFor(() => expect(ours()).toEqual([unscoped()]));
    type(/^Preferred name/, "");
    await waitFor(() => expect(ours()).toEqual([]));
  });

  // DRAFTS-CONTRACT §5 and §8 since 0.28.1, which also matches the formId exactly.
  it("a form starting: other versions, and its own version's unscoped copy, but not other scopes' or other forms'", async () => {
    deletes("It deletes this tab's copies of its other versions, whatever their scope, and, if it has a `scope`, its own version's copy without one. Copies of its own version for other scopes are kept, and so are other forms': a form's id must match exactly, so form `intake` never deletes the copies of form `intake:child`;");
    const otherScope = `${PREFIX}${intake.formId}:${intake.formVersionId}:${sha256("user-demo-2:client-demo-1")}`;
    const oldVersion = `${PREFIX}${intake.formId}:version-demo-old`;
    const oldScoped = `${PREFIX}${intake.formId}:version-demo-old:${sha256(SCOPE)}`;
    const oldOtherScope = `${PREFIX}${intake.formId}:version-demo-old:${sha256("user-demo-2:client-demo-1")}`;
    const otherForm = `${PREFIX}form-demo-9:version-demo-1`;
    // A form whose id starts with this one's and a colon: 0.28.0 deleted its copies.
    const childForm = `${PREFIX}${intake.formId}:child:version-demo-1`;
    for (const key of [otherScope, oldVersion, oldScoped, oldOtherScope, otherForm, childForm, unscoped()]) sessionStorage.setItem(key, JSON.stringify({ answers: {}, idempotencyKey: "demo-key-9" }));
    show(intake, { scope: SCOPE });
    await ready();
    await waitFor(() => expect(ours().sort()).toEqual([otherForm, otherScope, childForm].sort()));
  });

  it("clearDrafts, with each of its options", async () => {
    deletes("[`clearDrafts`](/docs/integrate/reference/clear-drafts) is called: with no options, every copy the package wrote in this tab; with `{ scope }` or `{ owner }`, the matching ones;");
    const mine = `${PREFIX}form-demo-1:v1:${sha256(SCOPE)}`;
    const theirs = `${PREFIX}form-demo-1:v1:${sha256("user-demo-2:client-demo-1")}`;
    const owned = `${PREFIX}form-demo-2:v1`;
    const plain = `${PREFIX}form-demo-3:v1`;
    const seed = () => {
      sessionStorage.clear();
      for (const key of [mine, theirs, plain]) sessionStorage.setItem(key, JSON.stringify({ answers: {}, idempotencyKey: "k" }));
      sessionStorage.setItem(owned, JSON.stringify({ answers: {}, idempotencyKey: "k", ownerHash: sha256(OWNER) }));
      sessionStorage.setItem("my-app:setting", "kept");
    };
    seed();
    await act(() => clearDrafts({ scope: SCOPE }));
    expect(ours().sort()).toEqual([owned, plain, theirs].sort());
    seed();
    await act(() => clearDrafts({ owner: OWNER }));
    expect(ours().sort()).toEqual([mine, plain, theirs].sort());
    seed();
    await act(() => clearDrafts());
    expect(ours()).toEqual([]);
    expect(sessionStorage.getItem("my-app:setting")).toBe("kept");
  });
});
