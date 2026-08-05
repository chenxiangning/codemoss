import { invoke } from "@tauri-apps/api/core";

import type {
  AgentExecutionTarget,
  AgentPreparedAttempt,
  AgentProjectionV1,
  AgentStageBinding,
} from "../../features/multi-agent/types";

export async function sharedAgentRequestRun(
  workspaceId: string,
  threadId: string,
  text: string,
  target: AgentExecutionTarget,
  stageBindings?: AgentStageBinding[],
): Promise<{
  projection: AgentProjectionV1;
  stageAttempt?: AgentPreparedAttempt;
  planAttempt?: AgentPreparedAttempt;
}> {
  return invoke("shared_agent_request_run", {
    workspaceId,
    threadId,
    text,
    target,
    stageBindings: stageBindings ?? null,
  });
}

export async function sharedAgentGet(
  workspaceId: string,
  threadId: string,
): Promise<AgentProjectionV1 | null> {
  return invoke("shared_agent_get", { workspaceId, threadId });
}

export async function sharedAgentRecordPlan(
  workspaceId: string,
  threadId: string,
  runId: string,
  attemptId: string,
): Promise<AgentProjectionV1> {
  return invoke("shared_agent_record_plan", {
    workspaceId,
    threadId,
    runId,
    attemptId,
  });
}

export async function sharedAgentApprove(
  workspaceId: string,
  threadId: string,
  runId: string,
  revision: number,
): Promise<{
  projection: AgentProjectionV1;
  stageAttempt?: AgentPreparedAttempt | null;
  executeAttempt?: AgentPreparedAttempt | null;
}> {
  return invoke("shared_agent_approve", {
    workspaceId,
    threadId,
    runId,
    revision,
  });
}

export async function sharedAgentRecordExecute(
  workspaceId: string,
  threadId: string,
  runId: string,
  attemptId: string,
): Promise<{
  projection: AgentProjectionV1;
  stageAttempt?: AgentPreparedAttempt | null;
}> {
  return invoke("shared_agent_record_execute", {
    workspaceId,
    threadId,
    runId,
    attemptId,
  });
}

export async function sharedAgentRecordReview(
  workspaceId: string,
  threadId: string,
  runId: string,
  attemptId: string,
): Promise<AgentProjectionV1> {
  return invoke("shared_agent_record_review", {
    workspaceId,
    threadId,
    runId,
    attemptId,
  });
}

export async function sharedAgentCancel(
  workspaceId: string,
  threadId: string,
  runId: string,
  reason: string,
): Promise<{ projection: AgentProjectionV1; attemptIds: string[] }> {
  return invoke("shared_agent_cancel", {
    workspaceId,
    threadId,
    runId,
    reason,
  });
}

export async function sharedAgentFinalizeCancel(
  workspaceId: string,
  threadId: string,
  runId: string,
  attemptResults: unknown[],
): Promise<AgentProjectionV1> {
  return invoke("shared_agent_finalize_cancel", {
    workspaceId,
    threadId,
    runId,
    attemptResults,
  });
}
