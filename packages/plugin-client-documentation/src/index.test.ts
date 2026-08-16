import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-client-documentation export surface", () => {
  it("re-exports product Client Documentation without moving source", () => {
    const runtime = readFileSync(join(currentDir, "runtime.ts"), "utf8");
    const ui = readFileSync(join(currentDir, "ui.ts"), "utf8");
    expect(runtime).toContain(
      'from "../../../src/features/client-documentation/clientDocumentationWindow"',
    );
    expect(ui).toContain(
      'from "../../../src/features/client-documentation/components/ClientDocumentationWindow"',
    );
    const sections = readFileSync(
      join(repoRoot, "src/app-shell/sections/core/useAppShellSections.ts"),
      "utf8",
    );
    expect(sections).toContain("@mossx/plugin-client-documentation/runtime");
    expect(sections).not.toContain("features/client-documentation/clientDocumentationWindow");
    const lazyWindows = readFileSync(join(repoRoot, "src/router/lazyWindows.tsx"), "utf8");
    expect(lazyWindows).toContain("@mossx/plugin-client-documentation/ui");
    expect(lazyWindows).not.toContain("features/client-documentation/components/ClientDocumentationWindow");
  });
});
