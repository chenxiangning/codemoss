import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-engine-pi export surface", () => {
  it("re-exports product Pi history without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/threads/loaders/piHistoryLoader"');
    expect(runtime).toContain('from "../../../src/features/threads/loaders/piHistoryParser"');
    const factory = readFileSync(
      join(repoRoot, "src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts"),
      "utf8",
    );
    expect(factory).toContain('from "@mossx/plugin-engine-pi/runtime"');
    expect(factory).not.toContain("../loaders/piHistoryLoader");
    const resume = readFileSync(
      join(repoRoot, "src/features/threads/hooks/useThreadActionsResumeThread.ts"),
      "utf8",
    );
    expect(resume).toContain('from "@mossx/plugin-engine-pi/runtime"');
    expect(resume).not.toContain("../loaders/piHistoryParser");
  });
});
