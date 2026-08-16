import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-runtime-log export surface", () => {
  it("re-exports product Runtime Log without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain(
      'from "../../../src/features/runtime-log/hooks/useRuntimeLogSession"',
    );
    expect(ui).toContain(
      'from "../../../src/features/runtime-log/components/RuntimeLogPanel"',
    );
    const hook = readFileSync(
      join(repoRoot, "src/features/app/hooks/useWorkspaceRuntimeRun.ts"),
      "utf8",
    );
    expect(hook).toContain('from "@mossx/plugin-runtime-log/runtime"');
    expect(hook).not.toContain("runtime-log/hooks/useRuntimeLogSession");
    const dock = readFileSync(
      join(repoRoot, "src/features/app/components/RuntimeConsoleDock.tsx"),
      "utf8",
    );
    expect(dock).toContain('from "@mossx/plugin-runtime-log/ui"');
    expect(dock).not.toContain("runtime-log/components/RuntimeLogPanel");
  });
});
