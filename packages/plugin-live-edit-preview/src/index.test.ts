import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-live-edit-preview export surface", () => {
  it("re-exports product Live Edit Preview without inventing a UI panel", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain(
      'from "../../../src/features/live-edit-preview/hooks/useLiveEditPreview"',
    );
    const sections = readFileSync(
      join(repoRoot, "src/app-shell/sections/core/useAppShellSections.ts"),
      "utf8",
    );
    expect(sections).toContain('from "@mossx/plugin-live-edit-preview/runtime"');
    expect(sections).not.toContain("features/live-edit-preview/hooks/useLiveEditPreview");
  });
});
