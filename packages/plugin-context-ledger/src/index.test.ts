import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-context-ledger export surface", () => {
  it("re-exports product Context Ledger without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/context-ledger/utils/contextLedgerProjection"');
    expect(ui).toContain('from "../../../src/features/context-ledger/components/ContextLedgerPanel"');
    const composer = readFileSync(
      join(repoRoot, "src/features/composer/components/Composer.tsx"),
      "utf8",
    );
    expect(composer).toContain('from "@mossx/plugin-context-ledger/runtime"');
    expect(composer).not.toContain("context-ledger/utils/contextLedgerProjection");
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/settings-view/sections/CostBudgetSettingsSection.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-context-ledger/runtime"');
    expect(settings).not.toContain("context-ledger/cost-budget");
  });
});
