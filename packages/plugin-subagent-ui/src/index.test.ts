import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-subagent-ui export surface", () => {
  it("re-exports product Subagent UI without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/subagent-ui/hooks/useSubagentInspectorStore"');
    expect(ui).toContain('from "../../../src/features/subagent-ui/components/PersonaAvatar"');
    const layout = readFileSync(
      join(repoRoot, "src/features/layout/components/DesktopLayout.tsx"),
      "utf8",
    );
    expect(layout).toContain('from "@mossx/plugin-subagent-ui/runtime"');
    expect(layout).not.toContain('from "../../subagent-ui"');
    const composer = readFileSync(
      join(repoRoot, "src/features/composer/components/Composer.tsx"),
      "utf8",
    );
    expect(composer).toContain('from "@mossx/plugin-subagent-ui/runtime"');
    expect(composer).not.toContain('from "../../subagent-ui"');
  });
});
