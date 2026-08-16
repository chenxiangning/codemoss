import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-engine-opencode export surface", () => {
  it("re-exports product OpenCode history without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/threads/loaders/opencodeHistoryLoader"');
    const factory = readFileSync(
      join(repoRoot, "src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts"),
      "utf8",
    );
    expect(factory).toContain('from "@mossx/plugin-engine-opencode/runtime"');
    expect(factory).not.toContain("../loaders/opencodeHistoryLoader");
  });
});
