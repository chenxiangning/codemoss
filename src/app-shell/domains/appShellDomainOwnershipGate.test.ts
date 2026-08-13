import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS,
  listAppShellDomainContextNames,
} from "./appShellDomainContexts";
import {
  APP_SHELL_DOMAIN_KEY_HARD_BUDGETS,
  compareDomainContextKeysWithOwnedKeys,
  evaluateAppShellDomainOwnershipGate,
  listDomainOwnershipHardFailures,
  listDomainOwnershipSoftFailures,
} from "./appShellDomainOwnershipGate";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readAssemblySource(): string {
  return readFileSync(join(currentDir, "useAppShellDomainAssembly.ts"), "utf8");
}

describe("appShellDomainOwnershipGate (T1.8)", () => {
  it("hard-fails on unowned / stale / missing / overlapping keys and hard budgets", () => {
    const report = evaluateAppShellDomainOwnershipGate(readAssemblySource());
    const hardFailures = listDomainOwnershipHardFailures(report);

    expect(hardFailures, hardFailures.join("\n")).toEqual([]);
    expect(report.overlappingOwnedKeys).toEqual([]);
    expect(report.missingDomainsInAssembly).toEqual([]);
    expect(report.unownedExplicitKeysByDomain).toEqual({});
    expect(report.staleOwnedKeysByDomain).toEqual({});
    expect(report.hardBudgetViolations).toEqual([]);
  });

  it("locks workspaceNavigation hard budget at 80 (T1.7/T5.1)", () => {
    expect(APP_SHELL_DOMAIN_KEY_HARD_BUDGETS.workspaceNavigationContext).toBe(
      80,
    );
    expect(
      APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.workspaceNavigationContext.length,
    ).toBeLessThanOrEqual(80);
  });

  it("covers every domain name in the ownership map with hard budgets (T5.1)", () => {
    for (const domainName of listAppShellDomainContextNames()) {
      expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domainName]?.length).toBeGreaterThan(
        0,
      );
      expect(APP_SHELL_DOMAIN_KEY_HARD_BUDGETS[domainName]).toBeTypeOf("number");
      expect(
        APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domainName].length,
      ).toBeLessThanOrEqual(APP_SHELL_DOMAIN_KEY_HARD_BUDGETS[domainName]);
    }
  });

  it("detects unowned keys in the compare helper (unit)", () => {
    const comparison = compareDomainContextKeysWithOwnedKeys(
      ["activeWorkspaceId", "newUnownedRuntimeKey"],
      ["activeWorkspaceId"],
    );
    expect(comparison.missingOwnerKeys).toEqual(["newUnownedRuntimeKey"]);
    expect(comparison.staleOwnerKeys).toEqual([]);
  });

  it("records soft budget overflows (soft 80) without hard-fail (T5.1)", () => {
    const report = evaluateAppShellDomainOwnershipGate(readAssemblySource());
    const soft = listDomainOwnershipSoftFailures(report);
    expect(soft.length).toBeGreaterThan(0);
    expect(listDomainOwnershipHardFailures(report)).toEqual([]);
  });
});
