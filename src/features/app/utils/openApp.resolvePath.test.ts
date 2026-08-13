import { describe, expect, it } from "vitest";
import { resolveOpenAppPath } from "./openApp";

describe("resolveOpenAppPath", () => {
  it("uses workspace path for file-manager targets", () => {
    expect(
      resolveOpenAppPath(
        { kind: "finder" },
        {
          workspacePath: "/Users/me/project",
          activeFilePath: "src/App.tsx",
        },
      ),
    ).toBe("/Users/me/project");
  });

  it("prefers active file for app targets", () => {
    expect(
      resolveOpenAppPath(
        { kind: "app" },
        {
          workspacePath: "/Users/me/project",
          activeFilePath: "src/App.tsx",
        },
      ),
    ).toBe("/Users/me/project/src/App.tsx");
  });

  it("keeps absolute active file paths", () => {
    expect(
      resolveOpenAppPath(
        { kind: "app" },
        {
          workspacePath: "/Users/me/project",
          activeFilePath: "/Users/me/project/src/App.tsx",
        },
      ),
    ).toBe("/Users/me/project/src/App.tsx");
  });

  it("falls back to workspace when no active file", () => {
    expect(
      resolveOpenAppPath(
        { kind: "command" },
        {
          workspacePath: "/Users/me/project",
          activeFilePath: null,
        },
      ),
    ).toBe("/Users/me/project");
  });
});
