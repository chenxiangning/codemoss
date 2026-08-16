import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const shellRoot = join(currentDir, "..");
const HARD = 800;
// Known transitional giants still being split (documented)
const ALLOWLIST = new Set([
  "sections/layoutNodes/useAppShellLayoutNodesSection.tsx",
  "sections/core/useAppShellSections.ts",
  "sections/useAppShellKanbanExecutionSection.ts",
  "sections/useAppShellSearchRadarSection.ts",
  // P2-1: hydration host grew with multi-engine list recovery; still transitional.
  "sections/useWorkspaceThreadListHydration.ts",
  // 804 lines: workspace flows (terminal/clone/archive/navigation) not yet split; transitional.
  "sections/useAppShellWorkspaceFlowsSection.ts",
  "assembly/useAppShellRootComposition.ts",
  "domains/useAppShellDomainAssembly.ts",
  "domains/buildAppShellDomainContextSlices.ts",
  "domains/appShellDomainContexts.ts",
  "render/renderAppShell.tsx",
  "sections/useAppShellSearchAndComposerSection.ts",
]);

function walk(dir: string, out: string[] = [], prefix = ""): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(p).isDirectory()) {
      walk(p, out, rel);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || name.includes(".test.")) continue;
    out.push(rel);
  }
  return out;
}

describe("appShellFileSizeGate (T3.8)", () => {
  it("keeps new modules under hard 800 lines (allowlist transitional giants)", () => {
    const files = walk(shellRoot);
    const offenders: string[] = [];
    for (const rel of files) {
      if (ALLOWLIST.has(rel)) continue;
      const lines = readFileSync(join(shellRoot, rel), "utf8").split("\n").length;
      if (lines > HARD) {
        offenders.push(`${rel}: ${lines}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("keeps AppShell composition entry under 400 lines", () => {
    const entry = readFileSync(join(currentDir, "AppShell.tsx"), "utf8");
    expect(entry.split("\n").length).toBeLessThanOrEqual(400);
  });
});
