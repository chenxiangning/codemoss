import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-about export surface", () => {
  it("re-exports product About without moving source", () => {
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(ui).toContain('from "../../../src/features/about/components/AboutView"');
    const lazyWindows = readFileSync(join(repoRoot, "src/router/lazyWindows.tsx"), "utf8");
    expect(lazyWindows).toContain("@mossx/plugin-about/ui");
    expect(lazyWindows).not.toContain("features/about/components/AboutView");
  });
});
