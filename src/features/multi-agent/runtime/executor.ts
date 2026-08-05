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
  sharedAgentApprove,
  sharedAgentCancel,
  sharedAgentFinalizeCancel,
  sharedAgentGet,
  sharedAgentRecordExecute,
  sharedAgentRecordPlan,
  sharedAgentRecordReview,
  sharedAgentRequestRun,
} from "../../../services/tauri/agentOrchestration";
import { pushErrorToast } from "../../../services/toasts";
import {
  publishAgentProjection,
  registerAgentAttempt,
} from "../store/agentStore";
import {
  beginAgentLivePhase,
  clearAgentLivePhase,
  setAgentLivePhaseText,
} from "./livePhaseChannel";
import { openAgentInspector } from "../store/inspectorStore";
import type {
  AgentExecutionTarget,
  AgentPreparedAttempt,
  AgentProjectionV1,
  AgentStageBinding,
} from "../types";
import { isTerminalAgentStatus } from "../types";

const ATTEMPT_TIMEOUT_MS = 30 * 60 * 1_000;
const running = new Map<string, Promise<AgentProjectionV1>>();

function key(workspaceId: string, threadId: string, runId: string): string {
  return `${workspaceId}\u0000${threadId}\u0000${runId}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asPrepared(
  value: AgentPreparedAttempt | null | undefined,
): AgentPreparedAttempt | null {
  if (!value) return null;
  return {
    ...value,
    stageId: value.stageId || value.phase || "plan",
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  attemptId: string,
): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error(`agent-attempt-timeout: ${attemptId}`)),
          ATTEMPT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

async function driveAttempt(
  workspaceId: string,
  threadId: string,
  attempt: AgentPreparedAttempt,
): Promise<void> {
  const stageId = attempt.stageId || "plan";
  registerAgentAttempt(attempt.attemptId, {
    workspaceId,
    threadId,
    phase: stageId,
    bindingKey: attempt.bindingKey,
  });
  beginAgentLivePhase(workspaceId, threadId, attempt.attemptId, stageId);
  openAgentInspector({
    workspaceId,
    threadId,
    runId: attempt.runId,
    stageId,
  });
  const delivery = await sharedSessionV2PrepareDelivery(
    workspaceId,
    threadId,
    attempt.attemptId,
  );
  await sharedSessionV2DispatchTurn(workspaceId, threadId, {
    attemptId: attempt.attemptId,
    artifactId: delivery.artifactId,
    artifactChecksum: delivery.artifactChecksum,
    accessMode: attempt.accessMode === "current" ? "current" : "read-only",
    collaborationMode: null,
  });
  await withTimeout(
    sharedSessionV2AwaitTurnTerminal(
      workspaceId,
      threadId,
      attempt.attemptId,
    ),
    attempt.attemptId,
  );
}

export async function requestAgentPlan(input: {
  workspaceId: string;
  threadId: string;
  text: string;
  target: AgentExecutionTarget;
  stageBindings?: AgentStageBinding[];
}): Promise<AgentProjectionV1> {
  const requested = await sharedAgentRequestRun(
    input.workspaceId,
    input.threadId,
    input.text,
    input.target,
    input.stageBindings,
  );
  publishAgentProjection(
    input.workspaceId,
    input.threadId,
    requested.projection,
  );
  openAgentInspector({
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    runId: requested.projection.runId,
    stageId: "plan",
  });
  const planAttempt = asPrepared(
    requested.stageAttempt ?? requested.planAttempt,
  );
  if (!planAttempt) {
    throw new Error("agent-plan-attempt-missing");
  }
  try {
    await driveAttempt(input.workspaceId, input.threadId, planAttempt);
    const planned = await sharedAgentRecordPlan(
      input.workspaceId,
      input.threadId,
      requested.projection.runId,
      planAttempt.attemptId,
    );
    publishAgentProjection(input.workspaceId, input.threadId, planned);
    if (planned.plan?.markdown) {
      setAgentLivePhaseText(
        input.workspaceId,
        input.threadId,
        planAttempt.attemptId,
        planned.plan.markdown,
        "plan",
      );
    }
    return planned;
  } catch (error) {
    try {
      const recovery = await sharedSessionV2RecoverAttempt(
        input.workspaceId,
        input.threadId,
        planAttempt.attemptId,
      );
      if (
        recovery.status === "terminal-committed" ||
        recovery.status === "not-accepted-committed" ||
        recovery.status === "active"
      ) {
        if (recovery.status === "active") {
          await withTimeout(
            sharedSessionV2AwaitTurnTerminal(
              input.workspaceId,
              input.threadId,
              planAttempt.attemptId,
            ),
            planAttempt.attemptId,
          );
        }
        const planned = await sharedAgentRecordPlan(
          input.workspaceId,
          input.threadId,
          requested.projection.runId,
          planAttempt.attemptId,
        );
        publishAgentProjection(input.workspaceId, input.threadId, planned);
        return planned;
      }
    } catch {
      // fall through
    }
    return stopAgent(
      input.workspaceId,
      input.threadId,
      requested.projection.runId,
      `plan failed: ${errorMessage(error)}`,
    );
  }
}

async function driveStageChain(
  workspaceId: string,
  threadId: string,
  runId: string,
  first: AgentPreparedAttempt,
): Promise<AgentProjectionV1> {
  await driveAttempt(workspaceId, threadId, first);
  const stageId = first.stageId || "implement";
  if (stageId === "implement" || stageId === "execute") {
    const next = await sharedAgentRecordExecute(
      workspaceId,
      threadId,
      runId,
      first.attemptId,
    );
    publishAgentProjection(workspaceId, threadId, next.projection);
    const reviewAttempt = asPrepared(next.stageAttempt);
    if (!reviewAttempt) {
      return next.projection;
    }
    clearAgentLivePhase(workspaceId, threadId);
    await driveAttempt(workspaceId, threadId, reviewAttempt);
    const settled = await sharedAgentRecordReview(
      workspaceId,
      threadId,
      runId,
      reviewAttempt.attemptId,
    );
    publishAgentProjection(workspaceId, threadId, settled);
    return settled;
  }
  if (stageId === "review") {
    const settled = await sharedAgentRecordReview(
      workspaceId,
      threadId,
      runId,
      first.attemptId,
    );
    publishAgentProjection(workspaceId, threadId, settled);
    return settled;
  }
  return (
    (await sharedAgentGet(workspaceId, threadId)) ??
    ({ runId, status: "failed" } as AgentProjectionV1)
  );
}

export async function approveAndExecuteAgent(
  workspaceId: string,
  threadId: string,
  runId: string,
  revision: number,
): Promise<AgentProjectionV1> {
  const approved = await sharedAgentApprove(
    workspaceId,
    threadId,
    runId,
    revision,
  );
  publishAgentProjection(workspaceId, threadId, approved.projection);
  openAgentInspector({
    workspaceId,
    threadId,
    runId,
    stageId: "implement",
  });
  clearAgentLivePhase(workspaceId, threadId);
  const implementAttempt = asPrepared(
    approved.stageAttempt ?? approved.executeAttempt,
  );
  if (!implementAttempt) {
    return approved.projection;
  }
  const runKey = key(workspaceId, threadId, runId);
  const existing = running.get(runKey);
  if (existing) return existing;
  const task = (async () => {
    try {
      return await driveStageChain(
        workspaceId,
        threadId,
        runId,
        implementAttempt,
      );
    } catch (error) {
      pushErrorToast({
        title: getI18n().t("multiAgent.errors.executionInterrupted"),
        message: errorMessage(error),
        durationMs: 5_000,
      });
      return stopAgent(
        workspaceId,
        threadId,
        runId,
        `execute failed: ${errorMessage(error)}`,
      );
    } finally {
      running.delete(runKey);
    }
  })();
  running.set(runKey, task);
  return task;
}

export async function stopAgent(
  workspaceId: string,
  threadId: string,
  runId: string,
  reason = "user stop",
): Promise<AgentProjectionV1> {
  const cancelling = await sharedAgentCancel(
    workspaceId,
    threadId,
    runId,
    reason,
  );
  publishAgentProjection(workspaceId, threadId, cancelling.projection);
  const attemptResults = await Promise.all(
    (cancelling.attemptIds ?? []).map(async (attemptId) => {
      try {
        await sharedSessionV2InterruptTurn(workspaceId, threadId, attemptId);
        return { attemptId, status: "interrupted" };
      } catch (interruptError) {
        try {
          await sharedSessionV2CancelAttempt(
            workspaceId,
            threadId,
            attemptId,
            "multi-agent stop",
          );
          return { attemptId, status: "cancelled-before-dispatch" };
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
  const settled = await sharedAgentFinalizeCancel(
    workspaceId,
    threadId,
    runId,
    attemptResults,
  );
  publishAgentProjection(workspaceId, threadId, settled);
  return settled;
}

export async function hydrateAgentProjection(
  workspaceId: string,
  threadId: string,
  expectedRunId: string,
): Promise<AgentProjectionV1 | null> {
  if (!isSharedSessionThreadId(threadId)) return null;
  const projection = await sharedAgentGet(workspaceId, threadId);
  if (projection && projection.runId !== expectedRunId) {
    throw new Error(
      `agent-hydration-mismatch: expected=${expectedRunId} actual=${projection.runId}`,
    );
  }
  publishAgentProjection(workspaceId, threadId, projection);
  return projection;
}

export function isActiveAgentProjection(
  projection: AgentProjectionV1 | null | undefined,
): boolean {
  return Boolean(projection && !isTerminalAgentStatus(projection.status));
}
