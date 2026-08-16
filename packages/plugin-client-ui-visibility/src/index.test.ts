import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-client-ui-visibility export surface", () => {
  it("re-exports product Client UI Visibility without inventing a UI panel", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain(
      'from "../../../src/features/client-ui-visibility/hooks/useClientUiVisibility"',
    );
    const layout = readFileSync(
      join(repoRoot, "src/app-shell/sections/layoutNodes/useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    expect(layout).toContain('from "@mossx/plugin-client-ui-visibility/runtime"');
    expect(layout).not.toContain("features/client-ui-visibility/hooks/useClientUiVisibility");
    const settings = readFileSync(
      join(repoRoot, "src/features/settings/components/settings-view/sections/BasicAppearanceSection.tsx"),
      "utf8",
    );
    expect(settings).toContain('from "@mossx/plugin-client-ui-visibility/runtime"');
    expect(settings).not.toContain("client-ui-visibility/hooks/useClientUiVisibility");
  });
});
