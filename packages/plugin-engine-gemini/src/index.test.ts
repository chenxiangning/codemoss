import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-engine-gemini export surface", () => {
  it("re-exports product Gemini history without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/threads/loaders/geminiHistoryLoader"');
    expect(runtime).toContain('from "../../../src/features/threads/loaders/geminiHistoryParser"');
    const factory = readFileSync(
      join(repoRoot, "src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts"),
      "utf8",
    );
    expect(factory).toContain('from "@mossx/plugin-engine-gemini/runtime"');
    expect(factory).not.toContain("../loaders/geminiHistoryLoader");
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/settings-view/sections/SessionManagementSection.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-engine-gemini/runtime"');
    expect(settings).not.toContain("threads/loaders/geminiHistoryParser");
  });
});
