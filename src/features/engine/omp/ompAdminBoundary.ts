import {
  getClientStoreSync,
  writeClientStoreValue,
} from "@/services/clientStorage";
import type { CodexDoctorResult } from "../../../types/diagnostics";

/** P12 surfaces are policy projections only; execution remains in existing native services. */
export type OmpAdminDomain =
  | "worktree"
  | "git"
  | "bench"
  | "setup"
  | "update"
  | "diagnostics";

export type OmpAdminOperation =
  | "worktree.list"
  | "worktree.create"
  | "worktree.remove"
  | "worktree.cleanup"
  | "worktree.clear"
  | "git.status"
  | "git.log"
  | "git.diff"
  | "git.command"
  | "bench.measure"
  | "setup.install"
  | "setup.configure"
  | "update.install"
  | "update.apply"
  | "update.gc"
  | "diagnostics.doctor"
  | "diagnostics.cleanse"
  | "diagnostics.grievances";

export type OmpAdminRole = "admin" | "user";

export type OmpWorktreeOwnership = Readonly<{
  worktreeId: string;
  ownerId: string;
  workspaceId: string;
}>;

export type OmpAdminAction = Readonly<{
  operation: OmpAdminOperation;
  ownerId: string;
  workspaceId?: string | null;
  worktreeId?: string | null;
  /** Required for worktree removal/cleanup and mutating git commands. */
  confirmationToken?: string | null;
  confirmed?: boolean;
  /** Bench must never be attached to a foreground Conversation. */
  conversationId?: string | null;
  provider?: string | null;
  model?: string | null;
}>;

export type OmpAdminBoundaryContext = Readonly<{
  actorId: string;
  role: OmpAdminRole;
  ompOwnerId: string;
  workspaceId?: string | null;
  ownership?: OmpWorktreeOwnership | null;
  mutationGuard?: ((operation: OmpAdminOperation) => boolean) | null;
}>;

export type OmpAdminAudit = Readonly<{
  domain: OmpAdminDomain;
  operation: OmpAdminOperation;
  ownerId: string;
  workspaceId: string | null;
  actorId: string;
  destructive: boolean;
}>;

export type OmpAdminDecision = Readonly<{
  allowed: boolean;
  reason:
    | "allowed"
    | "owner-mismatch"
    | "workspace-mismatch"
    | "admin-required"
    | "confirmation-required"
    | "mutation-guard-denied"
    | "bench-conversation-coupling"
    | "invalid-scope";
  audit: OmpAdminAudit;
}>;

export type OmpBenchMeasurement = Readonly<{
  provider: string;
  model: string;
  durationMs: number;
  ok: boolean;
  conversationId: null;
}>;

export type OmpDiagnosticsProjection = Readonly<{
  kind: "diagnostics";
  workspaceId: string | null;
  result: CodexDoctorResult;
  conversationId: null;
}>;

const DESTRUCTIVE_OPERATIONS: Partial<Record<OmpAdminOperation, true>> = {
  "worktree.remove": true,
  "worktree.cleanup": true,
  "worktree.clear": true,
  "git.command": true,
  "setup.install": true,
  "setup.configure": true,
  "update.install": true,
  "update.apply": true,
  "update.gc": true,
  "diagnostics.cleanse": true,
};

const ADMIN_ONLY_OPERATIONS: Partial<Record<OmpAdminOperation, true>> = {
  "setup.install": true,
  "setup.configure": true,
  "update.install": true,
  "update.apply": true,
  "update.gc": true,
  "diagnostics.cleanse": true,
  "diagnostics.grievances": true,
};

const domainFor = (operation: OmpAdminOperation): OmpAdminDomain => {
  const separator = operation.indexOf(".");
  return operation.slice(0, separator) as OmpAdminDomain;
};

const isNonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Worktree ownership is explicit and fail-closed. A missing registry entry is not
 * treated as ownership, which prevents an OMP task from mutating another surface.
 */
export function ownsOmpWorktree(
  ownership: OmpWorktreeOwnership | null | undefined,
  ownerId: string,
  workspaceId: string,
  worktreeId: string,
): boolean {
  return Boolean(
    ownership &&
      ownership.ownerId === ownerId &&
      ownership.workspaceId === workspaceId &&
      ownership.worktreeId === worktreeId,
  );
}

