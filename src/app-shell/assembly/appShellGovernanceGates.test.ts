import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS,
  listAppShellDomainContextNames,
} from "../domains/appShellDomainContexts";
import {
  APP_SHELL_DOMAIN_KEY_DEFAULT_SOFT,
  APP_SHELL_DOMAIN_KEY_HARD_BUDGETS,
  APP_SHELL_DOMAIN_KEY_TARGET_HARD,
  evaluateAppShellDomainOwnershipGate,
  listDomainOwnershipHardFailures,
  listDomainOwnershipSoftFailures,
} from "../domains/appShellDomainOwnershipGate";

/**
 * T5：AppShell 治理门禁（预算 / composition / useState / soft 报告）
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
const appShellEntryPath = join(currentDir, "AppShell.tsx");
const appShellReexportPath = join(currentDir, "..", "..", "app-shell.tsx");
const compositionPath = join(currentDir, "useAppShellRootComposition.ts");
const assemblyPath = join(
  currentDir,
  "..",
  "domains",
  "useAppShellDomainAssembly.ts",
);

const COMPOSITION_SOFT_LINES = 600;
const COMPOSITION_HARD_LINES = 800;
/** RootComposition 仍为过渡巨石：冻结 hard，禁止继续涨 */
const ROOT_COMPOSITION_HARD_LINES = 2600;

function lineCount(path: string): number {
  return readFileSync(path, "utf8").split("\n").length;
}

function listUseStateCalls(source: string): string[] {
  const hits: string[] = [];
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (/\buseState\s*[<(]/.test(line)) {
      hits.push(`${index + 1}: ${line.trim()}`);
    }
  });
  return hits;
}

describe("appShellGovernanceGates (T5)", () => {
  it("T5.1: every domain has a hard budget and stays within freeze hard", () => {
    for (const domain of listAppShellDomainContextNames()) {
      expect(APP_SHELL_DOMAIN_KEY_HARD_BUDGETS[domain]).toBeTypeOf("number");
      const count = APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domain].length;
      expect(
        count,
        `${domain} keys ${count} exceeds hard ${APP_SHELL_DOMAIN_KEY_HARD_BUDGETS[domain]}`,
      ).toBeLessThanOrEqual(APP_SHELL_DOMAIN_KEY_HARD_BUDGETS[domain]);
    }
    expect(APP_SHELL_DOMAIN_KEY_TARGET_HARD).toBe(60);
    expect(APP_SHELL_DOMAIN_KEY_DEFAULT_SOFT).toBe(80);
  });

  it("T5.1: soft budget 80 records remaining debt domains without hard-fail", () => {
    const report = evaluateAppShellDomainOwnershipGate(
      readFileSync(assemblyPath, "utf8"),
    );
    const soft = listDomainOwnershipSoftFailures(report);
    // 当前遗留：composer / layout / settings 仍 > 80
    expect(soft.some((line) => line.includes("composerContext"))).toBe(true);
    expect(soft.some((line) => line.includes("settingsContext"))).toBe(true);
    expect(soft.some((line) => line.includes("layoutContext"))).toBe(true);
    expect(listDomainOwnershipHardFailures(report)).toEqual([]);
  });

  it("T5.2: AppShell composition entry within soft/hard line budgets", () => {
    const entryLines = lineCount(appShellEntryPath);
    const reexportLines = lineCount(appShellReexportPath);
    expect(entryLines).toBeLessThanOrEqual(COMPOSITION_SOFT_LINES);
    expect(entryLines).toBeLessThanOrEqual(COMPOSITION_HARD_LINES);
    expect(reexportLines).toBeLessThanOrEqual(20);
    // 过渡巨石冻结
    expect(lineCount(compositionPath)).toBeLessThanOrEqual(
      ROOT_COMPOSITION_HARD_LINES,
    );
  });

  it("T5.3: forbids business useState in AppShell entry files", () => {
    for (const path of [appShellEntryPath, appShellReexportPath]) {
      const hits = listUseStateCalls(readFileSync(path, "utf8"));
      expect(hits, `${path}\n${hits.join("\n")}`).toEqual([]);
    }
  });
});
