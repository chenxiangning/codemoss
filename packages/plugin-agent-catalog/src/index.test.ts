import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-agent-catalog export surface", () => {
  it("re-exports product Agent Catalog without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/agent-catalog/events"');
    expect(ui).toContain(
      'from "../../../src/features/agent-catalog/components/BuiltInAgentCatalogSection"',
    );
    const session = readFileSync(
      join(repoRoot, "src/app-shell/domains/useSelectedAgentSession.ts"),
      "utf8",
    );
    expect(session).toContain('from "@mossx/plugin-agent-catalog/runtime"');
    expect(session).not.toContain("features/agent-catalog/events");
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/AgentSettingsSection.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-agent-catalog/ui"');
    expect(settings).not.toContain("agent-catalog/components/BuiltInAgentCatalogSection");
  });
});
