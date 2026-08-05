import { getI18n } from "react-i18next";

import { isSharedSessionThreadId } from "../../shared-session/utils/sharedSessionIdentity";
import {
  sharedSessionV2AwaitTurnTerminal,
  sharedSessionV2CancelAttempt,
  sharedSessionV2DispatchTurn,
  sharedSessionV2InterruptTurn,
  sharedSessionV2PrepareDelivery,
  sharedSessionV2RecoverAttempt,
} from "../../shared-session/services/sharedSessions";
import {
  sharedSquadApprovePlan,
  sharedSquadCancel,
  sharedSquadClaimReadyNodes,
  sharedSquadFinalizeCancel,
  sharedSquadGet,
  sharedSquadRecordAttemptOutcome,
  sharedSquadRecordLeadPlan,
  sharedSquadRequestRun,
  sharedSquadRevisePlan,
} from "../../../services/tauri/squadOrchestration";
import { pushErrorToast } from "../../../services/toasts";
import {
  openSquadInspector,
  publishSquadProjection,
  registerSquadAttempt,
} from "../store/squadStore";
import type {
  SquadExecutionTarget,
  SquadPlanProposalV1,
  SquadPreparedAttemptV1,
  SquadProjectionV1,
} from "../types";
import { isTerminalSquadStatus } from "../types";

const ATTEMPT_TIMEOUT_MS = 30 * 60 * 1_000;
const runningExecutors = new Map<string, Promise<SquadProjectionV1>>();
const hydrationRequests = new Map<string, Promise<SquadProjectionV1 | null>>();

class SquadRecoveryAmbiguousError extends Error {}

