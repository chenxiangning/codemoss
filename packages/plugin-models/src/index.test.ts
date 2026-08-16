import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-models export surface", () => {
  it("re-exports product Models without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/models/hooks/useModels"');
    expect(ui).toContain('from "../../../src/features/models/components/ModelMappingSettings"');
    const composition = readFileSync(
      join(repoRoot, "src/app-shell/assembly/useAppShellRootComposition.ts"),
      "utf8",
    );
    expect(composition).toContain('from "@mossx/plugin-models/runtime"');
    expect(composition).not.toContain("features/models/hooks/useModels");
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/settings-view/sections/ComposerSection.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-models/ui"');
    expect(settings).not.toContain("models/components/ModelMappingSettings");
  });
});
