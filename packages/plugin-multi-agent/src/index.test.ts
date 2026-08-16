import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-multi-agent export surface", () => {
  it("re-exports product Multi-Agent without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/multi-agent/store/agentStore"');
    expect(ui).toContain('from "../../../src/features/multi-agent/components/ConversationHost"');
    const layout = readFileSync(
      join(repoRoot, "src/features/layout/components/DesktopLayout.tsx"),
      "utf8",
    );
    expect(layout).toContain('from "@mossx/plugin-multi-agent/ui"');
    expect(layout).not.toContain('from "../../multi-agent"');
    const composer = readFileSync(
      join(repoRoot, "src/features/composer/components/Composer.tsx"),
      "utf8",
    );
    expect(composer).toContain('from "@mossx/plugin-multi-agent/runtime"');
    expect(composer).toContain('from "@mossx/plugin-multi-agent/ui"');
    expect(composer).not.toContain("multi-agent/store/agentStore");
  });
});