function executionKey(
  workspaceId: string,
  threadId: string,
  runId: string,
): string {
  return `${workspaceId}\u0000${threadId}\u0000${runId}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withAttemptTimeout<T>(
  promise: Promise<T>,
  attemptId: string,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error(`squad-attempt-timeout: ${attemptId}`)),
          Math.max(1, timeoutMs),
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

async function drivePreparedAttempt(
  workspaceId: string,
  threadId: string,
  attempt: SquadPreparedAttemptV1,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
): Promise<void> {
  registerSquadAttempt(attempt.attemptId);
  const delivery = await sharedSessionV2PrepareDelivery(
    workspaceId,
    threadId,
    attempt.attemptId,
  );
  await sharedSessionV2DispatchTurn(workspaceId, threadId, {
    attemptId: attempt.attemptId,
    artifactId: delivery.artifactId,
    artifactChecksum: delivery.artifactChecksum,
    accessMode:
      attempt.permission === "current-workspace" ? "current" : "read-only",
    collaborationMode: null,
  });
  await withAttemptTimeout(
    sharedSessionV2AwaitTurnTerminal(workspaceId, threadId, attempt.attemptId),
    attempt.attemptId,
    timeoutMs,
  );
}

function remainingExecutionBudgetMs(projection: SquadProjectionV1): number {
  if (!projection.plan || !projection.approvedAt) return ATTEMPT_TIMEOUT_MS;
  const deadline =
    projection.approvedAt + projection.plan.budget.maxWallClockSeconds * 1_000;
  return Math.max(1, deadline - Date.now());
}

function isAttemptTimeout(error: unknown): boolean {
  return errorMessage(error).includes("squad-attempt-timeout:");
}

async function blockAmbiguousRecovery(
  workspaceId: string,
  threadId: string,
  runId: string,
  reason: string,
): Promise<SquadProjectionV1> {
  const cancelling = await sharedSquadCancel(
    workspaceId,
    threadId,
    runId,
    `automatic recovery blocked: ${reason}`,
  );
  publishSquadProjection(workspaceId, threadId, cancelling.projection);
  const blocked = await sharedSquadFinalizeCancel(
    workspaceId,
    threadId,
    runId,
    cancelling.attemptIds.map((attemptId) => ({
      attemptId,
      status: "error",
      error: reason,
    })),
  );
  publishSquadProjection(workspaceId, threadId, blocked);
  return blocked;
}

async function recoverAttemptTerminal(
  workspaceId: string,
  threadId: string,
  attemptId: string,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
): Promise<void> {
  registerSquadAttempt(attemptId);
  const recovery = await sharedSessionV2RecoverAttempt(
    workspaceId,
    threadId,
    attemptId,
  );
  if (recovery.status === "active") {
    await withAttemptTimeout(
      sharedSessionV2AwaitTurnTerminal(workspaceId, threadId, attemptId),
      attemptId,
      timeoutMs,
    );
    return;
  }
  if (
    recovery.status === "terminal-committed" ||
    recovery.status === "not-accepted-committed"
  ) {
    return;
  }
  throw new SquadRecoveryAmbiguousError(
    `squad-recovery-owner-ambiguous: attempt=${attemptId} phase=${recovery.pendingPhase ?? "unknown"}`,
  );
}

async function reconcileRunningAttempts(
  workspaceId: string,
  threadId: string,
  projection: SquadProjectionV1,
): Promise<SquadProjectionV1> {
  const owners = projection.activeAttemptIds.map((attemptId) => {
    const node = projection.nodes.find((candidate) =>
      candidate.attempts.some((attempt) => attempt.attemptId === attemptId),
    );
    if (!node) {
      throw new SquadRecoveryAmbiguousError(
        `squad-recovery-owner-missing: attempt=${attemptId}`,
      );
    }
    return { attemptId, nodeId: node.node.id };
  });
  try {
    const timeoutMs = remainingExecutionBudgetMs(projection);
    await Promise.all(
      owners.map(({ attemptId }) =>
        recoverAttemptTerminal(workspaceId, threadId, attemptId, timeoutMs),
      ),
    );
  } catch (error) {
    if (isAttemptTimeout(error)) {
      return stopSquad(workspaceId, threadId, projection.runId);
    }
    return blockAmbiguousRecovery(
      workspaceId,
      threadId,
      projection.runId,
      errorMessage(error),
    );
  }
  let latest = projection;
  for (const owner of owners) {
    latest = await sharedSquadRecordAttemptOutcome(
      workspaceId,
      threadId,
      projection.runId,
      owner.nodeId,
      owner.attemptId,
    );
    publishSquadProjection(workspaceId, threadId, latest);
  }
  return latest;
}

export async function requestSquadPlan(input: {
  workspaceId: string;
  threadId: string;
  text: string;
  target: SquadExecutionTarget;
}): Promise<SquadProjectionV1> {
  const requested = await sharedSquadRequestRun(
    input.workspaceId,
    input.threadId,
    input.text,
    input.target,
  );
  publishSquadProjection(
    input.workspaceId,
    input.threadId,
    requested.projection,
  );
  registerSquadAttempt(requested.leadAttempt.attemptId);
  try {
    await drivePreparedAttempt(
      input.workspaceId,
      input.threadId,
      requested.leadAttempt,
    );
    const proposed = await sharedSquadRecordLeadPlan(
      input.workspaceId,
      input.threadId,
      requested.projection.runId,
      requested.leadAttempt.attemptId,
    );
    publishSquadProjection(input.workspaceId, input.threadId, proposed);
    return proposed;
  } catch (error) {
    if (isAttemptTimeout(error)) {
      return stopSquad(
        input.workspaceId,
        input.threadId,
        requested.projection.runId,
      );
    }
    try {
      await recoverAttemptTerminal(
        input.workspaceId,
        input.threadId,
        requested.leadAttempt.attemptId,
      );
      const recovered = await sharedSquadRecordLeadPlan(
        input.workspaceId,
        input.threadId,
        requested.projection.runId,
        requested.leadAttempt.attemptId,
      );
      publishSquadProjection(input.workspaceId, input.threadId, recovered);
      return recovered;
    } catch (recoveryError) {
      return blockAmbiguousRecovery(
        input.workspaceId,
        input.threadId,
        requested.projection.runId,
        `${errorMessage(error)}; ${errorMessage(recoveryError)}`,
      );
    }
  }
}

async function executeApprovedRun(
  workspaceId: string,
  threadId: string,
  runId: string,
): Promise<SquadProjectionV1> {
  for (;;) {
    let current = await sharedSquadGet(workspaceId, threadId);
    publishSquadProjection(workspaceId, threadId, current);
    if (!current || current.runId !== runId) {
      throw new Error(`squad-run-not-found: ${runId}`);
    }
    if (isTerminalSquadStatus(current.status)) return current;
    if (current.status !== "running") return current;
    if (current.activeAttemptIds.length > 0) {
      current = await reconcileRunningAttempts(workspaceId, threadId, current);
      if (isTerminalSquadStatus(current.status)) return current;
      continue;
    }
    const claim = await sharedSquadClaimReadyNodes(
      workspaceId,
      threadId,
      runId,
    );
    publishSquadProjection(workspaceId, threadId, claim.projection);
    if (isTerminalSquadStatus(claim.projection.status)) return claim.projection;
    if (claim.projection.status !== "running") return claim.projection;
    if (claim.prepared.length === 0) {
      throw new Error("squad-scheduler-stalled: no ready or active node");
    }
    const timeoutMs = remainingExecutionBudgetMs(claim.projection);
    await Promise.all(
      claim.prepared.map(async (attempt) => {
        try {
          await drivePreparedAttempt(workspaceId, threadId, attempt, timeoutMs);
        } catch (dispatchError) {
          if (isAttemptTimeout(dispatchError)) {
            await stopSquad(workspaceId, threadId, runId);
            return;
          }
          try {
            await recoverAttemptTerminal(
              workspaceId,
              threadId,
              attempt.attemptId,
              timeoutMs,
            );
          } catch (recoveryError) {
            await blockAmbiguousRecovery(
              workspaceId,
              threadId,
              runId,
              `${errorMessage(dispatchError)}; ${errorMessage(recoveryError)}`,
            );
            return;
          }
        }
        const projection = await sharedSquadRecordAttemptOutcome(
          workspaceId,
          threadId,
          runId,
          attempt.nodeId,
          attempt.attemptId,
        );
        publishSquadProjection(workspaceId, threadId, projection);
      }),
    );
  }
}

function startSquadExecutor(
  workspaceId: string,
  threadId: string,
  runId: string,
): Promise<SquadProjectionV1> {
  const key = executionKey(workspaceId, threadId, runId);
  const existing = runningExecutors.get(key);
  if (existing) return existing;
  const execution = executeApprovedRun(workspaceId, threadId, runId)
    .catch(async (error) => {
      if (errorMessage(error).includes("squad-disabled:")) {
        return stopSquad(workspaceId, threadId, runId);
      }
      const latest = await sharedSquadGet(workspaceId, threadId).catch(
        () => null,
      );
      publishSquadProjection(workspaceId, threadId, latest);
      pushErrorToast({
        title: getI18n().t(
          "squadOrchestration.errors.executionInterrupted",
        ),
        message: errorMessage(error),
        durationMs: 5_000,
      });
      throw error;
    })
    .finally(() => runningExecutors.delete(key));
  runningExecutors.set(key, execution);
  return execution;
}

export async function approveAndExecuteSquad(
  workspaceId: string,
  threadId: string,
  runId: string,
  revision: number,
): Promise<SquadProjectionV1> {
  const approved = await sharedSquadApprovePlan(
    workspaceId,
    threadId,
    runId,
    revision,
  );
  publishSquadProjection(workspaceId, threadId, approved);
  openSquadInspector({ workspaceId, threadId, runId });
  // 自动执行与确认按钮生命周期解耦；executor 自己负责 durable state 与可见错误。
  void startSquadExecutor(workspaceId, threadId, runId).catch(() => undefined);
  return approved;
}

export async function reviseSquadPlan(
  workspaceId: string,
  threadId: string,
  runId: string,
  plan: SquadPlanProposalV1,
): Promise<SquadProjectionV1> {
  const projection = await sharedSquadRevisePlan(
    workspaceId,
    threadId,
    runId,
    plan,
  );
  publishSquadProjection(workspaceId, threadId, projection);
  return projection;
}

export async function stopSquad(
  workspaceId: string,
  threadId: string,
  runId: string,
): Promise<SquadProjectionV1> {
  const cancelling = await sharedSquadCancel(
    workspaceId,
    threadId,
    runId,
    "user emergency stop",
  );
  publishSquadProjection(workspaceId, threadId, cancelling.projection);
  const interruptResults = await Promise.all(
    cancelling.attemptIds.map(async (attemptId) => {
      try {
        const result = await sharedSessionV2InterruptTurn(
          workspaceId,
          threadId,
          attemptId,
        );
        return { attemptId, status: "interrupted", result };
      } catch (interruptError) {
        try {
          const result = await sharedSessionV2CancelAttempt(
            workspaceId,
            threadId,
            attemptId,
            "squad emergency stop before runtime acceptance",
          );
          return { attemptId, status: "cancelled-before-dispatch", result };
        } catch (cancelError) {
          return {
            attemptId,
            status: "error",
            error: `${errorMessage(interruptError)}; ${errorMessage(cancelError)}`,
          };
        }
      }
    }),
  );
  const settled = await sharedSquadFinalizeCancel(
    workspaceId,
    threadId,
    runId,
    interruptResults,
  );
  publishSquadProjection(workspaceId, threadId, settled);
  return settled;
}

export async function hydrateSquadProjection(
  workspaceId: string,
  threadId: string,
  expectedRunId: string,
): Promise<SquadProjectionV1 | null> {
  if (!isSharedSessionThreadId(threadId)) return null;
  const requestKey = executionKey(workspaceId, threadId, expectedRunId);
  const existingRequest = hydrationRequests.get(requestKey);
  if (existingRequest) return existingRequest;
  const request = hydrateEvidencedSquadProjection(
    workspaceId,
    threadId,
    expectedRunId,
  ).finally(() => {
    hydrationRequests.delete(requestKey);
  });
  hydrationRequests.set(requestKey, request);
  return request;
}

async function hydrateEvidencedSquadProjection(
  workspaceId: string,
  threadId: string,
  expectedRunId: string,
): Promise<SquadProjectionV1 | null> {
  const projection = await sharedSquadGet(workspaceId, threadId);
  if (projection && projection.runId !== expectedRunId) {
    throw new Error(
      `squad-hydration-evidence-mismatch: expected=${expectedRunId} actual=${projection.runId}`,
    );
  }
  publishSquadProjection(workspaceId, threadId, projection);
  if (projection?.status === "running") {
    void startSquadExecutor(workspaceId, threadId, projection.runId).catch(
      () => undefined,
    );
  } else if (projection?.status === "planning") {
    const leadAttemptId = projection.activeAttemptIds[0];
    if (leadAttemptId) {
      void recoverAttemptTerminal(workspaceId, threadId, leadAttemptId)
        .then(() =>
          sharedSquadRecordLeadPlan(
            workspaceId,
            threadId,
            projection.runId,
            leadAttemptId,
          ),
        )
        .then((recovered) =>
          publishSquadProjection(workspaceId, threadId, recovered),
        )
        .catch(async (error) => {
          await blockAmbiguousRecovery(
            workspaceId,
            threadId,
            projection.runId,
            errorMessage(error),
          ).catch(() => undefined);
        });
    } else {
      void blockAmbiguousRecovery(
        workspaceId,
        threadId,
        projection.runId,
        "squad-recovery-owner-missing: Lead attempt is not recoverable",
      ).catch(() => undefined);
    }
  } else if (projection?.status === "cancelling") {
    void stopSquad(workspaceId, threadId, projection.runId).catch(
      () => undefined,
    );
  }
  return projection;
}
