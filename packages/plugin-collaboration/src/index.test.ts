import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-collaboration export surface", () => {
  it("re-exports product Collaboration without inventing a UI panel", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/collaboration/hooks/useCollaborationModes"');
    const composition = readFileSync(
      join(repoRoot, "src/app-shell/assembly/useAppShellRootComposition.ts"),
      "utf8",
    );
    expect(composition).toContain('from "@mossx/plugin-collaboration/runtime"');
    expect(composition).not.toContain("features/collaboration/hooks/useCollaborationModes");
    const composer = readFileSync(
      join(repoRoot, "src/app-shell/domains/useAppShellComposerModelSection.ts"),
      "utf8",
    );
    expect(composer).toContain('from "@mossx/plugin-collaboration/runtime"');
    expect(composer).not.toContain("features/collaboration/hooks/useCollaborationModeSelection");
  });
});
