import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-spec export surface", () => {
  it("re-exports product Spec without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/spec/pathUtils"');
    expect(ui).toContain('from "../../../src/features/spec/components/SpecHub"');
    const lazyViews = readFileSync(join(repoRoot, "src/app-shell/render/lazyViews.tsx"), "utf8");
    expect(lazyViews).toContain('import("@mossx/plugin-spec/ui")');
    expect(lazyViews).not.toContain("features/spec/components/SpecHub");
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('from "@mossx/plugin-spec/runtime"');
    expect(layout).not.toContain("spec/pathUtils");
  });
});
