import { describe, expect, it } from "vitest";
import {
  parsePreferencesPatch,
  SETTINGS_PANE_DEFAULT_WIDTH,
  settingsPaneLimits,
  settingsPaneWidth,
} from "./index";

describe("settings pane limits", () => {
  it("is 280px to half the viewport", () => {
    expect(settingsPaneLimits(1600)).toEqual({ min: 280, max: 800 });
    expect(settingsPaneLimits(1281)).toEqual({ min: 280, max: 640 });
  });

  it("keeps the minimum when half the viewport is below it", () => {
    expect(settingsPaneLimits(500)).toEqual({ min: 280, max: 280 });
    expect(settingsPaneLimits(560)).toEqual({ min: 280, max: 280 });
  });
});

describe("settingsPaneWidth", () => {
  it("is the default with nothing saved", () => {
    expect(SETTINGS_PANE_DEFAULT_WIDTH).toBe(300);
    expect(settingsPaneWidth(null, 1600)).toBe(300);
    expect(settingsPaneWidth(undefined, 1600)).toBe(300);
  });

  it("is the saved width when it fits", () => {
    expect(settingsPaneWidth(520, 1600)).toBe(520);
  });

  it("holds a saved width within this screen's limits", () => {
    expect(settingsPaneWidth(1200, 1600)).toBe(800);
    expect(settingsPaneWidth(220, 1600)).toBe(280);
    expect(settingsPaneWidth(700, 500)).toBe(280);
  });

  it("holds the default within the limits too", () => {
    // Half of 560 is 280, under the default.
    expect(settingsPaneWidth(null, 560)).toBe(280);
  });
});

describe("parsePreferencesPatch", () => {
  it("takes a whole number from 200 to 4000", () => {
    for (const w of [200, 300, 4000]) {
      expect(parsePreferencesPatch({ settingsPaneWidth: w })).toEqual({ ok: true, value: { settingsPaneWidth: w } });
    }
  });

  it("takes null, which clears it", () => {
    expect(parsePreferencesPatch({ settingsPaneWidth: null })).toEqual({ ok: true, value: { settingsPaneWidth: null } });
  });

  it("refuses anything else, with one message", () => {
    const message = "settingsPaneWidth must be a whole number of pixels from 200 to 4000, or null.";
    for (const w of [199, 4001, 300.5, "300", true, Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      expect(parsePreferencesPatch({ settingsPaneWidth: w })).toEqual({ ok: false, message });
    }
    expect(parsePreferencesPatch({})).toEqual({ ok: false, message });
  });

  it("refuses unknown preferences and bodies that aren't objects", () => {
    expect(parsePreferencesPatch({ settingsPaneWidth: 300, theme: "dark" })).toEqual({
      ok: false,
      message: "Unknown preference: theme.",
    });
    for (const body of [null, undefined, 300, "x", [300]]) {
      expect(parsePreferencesPatch(body)).toEqual({ ok: false, message: "Send an object: { settingsPaneWidth }." });
    }
  });
});
