import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T2.6：AppShell 根 hook 种类预算（过渡门 ≤ 20）。
 * 业务 hooks 应在 useAppShellRootComposition / AppShellView 内。
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
const appShellPath = join(currentDir, "AppShell.tsx");

const REACT_HOOKS = new Set([
  "useState",
  "useEffect",
  "useMemo",
  "useCallback",
  "useRef",
  "useContext",
  "useLayoutEffect",
  "useId",
  "useTransition",
  "useDeferredValue",
  "useSyncExternalStore",
  "useReducer",
  "useImperativeHandle",
]);

function listHookKinds(source: string): string[] {
  const kinds = new Set<string>();
  for (const match of source.matchAll(/\b(use[A-Z][A-Za-z0-9]*)\s*\(/g)) {
    kinds.add(match[1]);
  }
  return [...kinds].sort();
}

describe("appShellRootHookBudget (T2.6)", () => {
  it("keeps AppShell.tsx composition hook kinds <= 20", () => {
    const source = readFileSync(appShellPath, "utf8");
    const kinds = listHookKinds(source);
    const custom = kinds.filter(
      (name) => !REACT_HOOKS.has(name) && name !== "useTranslation",
    );
    expect(
      custom,
      `custom root hooks (${custom.length}): ${custom.join(", ")}`,
    ).toEqual(["useAppShellRootComposition"]);
    expect(custom.length).toBeLessThanOrEqual(20);
    expect(kinds.length).toBeLessThanOrEqual(20);
  });
});
