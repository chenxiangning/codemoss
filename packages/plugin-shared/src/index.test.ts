import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-shared export surface", () => {
  it("re-exports product Shared without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/shared/hooks/useFileEditor"');
    expect(ui).toContain('from "../../../src/features/shared/components/FileEditorCard"');
    const workspace = readFileSync(
      join(repoRoot, "src/features/workspaces/hooks/useWorkspaceClaudeMd.ts"),
      "utf8",
    );
    expect(workspace).toContain('from "@mossx/plugin-shared/runtime"');
    expect(workspace).not.toContain("shared/hooks/useFileEditor");
  });
});
