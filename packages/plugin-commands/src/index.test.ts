import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-commands export surface", () => {
  it("re-exports product Commands without inventing a UI panel", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/commands/hooks/useCustomCommands"');
    const composition = readFileSync(
      join(repoRoot, "src/app-shell/assembly/useAppShellRootComposition.ts"),
      "utf8",
    );
    expect(composition).toContain('from "@mossx/plugin-commands/runtime"');
    expect(composition).not.toContain("features/commands/hooks/useCustomCommands");
  });
});
