import type { EngineType } from "../../types";

export type SquadNodeKind = "analyze" | "mutate" | "verify" | "synthesize";
export type SquadPermissionClass = "read-only" | "current-workspace";
export type SquadRunStatus =
  | "planning"
  | "awaiting-approval"
  | "running"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled";
export type SquadNodeStatus =
  | "pending"
  | "ready"
  | "prepared"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled";

export type SquadExecutionTarget = {
  engine: EngineType;
  providerProfileId?: string | null;
  modelCatalogEntryId?: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
  providerProfileNameSnapshot?: string | null;
  providerProfileSource?: "local" | "managed" | null;
  runtimeCapabilityFingerprint?: string | null;
};

export type SquadBudgetV1 = {
  maxParallelReadOnly: number;
  maxNodeAttempts: number;
  maxRepairAttempts: number;
  maxWallClockSeconds: number;
};

export type SquadPlanNodeV1 = {
  id: string;
  title: string;
  kind: SquadNodeKind;
  goal: string;
  dependsOn: string[];
  repairOf?: string | null;
  target: SquadExecutionTarget;
  permission: SquadPermissionClass;
  maxAttempts: number;
  successCriteria: string[];
};

export type SquadPlanProposalV1 = {
  schemaVersion: 1;
  summary: string;
  budget: SquadBudgetV1;
  nodes: SquadPlanNodeV1[];
  finalNodeId: string;
};

export type SquadVerificationV1 = {
  status: "passed" | "failed" | "not-run";
  checks: string[];
  failures: string[];
};

export type SquadTypedOutcomeEnvelopeV1 = {
  schemaVersion: 1;
  status: "succeeded" | "failed" | "blocked" | "cancelled";
  summary: string;
  evidence: { label: string; detail: string; path?: string | null }[];
  artifacts: string[];
  changedPaths: string[];
  verification: SquadVerificationV1;
  proposedRepairs: string[];
  extra?: unknown;
};

export type SquadAttemptProjectionV1 = {
  attemptId: string;
  bindingKey: string;
  status: SquadNodeStatus;
  startedAt: number;
  settledAt?: number | null;
  contextPackage?: {
    packageId: string;
    sourceChecksum: string;
    fromSequenceExclusive?: number | null;
    throughSequenceInclusive: number;
    mode: string;
    scope?: unknown;
  } | null;
};

export type SquadNodeProjectionV1 = {
  node: SquadPlanNodeV1;
  status: SquadNodeStatus;
  attempts: SquadAttemptProjectionV1[];
  outcome?: SquadTypedOutcomeEnvelopeV1 | null;
  diagnostics: string[];
};

export type SquadProjectionV1 = {
  schemaVersion: 1;
  runId: string;
  workspaceId: string;
  workspaceRoot: string;
  sessionId: string;
  requestText: string;
  leadTarget: SquadExecutionTarget;
  status: SquadRunStatus;
  planRevision: number;
  plan?: SquadPlanProposalV1 | null;
  nodes: SquadNodeProjectionV1[];
  activeAttemptIds: string[];
  diagnostics: string[];
  requestedAt: number;
  approvedAt?: number | null;
  updatedAt: number;
};

export type SquadPreparedAttemptV1 = {
  runId: string;
  nodeId: string;
  nodeKind: SquadNodeKind;
  attemptId: string;
  logicalTurnId: string;
  bindingKey: string;
  target: SquadExecutionTarget;
  permission: SquadPermissionClass;
};

export type SquadRequestRunResult = {
  projection: SquadProjectionV1;
  leadAttempt: SquadPreparedAttemptV1;
};

export type SquadClaimReadyResultV1 = {
  projection: SquadProjectionV1;
  prepared: SquadPreparedAttemptV1[];
};

export type SquadCancelResult = {
  projection: SquadProjectionV1;
  attemptIds: string[];
};

export function isTerminalSquadStatus(status: SquadRunStatus): boolean {
  return ["succeeded", "failed", "blocked", "cancelled"].includes(status);
}
