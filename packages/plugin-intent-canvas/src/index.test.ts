import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-intent-canvas export surface", () => {
  it("re-exports product Intent Canvas without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/intent-canvas/utils/context"');
    expect(ui).toContain('from "../../../src/features/intent-canvas/components/IntentCanvasManager"');
    const host = readFileSync(
      join(repoRoot, "src/app-shell/sections/layoutNodes/useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    expect(host).toContain('from "@mossx/plugin-intent-canvas/runtime"');
    expect(host).not.toContain("features/intent-canvas/utils/context");
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('import("@mossx/plugin-intent-canvas/ui")');
    expect(layout).not.toContain("intent-canvas/components/IntentCanvasManager");
  });
});
