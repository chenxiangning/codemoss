import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T4：生产 consumer 不得再调用 Legacy 命名的 adapt/flatten API；
 * 应使用 selectAppShellDomainBag / bind / merge。
 */

const currentDir = dirname(fileURLToPath(import.meta.url));

const PRODUCTION_CONSUMERS = [
  "../render/renderAppShell.tsx",
  "../sections/core/useAppShellSections.ts",
  "../sections/layoutNodes/useAppShellLayoutNodesSection.tsx",
] as const;

describe("appShellLegacyFlattenRetirement (T4)", () => {
  it("lists production consumers on selected domain bag API (T4.1/T4.2)", () => {
    for (const rel of PRODUCTION_CONSUMERS) {
      const source = readFileSync(join(currentDir, rel), "utf8");
      expect(source).toContain("selectAppShellDomainBag");
      expect(source).not.toContain("adaptAppShellLegacyFlatContext");
      expect(source).not.toContain(
        "flattenSelectedAppShellDomainContextsMemoized(",
      );
      expect(source).not.toContain("flattenAppShellDomainContexts(");
    }
  });

  it("keeps full-flatten only behind legacy facade module (T4.5)", () => {
    const legacy = readFileSync(
      join(currentDir, "../legacy/legacyFlatten.ts"),
      "utf8",
    );
    expect(legacy).toContain("@deprecated");
    expect(legacy).toContain("selectAppShellDomainBag");
  });

  it("locks consumer domain selection sets as the required flatten sets (T4.3)", () => {
    const source = readFileSync(
      join(currentDir, "../domains/appShellDomainContexts.ts"),
      "utf8",
    );
    expect(source).toContain("APP_SHELL_CONSUMER_DOMAIN_SELECTION");
    // sections/render 不得包含 runtimeThread（热路径隔离）
    const sectionsBlock = source.slice(
      source.indexOf("sections: ["),
      source.indexOf("render: ["),
    );
    expect(sectionsBlock).not.toContain("runtimeThreadContext");
  });
});