/** Pure admin/workspace policy. It never invokes Git, filesystem, or native IPC. */
export function evaluateOmpAdminAction(
  action: OmpAdminAction,
  context: OmpAdminBoundaryContext,
): OmpAdminDecision {
  const destructive = DESTRUCTIVE_OPERATIONS[action.operation] === true;
  const audit: OmpAdminAudit = Object.freeze({
    domain: domainFor(action.operation),
    operation: action.operation,
    ownerId: action.ownerId,
    workspaceId: action.workspaceId ?? null,
    actorId: context.actorId,
    destructive,
  });
  const deny = (reason: OmpAdminDecision["reason"]): OmpAdminDecision =>
    Object.freeze({ allowed: false, reason, audit });

  if (!isNonEmpty(action.ownerId) || action.ownerId !== context.ompOwnerId) {
    return deny("owner-mismatch");
  }
  if (action.workspaceId !== undefined && action.workspaceId !== context.workspaceId) {
    return deny("workspace-mismatch");
  }
  if (ADMIN_ONLY_OPERATIONS[action.operation] === true && context.role !== "admin") {
    return deny("admin-required");
  }
  if (
    (action.operation === "worktree.remove" ||
      action.operation === "worktree.cleanup" ||
      action.operation === "worktree.clear") &&
    (!isNonEmpty(action.worktreeId) ||
      !isNonEmpty(action.workspaceId) ||
      !ownsOmpWorktree(
        context.ownership,
        context.ompOwnerId,
        action.workspaceId,
        action.worktreeId,
      ))
  ) {
    return deny("invalid-scope");
  }
  if (action.operation === "bench.measure" && action.conversationId) {
    return deny("bench-conversation-coupling");
  }
  if (destructive && action.confirmed !== true && action.confirmationToken !== issueOmpConfirmationToken(action)) {
    return deny("confirmation-required");
  }
  // Destructive operations require an existing native guard. Read-only OMP
  // projections never invoke that guard and therefore cannot be blocked by a
  // mutation-only policy callback.
  if (destructive && context.mutationGuard?.(action.operation) !== true) {
    return deny("mutation-guard-denied");
  }
  return Object.freeze({ allowed: true, reason: "allowed", audit });
}

/**
 * 破坏性操作的确认 token 与动作元组绑定（operation + owner + workspace +
 * worktree），静态占位字符串无法通过门禁；token 由真实确认流程按动作签发。
 */
export function issueOmpConfirmationToken(
  action: Pick<OmpAdminAction, "operation" | "ownerId" | "workspaceId" | "worktreeId">,
): string {
  return [
    "omp-confirm",
    action.operation,
    action.ownerId,
    action.workspaceId ?? "",
    action.worktreeId ?? "",
  ].join(":");
}

/** Remove all ownership records for an OMP owner; native cleanup is intentionally not called here. */
export function rollbackOmpWorktreeOwnership(
  records: readonly OmpWorktreeOwnership[],
  ownerId: string,
): OmpWorktreeOwnership[] {
  return records.filter((record) => record.ownerId !== ownerId);
}

/** Bench results are feature-local and cannot carry a Conversation identity. */
export function projectOmpBenchMeasurement(input: {
  provider: string;
  model: string;
  durationMs: number;
  ok: boolean;
}): OmpBenchMeasurement {
  return Object.freeze({ ...input, conversationId: null });
}

/** Diagnostics remain typed and separate from assistant-authored conversation events. */
export function projectOmpDiagnostics(
  result: CodexDoctorResult,
  workspaceId: string | null = null,
): OmpDiagnosticsProjection {
  return Object.freeze({
    kind: "diagnostics",
    workspaceId,
    result,
    conversationId: null,
  });
}

export type OmpAdminCapabilityState =
  | "supported"
  | "compat-input"
  | "unsupported"
  | "unknown";

export type OmpAdminCapability =
  | "memory"
  | "mental-models"
  | "advisor"
  | "security.plan"
  | "security.scan"
  | "security.status"
  | "security.cancel"
  | "security.scans"
  | "security.show"
  | "security.import"
  | "security.export"
  | "security.validate"
  | "security.compare"
  | "security.disposition"
  | "usage.stats"
  | "export.html"
  | "share.encrypted"
  | "admin.rollback";

