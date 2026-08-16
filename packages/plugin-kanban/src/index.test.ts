import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("@mossx/plugin-kanban export surface", () => {
  it("re-exports product Kanban without moving source out of src/features/kanban", () => {
    const index = readFileSync(join(currentDir, "index.ts"), "utf8");
    expect(index).toContain('from "../../../src/features/kanban/hooks/useKanbanStore"');
    expect(index).toContain('from "../../../src/features/kanban/components/KanbanView"');
    const host = readFileSync(join(repoRoot, "src/app-shell/domains/useModeDomainHosts.ts"), "utf8");
    expect(host).toContain('from "@mossx/plugin-kanban"');
    expect(host).not.toContain("features/kanban/hooks/useKanbanStore");
    const execution = readFileSync(
      join(repoRoot, "src/app-shell/sections/useAppShellKanbanExecutionSection.ts"),
      "utf8",
    );
    expect(execution).toContain('from "@mossx/plugin-kanban"');
    expect(execution).not.toContain("features/kanban/");
    expect(readFileSync(join(repoRoot, "src/features/kanban/hooks/useKanbanStore.ts"), "utf8")).toContain(
      "export function useKanbanStore",
    );
  });
});
