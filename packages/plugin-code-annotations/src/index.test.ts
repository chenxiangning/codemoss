import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-code-annotations export surface", () => {
  it("re-exports product Code Annotations without inventing a UI panel", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    expect(runtime).toContain('from "../../../src/features/code-annotations/types"');
    expect(runtime).toContain('from "../../../src/features/code-annotations/utils/codeAnnotations"');
    const layout = readFileSync(join(repoRoot, "src/features/layout/hooks/useLayoutNodes.tsx"), "utf8");
    expect(layout).toContain('from "@mossx/plugin-code-annotations/runtime"');
    expect(layout).not.toContain("code-annotations/types");
    const composer = readFileSync(join(repoRoot, "src/features/composer/components/Composer.tsx"), "utf8");
    expect(composer).toContain('from "@mossx/plugin-code-annotations/runtime"');
    expect(composer).not.toContain("code-annotations/utils/codeAnnotations");
  });
});
