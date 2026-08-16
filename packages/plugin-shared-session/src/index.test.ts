import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-shared-session export surface", () => {
  it("re-exports product Shared Session without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/shared-session/utils/sharedSessionIdentity"');
    expect(ui).toContain('from "../../../src/features/shared-session/components/SharedSessionIcon"');
    const composition = readFileSync(
      join(repoRoot, "src/app-shell/assembly/useAppShellRootComposition.ts"),
      "utf8",
    );
    expect(composition).toContain('from "@mossx/plugin-shared-session/runtime"');
    expect(composition).not.toContain("features/shared-session/utils/sharedSessionIdentity");
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('from "@mossx/plugin-shared-session/ui"');
    expect(layout).not.toContain("shared-session/components/SharedSendStatusBar");
  });
});
