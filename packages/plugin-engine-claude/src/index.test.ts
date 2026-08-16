import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-engine-claude export surface", () => {
  it("re-exports Claude frontend helpers without deleting engine/claude", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/models/claudeManagedRuntimeModel"');
    expect(runtime).toContain('from "../../../src/features/app/utils/claudeResumeCommand"');
    const composer = readFileSync(
      join(repoRoot, "src/app-shell/domains/useAppShellComposerModelSection.ts"),
      "utf8",
    );
    expect(composer).toContain('from "@mossx/plugin-engine-claude/runtime"');
    expect(composer).not.toContain("features/models/claudeManagedRuntimeModel");
    const flows = readFileSync(
      join(repoRoot, "src/app-shell/sections/useAppShellWorkspaceFlowsSection.ts"),
      "utf8",
    );
    expect(flows).toContain('from "@mossx/plugin-engine-claude/runtime"');
    expect(flows).not.toContain("features/app/utils/claudeResumeCommand");
    expect(existsSync(join(repoRoot, "src-tauri/src/engine/claude.rs"))).toBe(true);
    expect(existsSync(join(repoRoot, "src-tauri/src/engine/claude_history.rs"))).toBe(true);
  });
});
