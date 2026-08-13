import { describe, expect, it } from "vitest";
import { resolveOpenAppHealth } from "./openAppHealth";

describe("resolveOpenAppHealth", () => {
  it("marks finder as ok", () => {
    expect(
      resolveOpenAppHealth(
        { id: "finder", kind: "finder", appName: null, command: null },
        {},
      ),
    ).toBe("ok");
  });

  it("marks empty app as broken", () => {
    expect(
      resolveOpenAppHealth(
        { id: "x", kind: "app", appName: "", command: null },
        {},
      ),
    ).toBe("broken");
  });

  it("uses probe map by id", () => {
    expect(
      resolveOpenAppHealth(
        {
          id: "vscode",
          kind: "app",
          appName: "Visual Studio Code",
          command: null,
        },
        {
          vscode: {
            id: "vscode",
            installed: true,
            resolvedPath: "/Applications/Visual Studio Code.app",
          },
        },
      ),
    ).toBe("ok");
    expect(
      resolveOpenAppHealth(
        { id: "cursor", kind: "app", appName: "Cursor", command: null },
        { cursor: { id: "cursor", installed: false } },
      ),
    ).toBe("missing");
  });

  it("prefers target-level probe for absolute paths", () => {
    expect(
      resolveOpenAppHealth(
        {
          id: "chrome-1",
          kind: "app",
          appName: "/Applications/Google Chrome.app",
          command: null,
        },
        {},
        {
          "chrome-1": { status: "ok", resolvedPath: "/Applications/Google Chrome.app" },
        },
      ),
    ).toBe("ok");
  });

  it("marks absolute path without target probe as unknown", () => {
    expect(
      resolveOpenAppHealth(
        {
          id: "custom",
          kind: "app",
          appName: "/Applications/Sublime Text.app",
          command: null,
        },
        {},
      ),
    ).toBe("unknown");
  });
});
