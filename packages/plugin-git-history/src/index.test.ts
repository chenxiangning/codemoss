import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-git-history export surface", () => {
  it("re-exports product Git History without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/git-history/types"');
    expect(ui).toContain('from "../../../src/features/git-history/components/GitHistoryPanel"');
    const host = readFileSync(
      join(repoRoot, "src/app-shell/sections/layoutNodes/useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    expect(host).toContain('from "@mossx/plugin-git-history/runtime"');
    expect(host).not.toContain("features/git-history/types");
    const lazyViews = readFileSync(join(repoRoot, "src/app-shell/render/lazyViews.tsx"), "utf8");
    expect(lazyViews).toContain('import("@mossx/plugin-git-history/ui")');
    expect(lazyViews).not.toContain("features/git-history/components/GitHistoryPanel");
  });
});
