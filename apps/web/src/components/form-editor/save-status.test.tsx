// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { SaveStatus, useSaveAnnouncement, type SaveState } from "./save-status";

afterEach(cleanup);

/** The editor's part in it: typing makes it dirty, a save runs and ends. */
function Harness({ onReady }: { onReady: (api: { type: () => void; save: () => void; saved: () => void }) => void }) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { text, announce } = useSaveAnnouncement(dirty);
  onReady({
    type: () => setDirty(true),
    save: () => setSaving(true),
    saved: () => {
      setSaving(false);
      setDirty(false);
      announce("Changes saved.");
    },
  });
  const state: SaveState = saving ? "saving" : dirty ? "dirty" : "saved";
  return <SaveStatus state={state} announcement={text} />;
}

function setup() {
  let api!: { type: () => void; save: () => void; saved: () => void };
  render(<Harness onReady={(a) => (api = a)} />);
  const region = () => screen.getByRole("status");
  const chip = () => document.querySelector("[data-save-state]")!;
  return { api: () => api, region, chip };
}

describe("the save status", () => {
  it("always says its state in words", () => {
    const { api, chip } = setup();
    expect(chip().textContent).toBe("All changes saved");
    act(() => api().type());
    expect(chip().textContent).toBe("Unsaved changes");
    act(() => api().save());
    expect(chip().textContent).toBe("Saving…");
  });

  it("is silent while the author types", () => {
    const { api, region } = setup();
    expect(region().textContent).toBe("");
    act(() => api().type());
    act(() => api().type());
    expect(region().textContent).toBe("");
  });

  it("announces a save's outcome once, and not the chip's own words", () => {
    const { api, region } = setup();
    act(() => api().type());
    act(() => api().save());
    expect(region().textContent).toBe("");
    act(() => api().saved());
    expect(region().textContent).toBe("Changes saved.");
    // The chip isn't a live region, so the only announcement is the region's.
    expect(document.querySelector("[data-save-state]")!.closest("[aria-live]")).toBeNull();
  });

  it("empties the region on the next edit, so the next save is announced again", () => {
    const { api, region } = setup();
    act(() => api().type());
    act(() => api().saved());
    act(() => api().type());
    expect(region().textContent).toBe("");
    act(() => api().saved());
    expect(region().textContent).toBe("Changes saved.");
  });
});
