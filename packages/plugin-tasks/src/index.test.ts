import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-tasks export surface", () => {
  it("re-exports product Tasks without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/tasks/utils/taskRunStorage"');
    expect(ui).toContain('from "../../../src/features/tasks/components/TaskCenterView"');
    const execution = readFileSync(
      join(repoRoot, "src/app-shell/sections/useAppShellKanbanExecutionSection.ts"),
      "utf8",
    );
    expect(execution).toContain('from "@mossx/plugin-tasks/runtime"');
    expect(execution).not.toContain("features/tasks/utils/taskRunStorage");
    const home = readFileSync(
      join(repoRoot, "src/features/workspaces/components/WorkspaceHome.tsx"),
      "utf8",
    );
    expect(home).toContain('from "@mossx/plugin-tasks/ui"');
    expect(home).not.toContain("tasks/components/TaskCenterView");
  });
});
