import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-governance export surface", () => {
  it("re-exports product Governance without inventing a UI panel", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/governance/evidence"');
    const panel = readFileSync(
      join(repoRoot, "src/features/status-panel/components/StatusPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain('from "@mossx/plugin-governance/runtime"');
    expect(panel).not.toContain("governance/evidence");
  });
});
