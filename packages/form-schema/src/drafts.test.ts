import { describe, expect, it } from "vitest";
import {
  buildArtifact,
  DEFAULT_DRAFT_MODE,
  draftModeAvailable,
  draftsProblem,
  draftsWithoutDefault,
  FormArtifact,
  FormSchema,
  removePaging,
  sameContent,
  type Block,
  type PageBlock,
} from "./index";

// docs/DRAFTS-CONTRACT.md §2: drafts?: { mode: "session" | "device" | "server" }, default "session".

const leaf = (id: string): Block => ({ id, type: "short", label: id.toUpperCase(), required: false });
const page = (id: string, blocks: Block[]): PageBlock =>
  ({ id, type: "page", title: id.toUpperCase(), blocks }) as unknown as PageBlock;
const paged = (): Block[] => [page("p1", [leaf("a")]), page("p2", [leaf("b")])];
const flat = (): Block[] => [leaf("a"), leaf("b")];
const identity = { formId: "f", formVersionId: "v" };

describe("drafts: schema", () => {
  it("accepts each mode, stored at the top level next to blocks", () => {
    for (const mode of ["session", "device", "server"] as const) {
      const form = FormSchema.parse({ title: "t", blocks: paged(), drafts: { mode } });
      expect(form.drafts).toEqual({ mode });
    }
  });

  it("rejects any other mode", () => {
    const result = FormSchema.safeParse({ title: "t", blocks: paged(), drafts: { mode: "cloud" } });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual(["drafts", "mode"]);
  });

  it('defaults to "session", and the default isn\'t stored', () => {
    expect(DEFAULT_DRAFT_MODE).toBe("session");
    expect(FormSchema.parse({ title: "t", blocks: [] }).drafts).toBeUndefined();
    expect(draftsWithoutDefault({ mode: "session" })).toBeUndefined();
    expect(draftsWithoutDefault(undefined)).toBeUndefined();
    expect(draftsWithoutDefault({ mode: "device" })).toEqual({ mode: "device" });
    expect(draftsWithoutDefault({ mode: "server" })).toEqual({ mode: "server" });
  });

  it("the mode counts as content, for dirty state and NO_CHANGES", () => {
    expect(sameContent({ title: "t", blocks: paged() }, { title: "t", blocks: paged(), drafts: { mode: "device" } })).toBe(false);
  });
});

describe("drafts: server needs pages", () => {
  it("server is only available on a form with pages; the others anywhere", () => {
    expect(draftModeAvailable("server", paged())).toBe(true);
    expect(draftModeAvailable("server", flat())).toBe(false);
    expect(draftModeAvailable("device", flat())).toBe(true);
    expect(draftModeAvailable("session", flat())).toBe(true);
  });

  it("a save with server mode on a form without pages is rejected, with a clear message", () => {
    expect(draftsProblem({ blocks: flat(), drafts: { mode: "server" } })).toBe(
      'Save progress "On the app\'s server" needs a form with pages, because it saves at each page change. Add pages, or choose another Save progress option.',
    );
  });

  it("every other combination is fine", () => {
    expect(draftsProblem({ blocks: paged(), drafts: { mode: "server" } })).toBeNull();
    expect(draftsProblem({ blocks: flat(), drafts: { mode: "device" } })).toBeNull();
    expect(draftsProblem({ blocks: flat(), drafts: undefined })).toBeNull();
  });

  it("removing pages from a server-mode form would break the rule (the editor switches it back to session)", () => {
    const one = [page("p1", [leaf("a")])];
    expect(draftsProblem({ blocks: removePaging(one), drafts: { mode: "server" } })).not.toBeNull();
  });
});

describe("drafts: artifact", () => {
  it('"session" (explicit or not set): no drafts in the artifact', () => {
    expect("drafts" in buildArtifact({ title: "t", blocks: paged() }, identity)).toBe(false);
    expect("drafts" in buildArtifact({ title: "t", blocks: paged(), drafts: { mode: "session" } }, identity)).toBe(false);
  });

  it('"device": drafts: { mode: "device" }, paged or not', () => {
    expect(buildArtifact({ title: "t", blocks: paged(), drafts: { mode: "device" } }, identity).drafts).toEqual({ mode: "device" });
    expect(buildArtifact({ title: "t", blocks: flat(), drafts: { mode: "device" } }, identity).drafts).toEqual({ mode: "device" });
  });

  it('"server": drafts: { mode: "server" }, after navigation', () => {
    const artifact = buildArtifact({ title: "t", blocks: paged(), drafts: { mode: "server" } }, identity);
    expect(artifact.drafts).toEqual({ mode: "server" });
    expect(Object.keys(artifact).slice(-2)).toEqual(["navigation", "drafts"]);
  });

  it("an artifact can't carry server mode without pages, or an explicit session mode", () => {
    expect(() => buildArtifact({ title: "t", blocks: flat(), drafts: { mode: "server" } }, identity)).toThrow(/needs a form with pages/);
    const base = { title: "t", ...identity, schemaVersion: 2, blocks: flat() };
    expect(FormArtifact.safeParse({ ...base, drafts: { mode: "session" } }).success).toBe(false);
    expect(FormArtifact.safeParse({ ...base, drafts: { mode: "device" } }).success).toBe(true);
  });
});