export const OMP_ADMIN_CAPABILITIES: readonly OmpAdminCapability[] = [
  "memory",
  "mental-models",
  "advisor",
  "security.plan",
  "security.scan",
  "security.status",
  "security.cancel",
  "security.scans",
  "security.show",
  "security.import",
  "security.export",
  "security.validate",
  "security.compare",
  "security.disposition",
  "usage.stats",
  "export.html",
  "share.encrypted",
  "admin.rollback",
];

export type OmpAdminCapabilityRecord = Readonly<{
  state: OmpAdminCapabilityState;
  enabled: boolean;
  requiresApproval: boolean;
  nativeCommand: string | null;
  reason: string;
}>;

export type OmpAdminCapabilityEvidence = Readonly<{
  nativeCommand?: string;
  nativeCommands?: readonly string[];
  verified?: boolean;
}>;

const unsupportedOmpCapability = (): OmpAdminCapabilityRecord => ({
  state: "unsupported",
  enabled: false,
  requiresApproval: true,
  nativeCommand: null,
  reason: "native-support-not-proven",
});

export type OmpAdminCapabilityMatrix = Readonly<
  Record<OmpAdminCapability, OmpAdminCapabilityRecord>
>;

export const DEFAULT_OMP_ADMIN_CAPABILITY_MATRIX: OmpAdminCapabilityMatrix = Object.freeze(
  Object.fromEntries(
    OMP_ADMIN_CAPABILITIES.map((capability) => [capability, unsupportedOmpCapability()]),
  ) as Record<OmpAdminCapability, OmpAdminCapabilityRecord>,
);

export function projectOmpAdminCapability(
  capability: OmpAdminCapability,
  evidence: OmpAdminCapabilityEvidence = {},
): OmpAdminCapabilityRecord {
  void capability;
  const nativeCommand = evidence.nativeCommand?.trim();
  const commandDiscovered =
    nativeCommand !== undefined &&
    nativeCommand.length > 0 &&
    evidence.nativeCommands?.includes(nativeCommand) === true;
  if (!commandDiscovered) {
    return unsupportedOmpCapability();
  }
  return {
    state: evidence.verified === true ? "supported" : "compat-input",
    enabled: false,
    requiresApproval: true,
    nativeCommand: nativeCommand ?? null,
    reason: evidence.verified === true ? "native-evidence-verified" : "native-output-unverified",
  };
}

export function grantOmpAdminCapability(
  matrix: OmpAdminCapabilityMatrix,
  capability: OmpAdminCapability,
  requiresApproval = true,
): OmpAdminCapabilityMatrix {
  const record = matrix[capability];
  if (record.state !== "supported") {
    return matrix;
  }
  return Object.freeze({
    ...matrix,
    [capability]: Object.freeze({ ...record, enabled: true, requiresApproval }),
  });
}

export type OmpAdminOwner = Readonly<{
  engine: "omp";
  workspaceId: string;
  runtimeProfileId: string;
  providerProfileId: string;
  nativeSessionId: string;
  logicalThreadId?: string;
}>;

export type OmpAttributionStatus = "strict-match" | "unattributed" | "mismatch";

export type OmpAttributionProjection = Readonly<{
  owner: OmpAdminOwner | null;
  status: OmpAttributionStatus;
  reason: string;
}>;

export function projectOmpAttribution(
  candidate: Partial<OmpAdminOwner> | null | undefined,
  expectedOwner: OmpAdminOwner,
): OmpAttributionProjection {
  if (!candidate) {
    return { owner: null, status: "unattributed", reason: "missing-owner" };
  }
  const workspaceId = candidate.workspaceId;
  const runtimeProfileId = candidate.runtimeProfileId;
  const providerProfileId = candidate.providerProfileId;
  const nativeSessionId = candidate.nativeSessionId;
  if (
    candidate.engine !== "omp" ||
    typeof workspaceId !== "string" ||
    typeof runtimeProfileId !== "string" ||
    typeof providerProfileId !== "string" ||
    typeof nativeSessionId !== "string" ||
    !workspaceId.trim() ||
    !runtimeProfileId.trim() ||
    !providerProfileId.trim() ||
    !nativeSessionId.trim()
  ) {
    return { owner: null, status: "unattributed", reason: "incomplete-owner" };
  }
  const actual = {
    engine: candidate.engine,
    workspaceId: workspaceId.trim(),
    runtimeProfileId: runtimeProfileId.trim(),
    providerProfileId: providerProfileId.trim(),
    nativeSessionId: nativeSessionId.trim(),
    logicalThreadId: candidate.logicalThreadId?.trim() || undefined,
  } as OmpAdminOwner;
  const expectedThreadMatches =
    actual.logicalThreadId === undefined || actual.logicalThreadId === expectedOwner.logicalThreadId;
  const matches =
    actual.engine === expectedOwner.engine &&
    actual.workspaceId === expectedOwner.workspaceId &&
    actual.runtimeProfileId === expectedOwner.runtimeProfileId &&
    actual.providerProfileId === expectedOwner.providerProfileId &&
    actual.nativeSessionId === expectedOwner.nativeSessionId &&
    expectedThreadMatches;
  return matches
    ? { owner: actual, status: "strict-match", reason: "owner-matched" }
    : { owner: null, status: "mismatch", reason: "owner-mismatch" };
}

