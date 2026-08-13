import { describe, expect, it } from "vitest";
import {
  clampUiScale,
  formatUiScalePercentLabel,
  listUiScaleSelectOptions,
  matchUiScalePreset,
  sanitizeUiScale,
  UI_SCALE_DEFAULT,
  UI_SCALE_LOCKED,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_PRESETS,
} from "./uiScale";

describe("uiScale utilities (locked to 100%)", () => {
  it("exposes the hard lock constants", () => {
    expect(UI_SCALE_LOCKED).toBe(true);
    expect(UI_SCALE_MIN).toBe(1);
    expect(UI_SCALE_MAX).toBe(1);
    expect(UI_SCALE_DEFAULT).toBe(1);
    expect(UI_SCALE_PRESETS).toEqual([1]);
  });

  it("clampUiScale always returns identity for any input", () => {
    expect(clampUiScale(0.8)).toBe(1);
    expect(clampUiScale(0.9)).toBe(1);
    expect(clampUiScale(1)).toBe(1);
    expect(clampUiScale(1.25)).toBe(1);
    expect(clampUiScale(2.6)).toBe(1);
    expect(clampUiScale(Number.NaN)).toBe(1);
    expect(clampUiScale(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("sanitizeUiScale always returns identity for legacy / invalid values", () => {
    expect(sanitizeUiScale(0.04)).toBe(1);
    expect(sanitizeUiScale(0.9)).toBe(1);
    expect(sanitizeUiScale(1.25)).toBe(1);
    expect(sanitizeUiScale(Number.NaN)).toBe(1);
  });

  it("select helpers only expose 100%", () => {
    expect(formatUiScalePercentLabel(1.2)).toBe("100%");
    expect(matchUiScalePreset(1)).toBe(1);
    expect(matchUiScalePreset(0.9)).toBeNull();
    expect(listUiScaleSelectOptions(0.9)).toEqual([1]);
    expect(listUiScaleSelectOptions(1.25)).toEqual([1]);
  });
});
