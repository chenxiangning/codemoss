import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appShellPath = join(currentDir, "..", "..", "app-shell.tsx");
/** T3.2：真实 composition 入口 */
const appShellEntryPath = join(currentDir, "../assembly/AppShell.tsx");
/** T2.6：业务 hooks 下沉到 composition host */
const compositionPath = join(
  currentDir,
  "../assembly/useAppShellRootComposition.ts",
);

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("AppShell S4 host boundaries", () => {
  it("routes workspace list/home through useWorkspaceSessionHost", () => {
    const source = readSource(compositionPath);

    expect(source).toContain(
      'from "../domains/useWorkspaceSessionHost"',
    );
    expect(source).toContain("useWorkspaceSessionHost({");
    // 不得绕过 host 直接挂 workspace controller / home state
    expect(source).not.toContain(
      'from "../../features/app/hooks/useWorkspaceController"',
    );
    expect(source).not.toContain(
      'from "./useAppShellWorkspaceHomeState"',
    );
  });

  it("routes active session flags through useActiveSessionProjection", () => {
    const source = readSource(compositionPath);

    expect(source).toContain(
      'from "../domains/activeSessionProjection"',
    );
    expect(source).toContain("useActiveSessionProjection({");
    // 根上不再手写 active thread find + processing 三元组
    expect(source).not.toMatch(
      /threadsByWorkspace\[activeWorkspaceId\]\?\.find\(/,
    );
    expect(source).not.toMatch(
      /threadStatusById\[activeThreadId\]\?\.isProcessing/,
    );
  });

  it("routes composer / conversation / kanban through domain hosts", () => {
    const source = readSource(compositionPath);

    expect(source).toContain('from "../domains/useComposerDomainHost"');
    expect(source).toContain("useComposerDomainHost({");
    expect(source).toContain(
      'from "../domains/useConversationDomainHost"',
    );
    expect(source).toContain("useConversationDomainHost({");
    expect(source).toContain('from "../domains/useModeDomainHosts"');
    expect(source).toContain("useKanbanDomainHost({");

    // 不得再直接挂这些已下沉 hooks
    expect(source).not.toContain(
      'from "../domains/useSelectedComposerSession"',
    );
    expect(source).not.toContain(
      'from "../domains/useAppShellComposerModelSection"',
    );
    expect(source).not.toContain(
      'from "../domains/useSelectedAgentSession"',
    );
    expect(source).not.toContain(
      'from "../../features/kanban/hooks/useKanbanStore"',
    );
    expect(source).not.toContain('from "@mossx/plugin-kanban"');
    expect(source).not.toContain(
      'from "../../features/threads/hooks/useCopyThread"',
    );
  });

  it("assembles domain contexts via useAppShellDomainAssembly (T1.1)", () => {
    const source = readSource(compositionPath);

    expect(source).toContain(
      'from "../domains/useAppShellDomainAssembly"',
    );
    expect(source).toContain("useAppShellDomainAssembly({");
    // bag 组装不得再内联回 composition
    expect(source).not.toContain("defineAppShellDomainContexts(");
    expect(source).not.toContain("reuseStableAppShellDomainContexts(");
    expect(source).not.toContain(
      'from "../domains/buildAppShellDomainContextSlices"',
    );
  });

  it("keeps AppShell root as pure composition (T2.6/T3.2)", () => {
    const reexport = readSource(appShellPath);
    expect(reexport).toContain('from "./app-shell/assembly/AppShell"');
    const source = readSource(appShellEntryPath);
    expect(source).toContain("useAppShellRootComposition");
    expect(source).toContain("AppShellZoneProviders");
    expect(source).toContain("AppShellView");
    // composition 入口不得直接挂业务 section / threads hooks
    expect(source).not.toContain("useThreads(");
    expect(source).not.toContain("useComposerController(");
    expect(source).not.toContain("useGitPanelController(");
  });

  it("builds clean domain contexts via slice builders in assembly module", () => {
    const assembly = readSource(
      join(currentDir, "../domains/useAppShellDomainAssembly.ts"),
    );

    expect(assembly).toContain("buildRuntimeThreadDomainContextSlice");
    expect(assembly).toContain("buildSessionIdentityDomainContextSlice");
    expect(assembly).toContain("buildWorkspaceCatalogDomainContextSlice");
    expect(assembly).toContain("buildGitSurfaceDomainContextSlice");
    expect(assembly).toContain("buildModeRoutingDomainContextSlice");
    expect(assembly).toContain("buildAccountSurfaceDomainContextSlice");
    expect(assembly).toContain("buildDictationSurfaceDomainContextSlice");
    expect(assembly).toContain("buildWorkspaceNavigationDomainContextSlice");
    expect(assembly).toContain("buildModelSelectionDomainContextSlice");
    expect(assembly).toContain("buildCollaborationModeDomainContextSlice");
    expect(assembly).toContain("buildRuntimeDomainContextSlice");
    expect(assembly).toContain("defineAppShellDomainContexts(");
    expect(assembly).toContain("reuseStableAppShellDomainContexts(");
    // residual navigation 也不得再 object-literal 内联
    expect(assembly).not.toMatch(/workspaceNavigationContext:\s*\{/);
  });

  it("keeps domain bag out of AppShell root (T1.9)", () => {
    const source = readSource(appShellEntryPath);
    expect(source).not.toContain("defineAppShellDomainContexts(");
    expect(source).not.toContain("reuseStableAppShellDomainContexts(");
    expect(source).not.toContain("buildAppShellDomainContextSlices");
    const composition = readSource(compositionPath);
    expect(composition).toContain("useAppShellDomainAssembly({");
  });

  it("wraps shell view with zone providers (T2.1–T2.3)", () => {
    const source = readSource(appShellEntryPath);
    expect(source).toContain("AppShellZoneProviders");
    expect(source).toContain("AppShellView");
    const view = readSource(join(currentDir, "../assembly/appShellView.tsx"));
    expect(view).toContain("useAppShellSearchAndComposerSection(");
    expect(view).toContain("useAppShellSections(");
    expect(view).toContain("useAppShellLayoutNodesSection(");
    const composition = readSource(compositionPath);
    expect(composition).toContain("useMemoizedRuntimeThreadProviderValue");
    expect(composition).toContain("useMemoizedComposerProviderValue");
    expect(composition).toContain("useMemoizedLayoutChromeProviderValue");
  });
});

