import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-operation-facts export surface", () => {
  it("re-exports product Operation Facts without inventing a UI panel", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/operation-facts/operationFacts"');
    const status = readFileSync(
      join(repoRoot, "src/features/status-panel/hooks/useStatusPanelData.ts"),
      "utf8",
    );
    expect(status).toContain('from "@mossx/plugin-operation-facts/runtime"');
    expect(status).not.toContain("operation-facts/operationFacts");
    const composer = readFileSync(
      join(repoRoot, "src/features/composer/utils/composerFileReferences.ts"),
      "utf8",
    );
    expect(composer).toContain('from "@mossx/plugin-operation-facts/runtime"');
  });
});