const OMP_SENSITIVE_KEY =
  /^(?:api-key|access-token|auth-token|authorization|cookie|credential|password|private-key|refresh-token|secret|session-token|token)$/;
const OMP_SENSITIVE_ASSIGNMENT =
  /\b(api[-_]?key|access[-_]?token|authorization|cookie|password|refresh[-_]?token|secret|token)\s*([=:])\s*((?!Bearer\s)[^\s,;]+)/gi;
const OMP_BEARER_TOKEN = /\bBearer\s+[^\s,;]+/gi;

function isOmpSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return OMP_SENSITIVE_KEY.test(normalized);
}

export type OmpRedactionResult = Readonly<{
  value: unknown;
  valuesRedacted: boolean;
  redactedPaths: readonly string[];
}>;

function redactOmpString(value: string, path: string, redactedPaths: string[]): string {
  let redacted = value.replace(OMP_BEARER_TOKEN, () => {
    redactedPaths.push(path);
    return "Bearer [redacted]";
  });
  redacted = redacted.replace(
    OMP_SENSITIVE_ASSIGNMENT,
    (_match, key: string, separator: string) => {
      redactedPaths.push(path);
      return `${key}${separator}[redacted]`;
    },
  );
  return redacted;
}

function redactOmpValue(value: unknown, path: string, redactedPaths: string[]): unknown {
  if (typeof value === "string") {
    return redactOmpString(value, path, redactedPaths);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactOmpValue(item, `${path}[${index}]`, redactedPaths));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const childPath = path ? `${path}.${key}` : key;
        if (isOmpSensitiveKey(key)) {
          redactedPaths.push(childPath);
          return [key, "[redacted]"];
        }
        return [key, redactOmpValue(item, childPath, redactedPaths)];
      }),
    );
  }
  return value;
}

export function redactOmpAdminValue(value: unknown): OmpRedactionResult {
  const redactedPaths: string[] = [];
  return {
    value: redactOmpValue(value, "", redactedPaths),
    valuesRedacted: redactedPaths.length > 0,
    redactedPaths: [...new Set(redactedPaths)],
  };
}

export type OmpAuditMetadata = Readonly<{
  operation: string;
  actor: "omp-native";
  requestId: string;
  occurredAt: string;
  owner: OmpAdminOwner;
  valuesRedacted: boolean;
}>;

export type OmpAdminProjection<T> = Readonly<{
  surface: "omp-admin";
  capability: OmpAdminCapability;
  state: OmpAdminCapabilityState;
  data: T | null;
  attribution: OmpAttributionProjection;
  audit: OmpAuditMetadata | null;
  redaction: OmpRedactionResult;
  reason: string;
}>;

