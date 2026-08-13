import { describe, expect, it } from "vitest";
import {
  APP_SHELL_DOMAIN_CONTEXT_NAMES,
  APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS,
} from "./appShellDomainContexts";
import { assembleAppShellDomainContexts } from "./useAppShellDomainAssembly";

function buildMinimalAssemblySource(): Record<string, unknown> {
  const source: Record<string, unknown> = {
    runtimeActions: { handleToggleRuntimeConsole: () => {} },
    runtimeThreadBoundary: { kind: "runtime-thread-boundary" },
    runtimeRunState: { phase: "idle" },
    effectiveReasoningOptions: [],
    effectiveSelectedEffort: null,
    handleSelectComposerEffort: () => {},
  };

  for (const domainName of APP_SHELL_DOMAIN_CONTEXT_NAMES) {
    for (const key of APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domainName]) {
      if (source[key] === undefined) {
        source[key] = `owned:${domainName}:${key}`;
      }
    }
  }

  // modelSelection rename sources
  source.effectiveModels = ["m1"];
  source.effectiveReasoningSupported = true;
  source.effectiveSelectedModel = "m1";
  source.effectiveSelectedModelId = "m1";
  source.providerModelCatalogs = {};
  source.refreshEngineModels = () => {};
  source.resolvedEffort = null;
  source.resolvedModel = "m1";
  source.setSelectedModelId = () => {};

  // collaboration minimal
  source.applySelectedCollaborationMode = () => {};
  source.collaborationModePayload = null;
  source.collaborationModes = [];
  source.collaborationModesEnabled = false;
  source.collaborationRuntimeModeByThread = {};
  source.collaborationUiModeByThread = {};
  source.handleCollaborationModeResolved = () => {};
  source.resolveCollaborationRuntimeMode = () => null;
  source.resolveCollaborationUiMode = () => null;
  source.selectedCollaborationMode = null;
  source.selectedCollaborationModeId = null;
  source.setCodexCollaborationMode = () => {};
  source.setCollaborationRuntimeModeByThread = () => {};
  source.setCollaborationUiModeByThread = () => {};
  source.setSelectedCollaborationModeId = () => {};

  return source;
}

describe("assembleAppShellDomainContexts", () => {
  it("defines all domains and keeps runtimeThread hot fields out of navigation", () => {
    const contexts = assembleAppShellDomainContexts(buildMinimalAssemblySource());

    expect(Object.keys(contexts).sort()).toEqual(
      [...APP_SHELL_DOMAIN_CONTEXT_NAMES].sort(),
    );
    expect(contexts.runtimeThreadContext.isProcessing).toBe(
      "owned:runtimeThreadContext:isProcessing",
    );
    expect(contexts.runtimeThreadContext.activeItems).toBe(
      "owned:runtimeThreadContext:activeItems",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "isProcessing",
    );
    expect(contexts.sessionIdentityContext.activeWorkspaceId).toBe(
      "owned:sessionIdentityContext:activeWorkspaceId",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "activeWorkspaceId",
    );
    expect(contexts.workspaceCatalogContext.addWorkspace).toBe(
      "owned:workspaceCatalogContext:addWorkspace",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "addWorkspace",
    );
    expect(contexts.gitSurfaceContext.gitStatus).toBe(
      "owned:gitSurfaceContext:gitStatus",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "gitStatus",
    );
    expect(contexts.modeRoutingContext.appMode).toBe(
      "owned:modeRoutingContext:appMode",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "appMode",
    );
    expect(contexts.accountSurfaceContext.activeAccount).toBe(
      "owned:accountSurfaceContext:activeAccount",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "activeAccount",
    );
    expect(contexts.dictationSurfaceContext.dictationState).toBe(
      "owned:dictationSurfaceContext:dictationState",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "dictationState",
    );
    expect(
      Object.keys(contexts.workspaceNavigationContext).length,
    ).toBeLessThanOrEqual(80);
    expect(contexts.runtimeContext.runtimeRunState).toEqual({ phase: "idle" });
    expect(contexts.modelSelectionContext.selectedModelId).toBe("m1");
    expect(contexts.modelSelectionContext.reasoningOptions).toEqual([]);
  });
});
