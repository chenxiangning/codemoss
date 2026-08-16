import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-terminal export surface", () => {
  it("re-exports product Terminal without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/terminal/hooks/useTerminalController"');
    expect(ui).toContain('from "../../../src/features/terminal/components/TerminalDock"');
    const flows = readFileSync(
      join(repoRoot, "src/app-shell/sections/useAppShellWorkspaceFlowsSection.ts"),
      "utf8",
    );
    expect(flows).toContain('from "@mossx/plugin-terminal/runtime"');
    expect(flows).not.toContain("features/terminal/hooks/useTerminalController");
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/layoutNodeSections.tsx"), "utf8");
    expect(layout).toContain('from "@mossx/plugin-terminal/ui"');
    expect(layout).not.toContain("terminal/components/TerminalDock");
  });
});