function projectOmpAdminPayload<T>(input: {
  capability: OmpAdminCapability;
  evidence: OmpAdminCapabilityEvidence;
  candidateOwner: Partial<OmpAdminOwner> | null | undefined;
  expectedOwner: OmpAdminOwner;
  payload: T;
  operation: string;
  requestId: string;
  occurredAt?: string;
}): OmpAdminProjection<T> {
  const capability = projectOmpAdminCapability(input.capability, input.evidence);
  const redaction = redactOmpAdminValue(input.payload);
  if (capability.state === "unsupported") {
    return {
      surface: "omp-admin",
      capability: input.capability,
      state: "unsupported",
      data: null,
      attribution: { owner: null, status: "unattributed", reason: "native-support-not-proven" },
      audit: null,
      redaction: { value: null, valuesRedacted: false, redactedPaths: [] },
      reason: capability.reason,
    };
  }
  const attribution = projectOmpAttribution(input.candidateOwner, input.expectedOwner);
  if (attribution.status !== "strict-match" || !attribution.owner) {
    return {
      surface: "omp-admin",
      capability: input.capability,
      state: capability.state,
      data: null,
      attribution,
      audit: null,
      redaction,
      reason: attribution.reason,
    };
  }
  return {
    surface: "omp-admin",
    capability: input.capability,
    state: capability.state,
    data: redaction.value as T,
    attribution,
    audit: {
      operation: input.operation,
      actor: "omp-native",
      requestId: input.requestId,
      occurredAt: input.occurredAt ?? new Date(0).toISOString(),
      owner: attribution.owner,
      valuesRedacted: redaction.valuesRedacted,
    },
    redaction,
    reason: capability.reason,
  };
}

export type OmpSecurityFinding = Readonly<{
  id: string;
  source: string;
  severity: string;
  disposition: string;
  details: unknown;
}>;

export function projectOmpSecurityFinding(input: {
  evidence: OmpAdminCapabilityEvidence;
  candidateOwner: Partial<OmpAdminOwner> | null | undefined;
  expectedOwner: OmpAdminOwner;
  finding: OmpSecurityFinding;
  requestId: string;
  occurredAt?: string;
}): OmpAdminProjection<OmpSecurityFinding> {
  return projectOmpAdminPayload({
    ...input,
    capability: "security.show",
    payload: input.finding,
    operation: "security.finding.project",
  });
}

export type OmpUsageAttribution = Readonly<{
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  contextUsedTokens?: number;
  modelContextWindow?: number;
}>;

export function projectOmpUsage(input: {
  evidence: OmpAdminCapabilityEvidence;
  candidateOwner: Partial<OmpAdminOwner> | null | undefined;
  expectedOwner: OmpAdminOwner;
  usage: OmpUsageAttribution;
  requestId: string;
  occurredAt?: string;
}): OmpAdminProjection<OmpUsageAttribution> {
  return projectOmpAdminPayload({
    ...input,
    capability: "usage.stats",
    payload: input.usage,
    operation: "usage.stats.project",
  });
}

export function projectOmpExport<T>(input: {
  capability: "export.html" | "share.encrypted";
  evidence: OmpAdminCapabilityEvidence;
  candidateOwner: Partial<OmpAdminOwner> | null | undefined;
  expectedOwner: OmpAdminOwner;
  payload: T;
  requestId: string;
  occurredAt?: string;
}): OmpAdminProjection<T> {
  return projectOmpAdminPayload({
    ...input,
    operation: input.capability,
  });
}

export type OmpMemoryRecord = Readonly<{
  id: string;
  kind: string;
  content: string;
  createdAt: string;
}>;

export function projectOmpMemory(input: {
  evidence: OmpAdminCapabilityEvidence;
  candidateOwner: Partial<OmpAdminOwner> | null | undefined;
  expectedOwner: OmpAdminOwner;
  record: OmpMemoryRecord;
  requestId: string;
  occurredAt?: string;
}): OmpAdminProjection<OmpMemoryRecord> {
  return projectOmpAdminPayload({
    ...input,
    capability: "memory",
    payload: input.record,
    operation: "memory.record.project",
  });
}

export type OmpAdvisorResult = Readonly<{
  id: string;
  title: string;
  recommendation: string;
  severity?: string;
}>;

export function projectOmpAdvisor(input: {
  evidence: OmpAdminCapabilityEvidence;
  candidateOwner: Partial<OmpAdminOwner> | null | undefined;
  expectedOwner: OmpAdminOwner;
  result: OmpAdvisorResult;
  requestId: string;
  occurredAt?: string;
}): OmpAdminProjection<OmpAdvisorResult> {
  return projectOmpAdminPayload({
    ...input,
    capability: "advisor",
    payload: input.result,
    operation: "advisor.result.project",
  });
}

export function projectOmpMentalModel(input: {
  evidence: OmpAdminCapabilityEvidence;
  candidateOwner: Partial<OmpAdminOwner> | null | undefined;
  expectedOwner: OmpAdminOwner;
  record: OmpMemoryRecord;
  requestId: string;
  occurredAt?: string;
}): OmpAdminProjection<OmpMemoryRecord> {
  return projectOmpAdminPayload({
    ...input,
    capability: "mental-models",
    payload: input.record,
    operation: "mental-models.record.project",
  });
}

