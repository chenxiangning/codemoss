// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SquadProjectionV1 } from "../types";

const sharedMocks = vi.hoisted(() => ({
  awaitTerminal: vi.fn(),
  cancelAttempt: vi.fn(),
  dispatchTurn: vi.fn(),
  interruptTurn: vi.fn(),
  prepareDelivery: vi.fn(),
  recoverAttempt: vi.fn(),
}));

const squadMocks = vi.hoisted(() => ({
  approvePlan: vi.fn(),
  cancel: vi.fn(),
  claimReady: vi.fn(),
  finalizeCancel: vi.fn(),
  get: vi.fn(),
  recordOutcome: vi.fn(),
  recordLeadPlan: vi.fn(),
  requestRun: vi.fn(),
  revisePlan: vi.fn(),
}));

vi.mock("../../shared-session/services/sharedSessions", () => ({
  sharedSessionV2AwaitTurnTerminal: sharedMocks.awaitTerminal,
  sharedSessionV2CancelAttempt: sharedMocks.cancelAttempt,
  sharedSessionV2DispatchTurn: sharedMocks.dispatchTurn,
  sharedSessionV2InterruptTurn: sharedMocks.interruptTurn,
  sharedSessionV2PrepareDelivery: sharedMocks.prepareDelivery,
  sharedSessionV2RecoverAttempt: sharedMocks.recoverAttempt,
}));

vi.mock("../../../services/tauri/squadOrchestration", () => ({
  sharedSquadApprovePlan: squadMocks.approvePlan,
  sharedSquadCancel: squadMocks.cancel,
  sharedSquadClaimReadyNodes: squadMocks.claimReady,
  sharedSquadFinalizeCancel: squadMocks.finalizeCancel,
  sharedSquadGet: squadMocks.get,
  sharedSquadRecordAttemptOutcome: squadMocks.recordOutcome,
  sharedSquadRecordLeadPlan: squadMocks.recordLeadPlan,
  sharedSquadRequestRun: squadMocks.requestRun,
  sharedSquadRevisePlan: squadMocks.revisePlan,
}));

vi.mock("../../../services/toasts", () => ({ pushErrorToast: vi.fn() }));

import {
  approveAndExecuteSquad,
  hydrateSquadProjection,
  requestSquadPlan,
} from "./squadExecutor";

function runningProjection(runId: string): SquadProjectionV1 {
  const target = {
    engine: "codex" as const,
    providerProfileId: null,
    modelCatalogEntryId: "gpt-5",
    model: "gpt-5",
    providerProfileNameSnapshot: "Local",
    providerProfileSource: "local" as const,
  };
  return {
    schemaVersion: 1,
    runId,
    workspaceId: "workspace-id",
    workspaceRoot: "/workspace",
    sessionId: `shared:${runId}`,
    requestText: "task",
    leadTarget: target,
    status: "running",
    planRevision: 1,
    plan: {
      schemaVersion: 1,
      summary: "analyze",
      budget: {
        maxParallelReadOnly: 2,
        maxNodeAttempts: 2,
        maxRepairAttempts: 1,
        maxWallClockSeconds: 1800,
      },
      nodes: [
        {
          id: "analyze",
          title: "Analyze",
          kind: "analyze",
          goal: "Analyze",
          dependsOn: [],
          target,
          permission: "read-only",
          maxAttempts: 2,
          successCriteria: ["done"],
        },
      ],
      finalNodeId: "analyze",
    },
    nodes: [
      {
        node: {
          id: "analyze",
          title: "Analyze",
          kind: "analyze",
          goal: "Analyze",
          dependsOn: [],
          target,
          permission: "read-only",
          maxAttempts: 2,
          successCriteria: ["done"],
        },
        status: "running",
        attempts: [
          {
            attemptId: "attempt-1",
            bindingKey: `squad:${runId}:analyze:codex:default`,
            status: "running",
            startedAt: 2,
          },
        ],
        outcome: null,
        diagnostics: [],
      },
    ],
    activeAttemptIds: ["attempt-1"],
    diagnostics: [],
    requestedAt: 1,
    approvedAt: Date.now(),
    updatedAt: 2,
  };
}

