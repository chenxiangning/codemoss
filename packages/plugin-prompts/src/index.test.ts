import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-prompts export surface", () => {
  it("re-exports product Prompts without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/prompts/hooks/useCustomPrompts"');
    expect(ui).toContain('from "../../../src/features/prompts/components/PromptPanel"');
    const composition = readFileSync(
      join(repoRoot, "src/app-shell/assembly/useAppShellRootComposition.ts"),
      "utf8",
    );
    expect(composition).toContain('from "@mossx/plugin-prompts/runtime"');
    expect(composition).not.toContain("features/prompts/hooks/useCustomPrompts");
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('from "@mossx/plugin-prompts/ui"');
    expect(layout).not.toContain("prompts/components/PromptPanel");
  });
});
