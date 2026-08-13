import { describe, expect, it } from "vitest";
import { getOpenAppPresetsForHost } from "./openAppPresets";

describe("openAppPresets", () => {
  it("excludes mac-only presets on windows", () => {
    const ids = getOpenAppPresetsForHost("windows").map((p) => p.id);
    expect(ids).toContain("vscode");
    expect(ids).toContain("notepad");
    expect(ids).not.toContain("ghostty");
  });

  it("includes ghostty on macos and excludes notepad", () => {
    const ids = getOpenAppPresetsForHost("macos").map((p) => p.id);
    expect(ids).toContain("ghostty");
    expect(ids).not.toContain("notepad");
    expect(ids).toContain("finder");
  });
});
