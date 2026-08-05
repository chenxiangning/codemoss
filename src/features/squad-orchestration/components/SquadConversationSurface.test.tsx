// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimHydration: vi.fn(),
  evidenceRunId: null as string | null,
  featureEnabled: true,
  hydrate: vi.fn(),
  pushErrorToast: vi.fn(),
  projection: null,
}));

vi.mock("../runtime/squadExecutor", () => ({
  approveAndExecuteSquad: vi.fn(),
  hydrateSquadProjection: mocks.hydrate,
  stopSquad: vi.fn(),
}));

vi.mock("../store/squadStore", () => ({
  claimSquadHydration: mocks.claimHydration,
  openSquadInspector: vi.fn(),
  useSquadEvidenceRunId: vi.fn(() => mocks.evidenceRunId),
  useSquadProjection: vi.fn(() => mocks.projection),
}));

vi.mock("../runtime/squadFeatureFlag", () => ({
  isSquadOrchestrationEnabled: vi.fn(() => mocks.featureEnabled),
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: mocks.pushErrorToast,
}));

import { SquadConversationSurface } from "./SquadConversationSurface";

describe("SquadConversationSurface passive hydration boundary", () => {
  beforeEach(() => {
    mocks.claimHydration.mockReset();
    mocks.claimHydration.mockReturnValue(true);
    mocks.evidenceRunId = null;
    mocks.featureEnabled = true;
    mocks.hydrate.mockReset();
    mocks.hydrate.mockResolvedValue(null);
    mocks.pushErrorToast.mockReset();
    mocks.projection = null;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("never probes Squad state for a Native Session", async () => {
    render(
      <SquadConversationSurface
        workspaceId="workspace-a"
        threadId="019fcd73-9e43-7253-8e7e-b58b634548df"
      />,
    );

    await Promise.resolve();
    expect(mocks.hydrate).not.toHaveBeenCalled();
    expect(mocks.pushErrorToast).not.toHaveBeenCalled();
  });

  it("does not probe 100 ordinary Shared Sessions without canonical evidence", async () => {
    const view = render(
      <SquadConversationSurface
        workspaceId="workspace-a"
        threadId="shared:ordinary-0"
      />,
    );

    for (let index = 1; index < 100; index += 1) {
      view.rerender(
        <SquadConversationSurface
          workspaceId="workspace-a"
          threadId={`shared:ordinary-${index}`}
        />,
      );
    }

    await Promise.resolve();
    expect(mocks.claimHydration).not.toHaveBeenCalled();
    expect(mocks.hydrate).not.toHaveBeenCalled();
    expect(mocks.pushErrorToast).not.toHaveBeenCalled();
  });

  it("hydrates only an evidenced Shared Squad Session", async () => {
    mocks.evidenceRunId = "run-a";
    render(
      <SquadConversationSurface
        workspaceId="workspace-a"
        threadId="shared:session-a"
      />,
    );

    await waitFor(() =>
      expect(mocks.hydrate).toHaveBeenCalledWith(
        "workspace-a",
        "shared:session-a",
        "run-a",
      ),
    );
    expect(mocks.claimHydration).toHaveBeenCalledWith(
      "workspace-a",
      "shared:session-a",
      "run-a",
    );
  });

  it("does not hydrate evidenced history when the feature is disabled", async () => {
    mocks.evidenceRunId = "run-disabled";
    mocks.featureEnabled = false;

    render(
      <SquadConversationSurface
        workspaceId="workspace-a"
        threadId="shared:disabled"
      />,
    );

    await Promise.resolve();
    expect(mocks.claimHydration).not.toHaveBeenCalled();
    expect(mocks.hydrate).not.toHaveBeenCalled();
  });

  it("keeps a passive evidenced-Squad failure out of global Toasts", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.evidenceRunId = "run-foreign";
    mocks.hydrate.mockRejectedValueOnce(
      new Error("shared-session-owner-unavailable"),
    );

    render(
      <SquadConversationSurface
        workspaceId="workspace-a"
        threadId="shared:foreign-session"
      />,
    );

    await waitFor(() => expect(mocks.hydrate).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(mocks.pushErrorToast).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("ignores a stale hydration rejection after the scope changes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.evidenceRunId = "run-known";
    let rejectOld: (reason: Error) => void = () => undefined;
    const oldHydration = new Promise<null>((_resolve, reject) => {
      rejectOld = reject;
    });
    mocks.hydrate.mockReturnValueOnce(oldHydration).mockResolvedValueOnce(null);

    const view = render(
      <SquadConversationSurface
        workspaceId="workspace-old"
        threadId="shared:old"
      />,
    );
    view.rerender(
      <SquadConversationSurface
        workspaceId="workspace-new"
        threadId="shared:new"
      />,
    );

    await waitFor(() => expect(mocks.hydrate).toHaveBeenCalledTimes(2));
    rejectOld(new Error("old owner unavailable"));
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.pushErrorToast).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[squad-hydration] failed for workspace-old/shared:old/run-known",
      expect.any(Error),
    );
  });
});
