import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-skills export surface", () => {
  it("re-exports product Skills without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/skills/hooks/useSkills"');
    expect(ui).toContain('from "../../../src/features/curated-skills/components/CuratedSection"');
    const composition = readFileSync(
      join(repoRoot, "src/app-shell/assembly/useAppShellRootComposition.ts"),
      "utf8",
    );
    expect(composition).toContain('from "@mossx/plugin-skills/runtime"');
    expect(composition).not.toContain("features/skills/hooks/useSkills");
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/settings-view/sections/OtherSection.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-skills/ui"');
    expect(settings).not.toContain("curated-skills");
  });
});
