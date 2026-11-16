import { describe, expect, it } from "vitest";
import type { Block, FormSchema } from "@formbuilder/form-schema";
import { describeChange, HISTORY_LIMIT, UndoHistory } from "./undo-history";

/* ---------- the stacks ---------- */

const history = (limit?: number) => new UndoHistory<string>((a, b) => a === b, limit);
const step = { selected: null };

describe("UndoHistory", () => {
  it("has nothing to undo or redo to begin with", () => {
    const h = history();
    expect([h.canUndo, h.canRedo]).toEqual([false, false]);
    expect(h.undo("a")).toBeUndefined();
    expect(h.redo()).toBeUndefined();
  });

  it("undoes one step per action, newest first, and redoes them in order", () => {
    const h = history();
    h.record("a", step); // a → b
    h.record("b", step); // b → c
    expect(h.undo("c")?.before).toBe("b");
    expect(h.undo("b")?.before).toBe("a");
    expect(h.canUndo).toBe(false);
    expect(h.redo()?.after).toBe("b");
    expect(h.redo()?.after).toBe("c");
    expect(h.canRedo).toBe(false);
    expect(h.canUndo).toBe(true);
  });

  it("clears redo on any new change after an undo", () => {
    const h = history();
    h.record("a", step);
    h.record("b", step);
    h.undo("c");
    expect(h.canRedo).toBe(true);
    h.record("b", step); // b → d
    expect(h.canRedo).toBe(false);
    expect(h.undo("d")?.before).toBe("b");
    expect(h.undo("b")?.before).toBe("a");
  });

  it("keeps all the typing in one field as one step, until the field is left", () => {
    const h = history();
    const field = {};
    h.record("", { ...step, field }); // "" → "A"
    h.record("A", { ...step, field }); // "A" → "Ad"
    h.record("Ad", { ...step, field }); // what leaving the field generates
    h.closeField("Address");
    expect(h.undo("Address")?.before).toBe("");
    expect(h.canUndo).toBe(false);
  });

  it("starts a new step for another field, and for a change made outside any field", () => {
    const h = history();
    const first = {};
    const second = {};
    h.record("a", { ...step, field: first });
    h.record("b", { ...step, field: second });
    h.record("c", step);
    expect(h.undo("d")?.before).toBe("c");
    expect(h.undo("c")?.before).toBe("b");
    expect(h.undo("b")?.before).toBe("a");
  });

  it("starts a new step when the same field is typed in again after being left", () => {
    const h = history();
    const field = {};
    h.record("a", { ...step, field });
    h.closeField("b");
    h.record("b", { ...step, field });
    h.closeField("c");
    expect(h.undo("c")?.before).toBe("b");
    expect(h.undo("b")?.before).toBe("a");
  });

  it("drops a typing step that ends where it began", () => {
    const h = history();
    const field = {};
    h.record("a", step); // a → b
    h.record("b", { ...step, field }); // typed…
    h.record("bx", { ...step, field }); // …and deleted
    h.closeField("b");
    expect(h.undo("b")?.before).toBe("a");
    expect(h.canUndo).toBe(false);
  });

  it("closes the field's step when undo is asked for mid-typing", () => {
    const h = history();
    const field = {};
    h.record("a", { ...step, field });
    expect(h.undo("ab")?.before).toBe("a");
    expect(h.openField).toBeNull();
    expect(h.redo()?.after).toBe("ab");
  });

  it(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    expect(HISTORY_LIMIT).toBe(100);
    const h = history();
    for (let n = 0; n < 130; n++) h.record(String(n), step);
    let undone = 0;
    let last: string | undefined;
    for (let current = "130", s = h.undo(current); s; s = h.undo(current)) {
      current = last = s.before;
      undone++;
    }
    expect(undone).toBe(100);
    expect(last).toBe("30");
  });

  it("forgets everything when cleared", () => {
    const h = history();
    h.record("a", { ...step, field: {} });
    h.record("b", step);
    h.undo("c");
    h.clear();
    expect([h.canUndo, h.canRedo, h.openField]).toEqual([false, false, null]);
  });

  it("carries what a step did, where the caller says", () => {
    const h = history();
    h.record("a", { selected: "q1", what: "import options into 'Mood'" });
    expect(h.nextUndo).toMatchObject({ selected: "q1", what: "import options into 'Mood'" });
  });
});

/* ---------- what a step did ---------- */

const q = (id: string, label: string, more: Record<string, unknown> = {}) => ({ id, type: "short", label, required: false, ...more }) as unknown as Block;
const choice = (id: string, label: string, options: string[], more: Record<string, unknown> = {}) =>
  ({ id, type: "choice", label, required: false, options: options.map((o) => ({ code: o.toLowerCase(), label: o })), ...more }) as unknown as Block;
const group = (id: string, label: string, blocks: Block[], more: Record<string, unknown> = {}) => ({ id, type: "group", label, blocks, ...more }) as unknown as Block;
const page = (id: string, title: string, blocks: Block[]) => ({ id, type: "page", title, blocks }) as unknown as Block;
const form = (blocks: Block[], more: Partial<FormSchema> = {}): FormSchema => ({ title: "Intake", blocks, ...more }) as FormSchema;

const name = q("name", "Name");
const address = q("address", "Address");
const mood = choice("mood", "Mood", ["Low", "High"]);