/**
 * 12.2 Memory / Mental Models / Advisor 独立域边界。
 * 三个域各自拥有独立的 storage（profile-scoped）、queue（有序写入）、
 * sync（native 同步状态投影）、diagnose（诊断投影）与 clear（清除 + 审计）。
 * 所有载荷先经 redactOmpAdminValue 脱敏，secret 不落 projection；
 * conversationId 恒为 null，绝不污染 Conversation timeline。
 */

export type OmpAdminMemoryDomain = "memory" | "mental-models" | "advisor";

export type OmpAdminDomainSyncState =
  | "idle"
  | "queued"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export type OmpAdminDomainRecord = Readonly<{
  id: string;
  payload: unknown;
  redactedPaths: readonly string[];
  enqueuedAt: string;
}>;

export type OmpAdminQueuedWrite = Readonly<{
  seq: number;
  recordId: string;
  payload: unknown;
  redactedPaths: readonly string[];
  enqueuedAt: string;
}>;

export type OmpAdminDomainAuditEntry = Readonly<{
  operation: string;
  domain: OmpAdminMemoryDomain;
  profileId: string;
  actorId: string;
  occurredAt: string;
  detail: string | null;
}>;

export type OmpAdminDomainStore = Readonly<{
  domain: OmpAdminMemoryDomain;
  profileId: string;
  records: readonly OmpAdminDomainRecord[];
  queue: readonly OmpAdminQueuedWrite[];
  nextSeq: number;
  sync: OmpAdminDomainSyncState;
  lastError: string | null;
  auditTrail: readonly OmpAdminDomainAuditEntry[];
  conversationId: null;
}>;

export function createOmpAdminDomainStore(
  domain: OmpAdminMemoryDomain,
  profileId: string,
): OmpAdminDomainStore {
  return Object.freeze({
    domain,
    profileId: profileId.trim(),
    records: Object.freeze([]),
    queue: Object.freeze([]),
    nextSeq: 1,
    sync: "idle",
    lastError: null,
    auditTrail: Object.freeze([]),
    conversationId: null,
  });
}

/** 写入排队：seq 单调递增保证顺序；载荷脱敏后才允许进入 queue。 */
export function enqueueOmpAdminDomainWrite(
  store: OmpAdminDomainStore,
  input: { id: string; payload: unknown; enqueuedAt?: string },
): OmpAdminDomainStore {
  const redaction = redactOmpAdminValue(input.payload);
  return Object.freeze({
    ...store,
    queue: Object.freeze([
      ...store.queue,
      Object.freeze({
        seq: store.nextSeq,
        recordId: input.id,
        payload: redaction.value,
        redactedPaths: redaction.redactedPaths,
        enqueuedAt: input.enqueuedAt ?? new Date(0).toISOString(),
      }),
    ]),
    nextSeq: store.nextSeq + 1,
    sync: "queued",
  });
}

/** flush 按 seq 顺序落 records（按 id upsert），随后等待 native ack。 */
export function flushOmpAdminDomainQueue(store: OmpAdminDomainStore): OmpAdminDomainStore {
  if (store.queue.length === 0) {
    return store;
  }
  const ordered = [...store.queue].sort((a, b) => a.seq - b.seq);
  const records = [...store.records];
  for (const entry of ordered) {
    const record = Object.freeze({
      id: entry.recordId,
      payload: entry.payload,
      redactedPaths: entry.redactedPaths,
      enqueuedAt: entry.enqueuedAt,
    });
    const existingIndex = records.findIndex((item) => item.id === entry.recordId);
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }
  }
  return Object.freeze({
    ...store,
    records: Object.freeze(records),
    queue: Object.freeze([]),
    sync: "syncing",
  });
}

/** native 同步结果投影：synced/conflict/failed 显式区分，失败保留 lastError。 */
export function projectOmpAdminDomainSync(
  store: OmpAdminDomainStore,
  event: { outcome: "synced" | "conflict" | "failed"; detail?: string },
): OmpAdminDomainStore {
  return Object.freeze({
    ...store,
    sync: event.outcome,
    lastError:
      event.outcome === "failed" || event.outcome === "conflict"
        ? (typeof event.detail === "string" && event.detail.trim() ? event.detail : "unknown")
        : null,
  });
}

