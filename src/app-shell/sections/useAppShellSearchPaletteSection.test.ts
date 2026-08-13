// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAppShellSearchPaletteSection } from "./useAppShellSearchPaletteSection";

describe("useAppShellSearchPaletteSection", () => {
  it("exposes the default search palette state used by AppShell", () => {
    const view = renderHook(() => useAppShellSearchPaletteSection());

    expect(view.result.current.isSearchPaletteOpen).toBe(false);
    expect(view.result.current.searchScope).toBe("active-workspace");
    expect(view.result.current.searchContentFilters).toEqual(["all"]);
    expect(view.result.current.searchPaletteQuery).toBe("");
    expect(view.result.current.searchPaletteSelectedIndex).toBe(0);
    expect(view.result.current.globalSearchFilesByWorkspace).toEqual({});
  });

  it("keeps setter contracts available for downstream search sections", () => {
    const view = renderHook(() => useAppShellSearchPaletteSection());

    act(() => {
      view.result.current.setIsSearchPaletteOpen(true);
      view.result.current.setSearchScope("global");
      view.result.current.setSearchContentFilters((previous) => [
        ...previous,
        "files",
      ]);
      view.result.current.setSearchPaletteQuery("config");
      view.result.current.setSearchPaletteSelectedIndex(3);
      view.result.current.setGlobalSearchFilesByWorkspace({
        workspaceA: {
          files: ["README.md"],
          status: "complete",
          sourceVersion: "source-v1",
          error: null,
        },
      });
    });

    expect(view.result.current.isSearchPaletteOpen).toBe(true);
    expect(view.result.current.searchScope).toBe("global");
    expect(view.result.current.searchContentFilters).toEqual(["all", "files"]);
    expect(view.result.current.searchPaletteQuery).toBe("config");
    expect(view.result.current.searchPaletteSelectedIndex).toBe(3);
    expect(view.result.current.globalSearchFilesByWorkspace).toEqual({
      workspaceA: {
        files: ["README.md"],
        status: "complete",
        sourceVersion: "source-v1",
        error: null,
      },
    });
  });
});
