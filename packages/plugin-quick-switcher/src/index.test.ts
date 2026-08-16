import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-quick-switcher export surface", () => {
  it("re-exports product Quick Switcher without inventing a Search plugin", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/quick-switcher/hooks/useQuickSwitcherRecentFiles"');
    expect(ui).toContain('from "../../../src/features/quick-switcher/components/QuickSwitcher"');
    const section = readFileSync(
      join(repoRoot, "src/app-shell/sections/useAppShellQuickSwitcherSection.ts"),
      "utf8",
    );
    expect(section).toContain('from "@mossx/plugin-quick-switcher/runtime"');
    expect(section).not.toContain("features/quick-switcher/hooks/useQuickSwitcherRecentFiles");
    const lazyViews = readFileSync(join(repoRoot, "src/app-shell/render/lazyViews.tsx"), "utf8");
    expect(lazyViews).toContain('import("@mossx/plugin-quick-switcher/ui")');
    expect(lazyViews).not.toContain("features/quick-switcher/components/QuickSwitcher");
  });
});