export type OmpAdminDomainDiagnosis = Readonly<{
  domain: OmpAdminMemoryDomain;
  profileId: string;
  recordCount: number;
  queueDepth: number;
  sync: OmpAdminDomainSyncState;
  issues: readonly string[];
}>;

/** 诊断投影：只读汇总，无副作用。 */
export function diagnoseOmpAdminDomainStore(
  store: OmpAdminDomainStore,
): OmpAdminDomainDiagnosis {
  const issues: string[] = [];
  if (store.queue.length > 0) {
    issues.push("pending-writes-not-flushed");
  }
  if (store.sync === "failed") {
    issues.push(`sync-failed:${store.lastError ?? "unknown"}`);
  }
  if (store.sync === "conflict") {
    issues.push("native-conflict-unresolved");
  }
  return Object.freeze({
    domain: store.domain,
    profileId: store.profileId,
    recordCount: store.records.length,
    queueDepth: store.queue.length,
    sync: store.sync,
    issues: Object.freeze(issues),
  });
}

/** clear 语义：清空 records 与 queue，保留并追加审计记录。 */
export function clearOmpAdminDomainStore(
  store: OmpAdminDomainStore,
  options: { actorId: string; occurredAt?: string; detail?: string },
): OmpAdminDomainStore {
  return Object.freeze({
    ...store,
    records: Object.freeze([]),
    queue: Object.freeze([]),
    sync: "idle",
    lastError: null,
    auditTrail: Object.freeze([
      ...store.auditTrail,
      Object.freeze({
        operation: `${store.domain}.clear`,
        domain: store.domain,
        profileId: store.profileId,
        actorId: options.actorId,
        occurredAt: options.occurredAt ?? new Date(0).toISOString(),
        detail:
          typeof options.detail === "string" && options.detail.trim()
            ? options.detail
            : null,
      }),
    ]),
  });
}

export const OMP_ADMIN_DOMAIN_STORAGE_PREFIX = "ompAdminDomain";

export function ompAdminDomainStorageKey(
  domain: OmpAdminMemoryDomain,
  profileId: string,
): string {
  return `${OMP_ADMIN_DOMAIN_STORAGE_PREFIX}:${domain}:${profileId.trim()}`;
}

const ADMIN_MEMORY_DOMAINS: Readonly<Record<string, OmpAdminMemoryDomain>> = {
  memory: "memory",
  "mental-models": "mental-models",
  advisor: "advisor",
};

function normalizePersistedDomainStore(value: unknown): OmpAdminDomainStore | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const domain =
    typeof record.domain === "string" ? ADMIN_MEMORY_DOMAINS[record.domain] : undefined;
  if (
    !domain ||
    typeof record.profileId !== "string" ||
    !record.profileId.trim() ||
    !Array.isArray(record.records) ||
    !Array.isArray(record.queue) ||
    typeof record.nextSeq !== "number" ||
    typeof record.sync !== "string" ||
    !Array.isArray(record.auditTrail)
  ) {
    return null;
  }
  return Object.freeze({
    ...(record as unknown as OmpAdminDomainStore),
    domain,
    records: Object.freeze(record.records as readonly OmpAdminDomainRecord[]),
    queue: Object.freeze(record.queue as readonly OmpAdminQueuedWrite[]),
    auditTrail: Object.freeze(record.auditTrail as readonly OmpAdminDomainAuditEntry[]),
    conversationId: null,
  });
}

/** 持久化遵循 ompProviderProfile 模式：profile-scoped key + immediate write。 */
export function persistOmpAdminDomainStore(store: OmpAdminDomainStore): void {
  writeClientStoreValue(
    "app",
    ompAdminDomainStorageKey(store.domain, store.profileId),
    store,
    { immediate: true },
  );
}

/** 读取 fail-closed：domain/profile 不匹配或载荷损坏一律返回 null。 */
export function readOmpAdminDomainStore(
  domain: OmpAdminMemoryDomain,
  profileId: string,
): OmpAdminDomainStore | null {
  const store = normalizePersistedDomainStore(
    getClientStoreSync<unknown>("app", ompAdminDomainStorageKey(domain, profileId)),
  );
  if (!store || store.domain !== domain || store.profileId !== profileId.trim()) {
    return null;
  }
  return store;
}
