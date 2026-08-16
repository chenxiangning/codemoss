import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-computer-use export surface", () => {
  it("re-exports product Computer Use without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/computer-use/constants"');
    expect(ui).toContain('from "../../../src/features/computer-use/components/ComputerUseStatusCard"');
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/settings-view/sections/CodexSection.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-computer-use/ui"');
    expect(settings).toContain('from "@mossx/plugin-computer-use/runtime"');
    expect(settings).not.toContain("@/features/computer-use/components/ComputerUseStatusCard");
  });
});
