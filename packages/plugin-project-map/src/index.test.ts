import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-project-map export surface", () => {
  it("re-exports product Project Map without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/project-map/hooks/useProjectMapDataset"');
    expect(ui).toContain('from "../../../src/features/project-map/components/ProjectMapPanel"');
    const host = readFileSync(
      join(repoRoot, "src/app-shell/sections/layoutNodes/useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    expect(host).toContain('from "@mossx/plugin-project-map/runtime"');
    expect(host).not.toContain("features/project-map/hooks/useProjectMapDataset");
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('import("@mossx/plugin-project-map/ui")');
    expect(layout).not.toContain("project-map/components/ProjectMapPanel");
  });
});
