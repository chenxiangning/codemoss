import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-status export surface", () => {
  it("re-exports product Status without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/status-panel/hooks/useStatusPanelData"');
    expect(ui).toContain('from "../../../src/features/status-panel/components/StatusPanel"');
    const layout = readFileSync(
      join(repoRoot, "src/features/layout/hooks/activeCanvasStatusPanelNode.tsx"),
      "utf8",
    );
    expect(layout).toContain('from "@mossx/plugin-status/ui"');
    expect(layout).not.toContain("status-panel/components/StatusPanel");
    const composer = readFileSync(
      join(repoRoot, "src/features/composer/components/Composer.tsx"),
      "utf8",
    );
    expect(composer).toContain('from "@mossx/plugin-status/runtime"');
    expect(composer).not.toContain("status-panel/hooks/useStatusPanelData");
  });
});