describe("Squad executor recovery", () => {
  beforeEach(() => {
    Object.values(sharedMocks).forEach((mock) => mock.mockReset());
    Object.values(squadMocks).forEach((mock) => mock.mockReset());
  });

  it("treats Native Session hydration as a strict no-op", async () => {
    await expect(
      hydrateSquadProjection("workspace-id", "native-session-id", "run-native"),
    ).resolves.toBeNull();

    expect(squadMocks.get).not.toHaveBeenCalled();
    expect(sharedMocks.recoverAttempt).not.toHaveBeenCalled();
  });

  it("records an already committed exact owner without replaying its prompt", async () => {
    const running = runningProjection("run-terminal");
    const succeeded = {
      ...running,
      status: "succeeded" as const,
      activeAttemptIds: [],
    };
    squadMocks.get.mockResolvedValue(running);
    sharedMocks.recoverAttempt.mockResolvedValue({
      status: "terminal-committed",
      attemptId: "attempt-1",
    });
    squadMocks.recordOutcome.mockResolvedValue(succeeded);

    await hydrateSquadProjection(
      "/workspace",
      "shared:run-terminal",
      "run-terminal",
    );
    await vi.waitFor(() =>
      expect(squadMocks.recordOutcome).toHaveBeenCalledTimes(1),
    );

    expect(sharedMocks.recoverAttempt).toHaveBeenCalledWith(
      "/workspace",
      "shared:run-terminal",
      "attempt-1",
    );
    expect(sharedMocks.dispatchTurn).not.toHaveBeenCalled();
  });

  it("recovers Lead after a transport error instead of leaving planning stranded", async () => {
    const running = runningProjection("run-lead");
    const planning = {
      ...running,
      status: "planning" as const,
      planRevision: 0,
      plan: null,
      nodes: [],
      activeAttemptIds: ["lead-attempt"],
    };
    const proposed = {
      ...running,
      status: "awaiting-approval" as const,
      activeAttemptIds: [],
    };
    squadMocks.requestRun.mockResolvedValue({
      projection: planning,
      leadAttempt: {
        runId: "run-lead",
        nodeId: "lead",
        nodeKind: "analyze",
        attemptId: "lead-attempt",
        logicalTurnId: "lead-turn",
        bindingKey: "squad:run-lead:lead:codex:default",
        target: running.leadTarget,
        permission: "read-only",
      },
    });
    sharedMocks.prepareDelivery.mockRejectedValue(new Error("transport closed"));
    sharedMocks.recoverAttempt.mockResolvedValue({
      status: "terminal-committed",
      attemptId: "lead-attempt",
    });
    squadMocks.recordLeadPlan.mockResolvedValue(proposed);

    await expect(
      requestSquadPlan({
        workspaceId: "workspace-id",
        threadId: "shared:run-lead",
        text: "task",
        target: running.leadTarget,
      }),
    ).resolves.toBe(proposed);

    expect(squadMocks.recordLeadPlan).toHaveBeenCalledWith(
      "workspace-id",
      "shared:run-lead",
      "run-lead",
      "lead-attempt",
    );
    expect(squadMocks.cancel).not.toHaveBeenCalled();
  });

  it("blocks an unknown owner instead of blind replay", async () => {
    const running = runningProjection("run-unknown");
    const cancelling = { ...running, status: "cancelling" as const };
    const blocked = {
      ...running,
      status: "blocked" as const,
      activeAttemptIds: [],
    };
    squadMocks.get.mockResolvedValue(running);
    sharedMocks.recoverAttempt.mockResolvedValue({
      status: "unknown",
      attemptId: "attempt-1",
      pendingPhase: "accepted",
    });
    squadMocks.cancel.mockResolvedValue({
      projection: cancelling,
      attemptIds: ["attempt-1"],
    });
    squadMocks.finalizeCancel.mockResolvedValue(blocked);

    await hydrateSquadProjection(
      "/workspace",
      "shared:run-unknown",
      "run-unknown",
    );
    await vi.waitFor(() =>
      expect(squadMocks.finalizeCancel).toHaveBeenCalledTimes(1),
    );

    expect(squadMocks.claimReady).not.toHaveBeenCalled();
    expect(sharedMocks.dispatchTurn).not.toHaveBeenCalled();
    expect(squadMocks.finalizeCancel).toHaveBeenCalledWith(
      "/workspace",
      "shared:run-unknown",
      "run-unknown",
      [
        expect.objectContaining({
          attemptId: "attempt-1",
          status: "error",
        }),
      ],
    );
  });

  it("coalesces concurrent hydration for the same evidenced Squad scope", async () => {
    let resolveGet: (value: SquadProjectionV1 | null) => void = () => undefined;
    squadMocks.get.mockReturnValue(
      new Promise<SquadProjectionV1 | null>((resolve) => {
        resolveGet = resolve;
      }),
    );

    const first = hydrateSquadProjection(
      "/workspace",
      "shared:single-flight",
      "run-single-flight",
    );
    const second = hydrateSquadProjection(
      "/workspace",
      "shared:single-flight",
      "run-single-flight",
    );

    expect(squadMocks.get).toHaveBeenCalledTimes(1);
    resolveGet(null);
    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);
  });

  it("rejects a projection that conflicts with the canonical evidence run", async () => {
    squadMocks.get.mockResolvedValue(runningProjection("run-unexpected"));

    await expect(
      hydrateSquadProjection(
        "/workspace",
        "shared:evidence-mismatch",
        "run-expected",
      ),
    ).rejects.toThrow(
      "squad-hydration-evidence-mismatch: expected=run-expected actual=run-unexpected",
    );

    expect(sharedMocks.recoverAttempt).not.toHaveBeenCalled();
    expect(squadMocks.claimReady).not.toHaveBeenCalled();
  });

  it("returns after approval while automatic execution continues in the background", async () => {
    const running = runningProjection("run-approved");
    let releaseExecution: (projection: SquadProjectionV1) => void = () => undefined;
    squadMocks.approvePlan.mockResolvedValue(running);
    squadMocks.get.mockReturnValue(
      new Promise<SquadProjectionV1>((resolve) => {
        releaseExecution = resolve;
      }),
    );

    const result = await Promise.race([
      approveAndExecuteSquad(
        "workspace-id",
        "shared:run-approved",
        "run-approved",
        1,
      ),
      new Promise<"timed-out">((resolve) =>
        window.setTimeout(() => resolve("timed-out"), 25),
      ),
    ]);

    expect(result).toBe(running);
    expect(squadMocks.approvePlan).toHaveBeenCalledTimes(1);
    expect(squadMocks.get).toHaveBeenCalledTimes(1);
    releaseExecution({
      ...running,
      status: "succeeded",
      activeAttemptIds: [],
    });
  });

  it("settles an approved run when the kill switch blocks new dispatch", async () => {
    const running = {
      ...runningProjection("run-disabled"),
      nodes: [],
      activeAttemptIds: [],
    };
    const cancelling = { ...running, status: "cancelling" as const };
    const cancelled = { ...running, status: "cancelled" as const };
    squadMocks.approvePlan.mockResolvedValue(running);
    squadMocks.get.mockResolvedValue(running);
    squadMocks.claimReady.mockRejectedValue(
      new Error("squad-disabled: squadOrchestrationV1 is disabled"),
    );
    squadMocks.cancel.mockResolvedValue({
      projection: cancelling,
      attemptIds: [],
    });
    squadMocks.finalizeCancel.mockResolvedValue(cancelled);

    await expect(
      approveAndExecuteSquad(
        "workspace-id",
        "shared:run-disabled",
        "run-disabled",
        1,
      ),
    ).resolves.toBe(running);
    await vi.waitFor(() =>
      expect(squadMocks.finalizeCancel).toHaveBeenCalledTimes(1),
    );

    expect(squadMocks.cancel).toHaveBeenCalledWith(
      "workspace-id",
      "shared:run-disabled",
      "run-disabled",
      "user emergency stop",
    );
    expect(sharedMocks.dispatchTurn).not.toHaveBeenCalled();
  });
});