describe("describeChange", () => {
  it("names an added question, group or page, and points at it", () => {
    expect(describeChange(form([name]), form([name, address]))).toEqual({ what: "add question 'Address'", focus: "address", fallback: null });
    expect(describeChange(form([name]), form([name, group("g", "Home", [])])).what).toBe("add group 'Home'");
    const p1 = page("p1", "Page 1", [name]);
    expect(describeChange(form([p1]), form([p1, page("p2", "Page 2", [])])).what).toBe("add page 'Page 2'");
  });

  it("names a group added with its contents by the group", () => {
    const g = group("g", "Home", [address]);
    expect(describeChange(form([name]), form([name, g]))).toMatchObject({ what: "add group 'Home'", focus: "g" });
  });

  it("names a deleted block by what it was, with its page or group to fall back on", () => {
    const before = form([group("g", "Home", [address, name])]);
    const after = form([group("g", "Home", [name])]);
    expect(describeChange(before, after)).toEqual({ what: "delete question 'Address'", focus: "address", fallback: "g" });
  });

  it("names a group deleted with its contents kept, and one deleted with them", () => {
    const before = form([name, group("g", "Home", [address])]);
    expect(describeChange(before, form([name, address])).what).toBe("delete group 'Home'");
    expect(describeChange(before, form([name])).what).toBe("delete group 'Home'");
  });

  it("names a block moved into another group, and one moved among its siblings", () => {
    const g = (blocks: Block[]) => group("g", "Home", blocks);
    expect(describeChange(form([name, address, g([])]), form([name, g([address])]))).toMatchObject({ what: "move question 'Address'", focus: "address", fallback: "g" });
    expect(describeChange(form([name, address, mood]), form([mood, name, address])).what).toBe("move question 'Mood'");
  });

  it("names the selected block when two neighbours swap places", () => {
    expect(describeChange(form([name, address]), form([address, name]), "name").what).toBe("move question 'Name'");
    expect(describeChange(form([name, address]), form([address, name]), "address").what).toBe("move question 'Address'");
  });

  it("names a moved group, not the questions that went with it", () => {
    const g = group("g", "Home", [address]);
    const p = (id: string, blocks: Block[]) => page(id, id, blocks);
    expect(describeChange(form([p("p1", [g]), p("p2", [])]), form([p("p1", []), p("p2", [g])])).what).toBe("move group 'Home'");
  });

  it("names an edited question by its name afterwards", () => {
    expect(describeChange(form([name, address]), form([name, q("address", "Home address")]))).toEqual({ what: "edit question 'Home address'", focus: "address", fallback: null });
    expect(describeChange(form([name]), form([q("name", "Name", { required: true })])).what).toBe("edit question 'Name'");
  });

  it("says options, conditions or scores when that is all that changed", () => {
    expect(describeChange(form([mood]), form([choice("mood", "Mood", ["Low", "Middling", "High"])])).what).toBe("edit options of 'Mood'");
    const shown = q("address", "Address", { enableWhen: [{ id: "c1", question: "mood", operator: "=", answer: "low" }], enableLogicText: "1" });
    expect(describeChange(form([mood, address]), form([mood, shown])).what).toBe("edit conditions of 'Address'");
    const scored = group("g", "PHQ-9", [mood], { scores: [{ id: "s1", label: "Total", formulaText: "mood" }] });
    expect(describeChange(form([group("g", "PHQ-9", [mood])]), form([scored])).what).toBe("edit scores of group 'PHQ-9'");
  });

  it("names the block the author was editing, not the ones that followed it", () => {
    // An option's code changed, and the condition that used it followed.
    const dependent = (answer: string) => q("address", "Address", { enableWhen: [{ id: "c1", question: "mood", operator: "=", answer }] });
    const before = form([mood, dependent("low")]);
    const recoded = { ...mood, options: [{ code: "poor", label: "Low" }, { code: "high", label: "High" }] } as unknown as Block;
    const after = form([recoded, dependent("poor")]);
    expect(describeChange(before, after, "mood").what).toBe("edit options of 'Mood'");
    expect(describeChange(before, after).what).toBe("edit options of 'Mood'");
    // A question renamed, and the group's formula followed.
    const g = (n: string, formula: string) => group("g", "PHQ-9", [q("q1", "Sleep", { name: n })], { scores: [{ id: "s1", label: "Total", formulaText: formula }] });
    expect(describeChange(form([g("sleep", "sleep")]), form([g("rest", "rest")]), "q1").what).toBe("edit question 'Sleep'");
  });

  it("names changes to the form itself", () => {
    expect(describeChange(form([name]), form([name], { title: "Client intake" }))).toEqual({ what: "edit form title", focus: null, fallback: null });
    expect(describeChange(form([name]), form([name], { description: "Before your visit" })).what).toBe("edit form description");
    expect(describeChange(form([name]), form([name], { drafts: { mode: "device" } } as Partial<FormSchema>)).what).toBe("edit form settings");
  });

  it("says pages were turned on or off", () => {
    const paged = form([page("p1", "Page 1", [name]), page("p2", "Page 2", [])]);
    expect(describeChange(form([name]), paged).what).toBe("turn pages on");
    expect(describeChange(paged, form([name])).what).toBe("turn pages off");
  });

  it("says untitled for a block with no name, and shortens a long one", () => {
    expect(describeChange(form([name]), form([name, q("new", "")])).what).toBe("add untitled question");
    expect(describeChange(form([choice("c", "", ["A"])]), form([choice("c", "", ["A", "B"])])).what).toBe("edit options of an untitled question");
    const long = q("long", "Over the last two weeks, how often have you been bothered by any of the following problems?");
    expect(describeChange(form([name]), form([name, long])).what).toBe("add question 'Over the last two weeks, how often have…'");
  });
});
