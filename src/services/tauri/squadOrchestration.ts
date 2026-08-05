import { invoke } from "@tauri-apps/api/core";
import type {
  SquadCancelResult,
  SquadClaimReadyResultV1,
  SquadExecutionTarget,
  SquadPlanProposalV1,
  SquadProjectionV1,
  SquadRequestRunResult,
} from "../../features/squad-orchestration/types";

type JsonObject = Record<string, unknown>;

function invalid(path: string, expected: string): never {
  throw new Error(`squad-response-invalid: ${path} must be ${expected}`);
}

function objectAt(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(path, "an object");
  }
  return value as JsonObject;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim())
    invalid(path, "a non-empty string");
  return value;
}

function numberAt(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    invalid(path, "a finite number");
  return value;
}

function enumAt<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    invalid(path, `one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, "an array");
  return value;
}

function stringArrayAt(value: unknown, path: string): string[] {
  return arrayAt(value, path).map((item, index) =>
    stringAt(item, `${path}[${index}]`),
  );
}

function assertTarget(value: unknown, path: string): void {
  const target = objectAt(value, path);
  enumAt(target.engine, `${path}.engine`, [
    "claude",
    "codex",
    "gemini",
    "grok",
    "kimi",
    "opencode",
  ]);
  stringAt(target.modelCatalogEntryId, `${path}.modelCatalogEntryId`);
  stringAt(target.model, `${path}.model`);
  stringAt(
    target.providerProfileNameSnapshot,
    `${path}.providerProfileNameSnapshot`,
  );
  const source = enumAt(
    target.providerProfileSource,
    `${path}.providerProfileSource`,
    ["local", "managed"],
  );
  const providerProfileId = target.providerProfileId;
  if (
    source === "local" &&
    providerProfileId !== null &&
    providerProfileId !== undefined
  ) {
    invalid(`${path}.providerProfileId`, "null for a local target");
  }
  if (source === "managed") {
    stringAt(providerProfileId, `${path}.providerProfileId`);
  }
  for (const field of [
    "reasoningEffort",
    "runtimeCapabilityFingerprint",
  ] as const) {
    if (target[field] !== null && target[field] !== undefined) {
      stringAt(target[field], `${path}.${field}`);
    }
  }
}

function assertPlan(value: unknown, path: string): void {
  const plan = objectAt(value, path);
  if (plan.schemaVersion !== 1) invalid(`${path}.schemaVersion`, "1");
  stringAt(plan.summary, `${path}.summary`);
  const budget = objectAt(plan.budget, `${path}.budget`);
  for (const field of [
    "maxParallelReadOnly",
    "maxNodeAttempts",
    "maxRepairAttempts",
    "maxWallClockSeconds",
  ] as const) {
    numberAt(budget[field], `${path}.budget.${field}`);
  }
  arrayAt(plan.nodes, `${path}.nodes`).forEach((candidate, index) =>
    assertPlanNode(candidate, `${path}.nodes[${index}]`),
  );
  stringAt(plan.finalNodeId, `${path}.finalNodeId`);
}

function assertOutcome(value: unknown, path: string): void {
  const outcome = objectAt(value, path);
  if (outcome.schemaVersion !== 1) invalid(`${path}.schemaVersion`, "1");
  enumAt(outcome.status, `${path}.status`, [
    "succeeded",
    "failed",
    "blocked",
    "cancelled",
  ]);
  stringAt(outcome.summary, `${path}.summary`);
  arrayAt(outcome.evidence, `${path}.evidence`).forEach((candidate, index) => {
    const evidence = objectAt(candidate, `${path}.evidence[${index}]`);
    stringAt(evidence.label, `${path}.evidence[${index}].label`);
    stringAt(evidence.detail, `${path}.evidence[${index}].detail`);
    if (evidence.path !== null && evidence.path !== undefined) {
      stringAt(evidence.path, `${path}.evidence[${index}].path`);
    }
  });
  stringArrayAt(outcome.artifacts, `${path}.artifacts`);
  stringArrayAt(outcome.changedPaths, `${path}.changedPaths`);
  const verification = objectAt(outcome.verification, `${path}.verification`);
  enumAt(verification.status, `${path}.verification.status`, [
    "passed",
    "failed",
    "not-run",
  ]);
  stringArrayAt(verification.checks, `${path}.verification.checks`);
  stringArrayAt(verification.failures, `${path}.verification.failures`);
  stringArrayAt(outcome.proposedRepairs, `${path}.proposedRepairs`);
}

function assertPreparedAttempt(value: unknown, path: string): void {
  const attempt = objectAt(value, path);
  for (const field of [
    "runId",
    "nodeId",
    "attemptId",
    "logicalTurnId",
    "bindingKey",
  ] as const) {
    stringAt(attempt[field], `${path}.${field}`);
  }
  enumAt(attempt.nodeKind, `${path}.nodeKind`, [
    "analyze",
    "mutate",
    "verify",
    "synthesize",
  ]);
  assertTarget(attempt.target, `${path}.target`);
  enumAt(attempt.permission, `${path}.permission`, [
    "read-only",
    "current-workspace",
  ]);
}

export function decodeSquadProjection(value: unknown): SquadProjectionV1 {
  const projection = objectAt(value, "projection");
  if (projection.schemaVersion !== 1) invalid("projection.schemaVersion", "1");
  for (const field of [
    "runId",
    "workspaceId",
    "workspaceRoot",
    "sessionId",
    "requestText",
  ] as const) {
    stringAt(projection[field], `projection.${field}`);
  }
  assertTarget(projection.leadTarget, "projection.leadTarget");
  enumAt(projection.status, "projection.status", [
    "planning",
    "awaiting-approval",
    "running",
    "cancelling",
    "succeeded",
    "failed",
    "blocked",
    "cancelled",
  ]);
  numberAt(projection.planRevision, "projection.planRevision");
  if (projection.plan !== null && projection.plan !== undefined) {
    assertPlan(projection.plan, "projection.plan");
  }
  arrayAt(projection.nodes, "projection.nodes").forEach(
    (candidate, nodeIndex) => {
      const nodePath = `projection.nodes[${nodeIndex}]`;
      const node = objectAt(candidate, nodePath);
      assertPlanNode(node.node, `${nodePath}.node`);
      enumAt(node.status, `${nodePath}.status`, [
        "pending",
        "ready",
        "prepared",
        "running",
        "succeeded",
        "failed",
        "blocked",
        "cancelled",
      ]);
      arrayAt(node.attempts, `${nodePath}.attempts`).forEach(
        (candidateAttempt, attemptIndex) => {
          const attemptPath = `${nodePath}.attempts[${attemptIndex}]`;
          const attempt = objectAt(candidateAttempt, attemptPath);
          stringAt(attempt.attemptId, `${attemptPath}.attemptId`);
          stringAt(attempt.bindingKey, `${attemptPath}.bindingKey`);
          enumAt(attempt.status, `${attemptPath}.status`, [
            "pending",
            "ready",
            "prepared",
            "running",
            "succeeded",
            "failed",
            "blocked",
            "cancelled",
          ]);
          numberAt(attempt.startedAt, `${attemptPath}.startedAt`);
          if (attempt.settledAt !== null && attempt.settledAt !== undefined) {
            numberAt(attempt.settledAt, `${attemptPath}.settledAt`);
          }
          if (
            attempt.contextPackage !== null &&
            attempt.contextPackage !== undefined
          ) {
            const contextPath = `${attemptPath}.contextPackage`;
            const contextPackage = objectAt(
              attempt.contextPackage,
              contextPath,
            );
            stringAt(contextPackage.packageId, `${contextPath}.packageId`);
            stringAt(
              contextPackage.sourceChecksum,
              `${contextPath}.sourceChecksum`,
            );
            stringAt(contextPackage.mode, `${contextPath}.mode`);
            numberAt(
              contextPackage.throughSequenceInclusive,
              `${contextPath}.throughSequenceInclusive`,
            );
            if (
              contextPackage.fromSequenceExclusive !== null &&
              contextPackage.fromSequenceExclusive !== undefined
            ) {
              numberAt(
                contextPackage.fromSequenceExclusive,
                `${contextPath}.fromSequenceExclusive`,
              );
            }
          }
        },
      );
      if (node.outcome !== null && node.outcome !== undefined) {
        assertOutcome(node.outcome, `${nodePath}.outcome`);
      }
      stringArrayAt(node.diagnostics, `${nodePath}.diagnostics`);
    },
  );
  stringArrayAt(projection.activeAttemptIds, "projection.activeAttemptIds");
  stringArrayAt(projection.diagnostics, "projection.diagnostics");
  numberAt(projection.requestedAt, "projection.requestedAt");
  if (projection.approvedAt !== null && projection.approvedAt !== undefined) {
    numberAt(projection.approvedAt, "projection.approvedAt");
  }
  numberAt(projection.updatedAt, "projection.updatedAt");
  return value as SquadProjectionV1;
}

function assertPlanNode(value: unknown, path: string): void {
  const node = objectAt(value, path);
  stringAt(node.id, `${path}.id`);
  stringAt(node.title, `${path}.title`);
  enumAt(node.kind, `${path}.kind`, [
    "analyze",
    "mutate",
    "verify",
    "synthesize",
  ]);
  stringAt(node.goal, `${path}.goal`);
  stringArrayAt(node.dependsOn, `${path}.dependsOn`);
  if (node.repairOf !== null && node.repairOf !== undefined) {
    stringAt(node.repairOf, `${path}.repairOf`);
  }
  assertTarget(node.target, `${path}.target`);
  enumAt(node.permission, `${path}.permission`, [
    "read-only",
    "current-workspace",
  ]);
  numberAt(node.maxAttempts, `${path}.maxAttempts`);
  stringArrayAt(node.successCriteria, `${path}.successCriteria`);
}

export function decodeSquadRequestRunResult(
  value: unknown,
): SquadRequestRunResult {
  const result = objectAt(value, "requestRun");
  const projection = decodeSquadProjection(result.projection);
  assertPreparedAttempt(result.leadAttempt, "requestRun.leadAttempt");
  return { ...result, projection } as SquadRequestRunResult;
}

export function decodeSquadClaimResult(
  value: unknown,
): SquadClaimReadyResultV1 {
  const result = objectAt(value, "claimReadyNodes");
  const projection = decodeSquadProjection(result.projection);
  arrayAt(result.prepared, "claimReadyNodes.prepared").forEach(
    (attempt, index) =>
      assertPreparedAttempt(attempt, `claimReadyNodes.prepared[${index}]`),
  );
  return { ...result, projection } as SquadClaimReadyResultV1;
}

export function decodeSquadCancelResult(value: unknown): SquadCancelResult {
  const result = objectAt(value, "cancel");
  const projection = decodeSquadProjection(result.projection);
  stringArrayAt(result.attemptIds, "cancel.attemptIds");
  return { ...result, projection } as SquadCancelResult;
}

export function sharedSquadRequestRun(
  workspaceId: string,
  threadId: string,
  text: string,
  target: SquadExecutionTarget,
) {
  return invoke<unknown>("shared_squad_request_run", {
    workspaceId,
    threadId,
    text,
    target,
  }).then(decodeSquadRequestRunResult);
}

export function sharedSquadRecordLeadPlan(
  workspaceId: string,
  threadId: string,
  runId: string,
  attemptId: string,
) {
  return invoke<unknown>("shared_squad_record_lead_plan", {
    workspaceId,
    threadId,
    runId,
    attemptId,
  }).then(decodeSquadProjection);
}

export function sharedSquadRevisePlan(
  workspaceId: string,
  threadId: string,
  runId: string,
  plan: SquadPlanProposalV1,
) {
  return invoke<unknown>("shared_squad_revise_plan", {
    workspaceId,
    threadId,
    runId,
    plan,
  }).then(decodeSquadProjection);
}

export function sharedSquadApprovePlan(
  workspaceId: string,
  threadId: string,
  runId: string,
  revision: number,
) {
  return invoke<unknown>("shared_squad_approve_plan", {
    workspaceId,
    threadId,
    runId,
    revision,
  }).then(decodeSquadProjection);
}

export function sharedSquadGet(workspaceId: string, threadId: string) {
  return invoke<unknown>("shared_squad_get", {
    workspaceId,
    threadId,
  }).then((value) => (value === null ? null : decodeSquadProjection(value)));
}

export function sharedSquadClaimReadyNodes(
  workspaceId: string,
  threadId: string,
  runId: string,
) {
  return invoke<unknown>("shared_squad_claim_ready_nodes", {
    workspaceId,
    threadId,
    runId,
  }).then(decodeSquadClaimResult);
}

export function sharedSquadRecordAttemptOutcome(
  workspaceId: string,
  threadId: string,
  runId: string,
  nodeId: string,
  attemptId: string,
) {
  return invoke<unknown>("shared_squad_record_attempt_outcome", {
    workspaceId,
    threadId,
    runId,
    nodeId,
    attemptId,
  }).then(decodeSquadProjection);
}

export function sharedSquadCancel(
  workspaceId: string,
  threadId: string,
  runId: string,
  reason?: string,
) {
  return invoke<unknown>("shared_squad_cancel", {
    workspaceId,
    threadId,
    runId,
    reason: reason ?? null,
  }).then(decodeSquadCancelResult);
}

export function sharedSquadFinalizeCancel(
  workspaceId: string,
  threadId: string,
  runId: string,
  interruptResults: unknown[],
) {
  return invoke<unknown>("shared_squad_finalize_cancel", {
    workspaceId,
    threadId,
    runId,
    interruptResults,
  }).then(decodeSquadProjection);
}
