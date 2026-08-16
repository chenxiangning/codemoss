import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-browser export surface", () => {
  it("re-exports product Browser without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/browser-agent/utils/attachment"');
    expect(ui).toContain('from "../../../src/features/browser-agent/components/BrowserDock"');
    const execution = readFileSync(
      join(repoRoot, "src/app-shell/sections/useAppShellKanbanExecutionSection.ts"),
      "utf8",
    );
    expect(execution).toContain('from "@mossx/plugin-browser/runtime"');
    expect(execution).not.toContain("features/browser-agent");
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('import("@mossx/plugin-browser/ui")');
    expect(layout).not.toContain("browser-agent/components/BrowserDock");
  });
});
