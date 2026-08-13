import { invoke } from "@tauri-apps/api/core";
import type { SharedRuntimeControlOwner } from "../../types";

export async function respondToServerRequest(
  workspaceId: string,
  requestId: number | string,
  decision: "accept" | "decline",
  sharedOwner?: SharedRuntimeControlOwner | null,
  options?: { scope?: "once" | "session" | "workspace" },
) {
  const result: Record<string, unknown> = { decision };
  if (options?.scope) {
    result.scope = options.scope;
  }
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result,
    providerProfileId: sharedOwner?.providerProfileId ?? null,
    ...(sharedOwner
      ? {
          threadId: sharedOwner.nativeThreadId,
          turnId: sharedOwner.runtimeTurnId,
          sharedAttemptId: sharedOwner.attemptId,
          sharedThreadId: sharedOwner.sharedThreadId,
          providerRuntimeKey: sharedOwner.providerRuntimeKey,
        }
      : {}),
  });
}

export async function respondToUserInputRequest(
  workspaceId: string,
  requestId: number | string,
  answers: Record<string, { answers: string[] }>,
  options?: {
    threadId?: string | null;
    turnId?: string | null;
    skippedQuestionIds?: string[];
    sharedOwner?: SharedRuntimeControlOwner;
  },
) {
  const result: Record<string, unknown> = { answers };
  if (options?.skippedQuestionIds?.length) {
    result.skippedQuestionIds = options.skippedQuestionIds;
  }
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result,
    threadId: options?.sharedOwner?.nativeThreadId ?? options?.threadId ?? null,
    turnId: options?.sharedOwner?.runtimeTurnId ?? options?.turnId ?? null,
    ...(options?.sharedOwner
      ? {
          providerProfileId: options.sharedOwner.providerProfileId,
          sharedAttemptId: options.sharedOwner.attemptId,
          sharedThreadId: options.sharedOwner.sharedThreadId,
          providerRuntimeKey: options.sharedOwner.providerRuntimeKey,
        }
      : {}),
  });
}

export async function rememberApprovalRule(workspaceId: string, command: string[]) {
  return invoke("remember_approval_rule", { workspaceId, command });
}
