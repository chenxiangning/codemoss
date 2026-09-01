export type OmpExternalIntegration = "mcp" | "browser" | "computer" | "ssh" | "search";

export type OmpExternalCapabilityState =
  | "supported"
  | "compat-input"
  | "unsupported"
  | "unknown";

export type OmpExternalOperation =
  | "mcp.add"
  | "mcp.list"
  | "mcp.remove"
  | "mcp.test"
  | "mcp.reauth"
  | "mcp.enable"
  | "mcp.disable"
  | "mcp.reconnect"
  | "mcp.resources"
  | "mcp.prompts"
  | "browser.relay"
  | "computer.toggle"
  | "ssh.add"
  | "ssh.list"
  | "ssh.remove"
  | "search.query";

export type OmpGrant = Readonly<{
  workspaceId: string;
  userId: string;
  granted: boolean;
}>;

export type OmpExternalCapabilityRecord = Readonly<{
  capability: OmpExternalIntegration;
  state: OmpExternalCapabilityState;
  enabled: boolean;
  requiresApproval: boolean;
  workspaceGrant: OmpGrant | null;
  userGrant: OmpGrant | null;
  lifecycle: "disabled" | "configured" | "connected" | "disconnected" | "reauth-required";
}>;

export type OmpExternalCapabilityRecords = Readonly<
  Record<OmpExternalIntegration, OmpExternalCapabilityRecord>
>;

export type OmpExternalAudit = Readonly<{
  source: "omp-native-rpc";
  capability: OmpExternalIntegration | null;
  operation: string;
  workspaceId: string | null;
  userId: string | null;
  redacted: true;
  secretFieldsOmitted: readonly string[];
}>;

export type OmpExternalDecision = Readonly<{
  outcome: "allowed" | "blocked" | "unsupported" | "unknown";
  reason:
    | "allowed"
    | "capability-disabled"
    | "missing-workspace-grant"
    | "missing-user-grant"
    | "approval-required"
    | "unsupported-capability"
    | "unverified-capability"
    | "unknown-operation";
  capability: OmpExternalIntegration | null;
  operation: string;
  audit: OmpExternalAudit;
}>;

const ALL_INTEGRATIONS: readonly OmpExternalIntegration[] = [
  "mcp",
  "browser",
  "computer",
  "ssh",
  "search",
];

const DEFAULT_RECORD = (capability: OmpExternalIntegration): OmpExternalCapabilityRecord =>
  Object.freeze({
    capability,
    // OMP Native RPC evidence does not prove these host/network integrations.
    state: "unknown" as const,
    enabled: false,
    requiresApproval: true,
    workspaceGrant: null,
    userGrant: null,
    lifecycle: "disabled" as const,
  });

export const DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS: OmpExternalCapabilityRecords = Object.freeze(
  Object.fromEntries(ALL_INTEGRATIONS.map((capability) => [capability, DEFAULT_RECORD(capability)])) as Record<
    OmpExternalIntegration,
    OmpExternalCapabilityRecord
  >,
);

const OPERATION_CAPABILITY: Readonly<Record<OmpExternalOperation, OmpExternalIntegration>> =
  Object.freeze({
    "mcp.add": "mcp",
    "mcp.list": "mcp",
    "mcp.remove": "mcp",
    "mcp.test": "mcp",
    "mcp.reauth": "mcp",
    "mcp.enable": "mcp",
    "mcp.disable": "mcp",
    "mcp.reconnect": "mcp",
    "mcp.resources": "mcp",
    "mcp.prompts": "mcp",
    "browser.relay": "browser",
    "computer.toggle": "computer",
    "ssh.add": "ssh",
    "ssh.list": "ssh",
    "ssh.remove": "ssh",
    "search.query": "search",
  });

const SECRET_KEY = /(?:token|secret|password|private.?key|authorization|api.?key|credential)/i;

export function capabilityForOmpExternalOperation(
  operation: string,
): OmpExternalIntegration | null {
  return OPERATION_CAPABILITY[operation as OmpExternalOperation] ?? null;
}

export function grantOmpExternalCapability(
  records: OmpExternalCapabilityRecords,
  capability: OmpExternalIntegration,
  grant: OmpGrant,
): OmpExternalCapabilityRecords {
  const current = records[capability];
  return Object.freeze({
    ...records,
    [capability]: Object.freeze({
      ...current,
      workspaceGrant:
        grant.granted && grant.workspaceId.length > 0 ? grant : current.workspaceGrant,
      userGrant: grant.granted && grant.userId.length > 0 ? grant : current.userGrant,
    }),
  });
}

export function setOmpExternalCapabilityState(
  records: OmpExternalCapabilityRecords,
  capability: OmpExternalIntegration,
  state: OmpExternalCapabilityState,
): OmpExternalCapabilityRecords {
  const current = records[capability];
  return Object.freeze({
    ...records,
    [capability]: Object.freeze({
      ...current,
      state,
      // State observation never grants permission or enables an integration.
      enabled: false,
      lifecycle: "disabled",
    }),
  });
}

export function enableOmpExternalCapability(
  records: OmpExternalCapabilityRecords,
  capability: OmpExternalIntegration,
  options: { requiresApproval?: boolean } = {},
): OmpExternalCapabilityRecords {
  const current = records[capability];
  return Object.freeze({
    ...records,
    [capability]: Object.freeze({
      ...current,
      enabled: true,
      requiresApproval: options.requiresApproval ?? current.requiresApproval,
      lifecycle: "configured",
    }),
  });
}

export type OmpExternalLifecycle = OmpExternalCapabilityRecord["lifecycle"];

/** Applies an observed OMP lifecycle event without granting or enabling the capability. */
export function applyOmpExternalLifecycleObservation(
  records: OmpExternalCapabilityRecords,
  capability: OmpExternalIntegration,
  lifecycle: OmpExternalLifecycle,
): OmpExternalCapabilityRecords {
  const current = records[capability];
  return Object.freeze({
    ...records,
    [capability]: Object.freeze({ ...current, lifecycle }),
  });
}

export function redactOmpExternalInput(
  input: Readonly<Record<string, unknown>>,
): { value: Record<string, unknown>; secretFieldsOmitted: string[] } {
  const secretFieldsOmitted: string[] = [];
  const value: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(input)) {
    if (SECRET_KEY.test(key)) {
      secretFieldsOmitted.push(key);
      value[key] = "[redacted]";
    } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const nested = redactOmpExternalInput(entry as Record<string, unknown>);
      value[key] = nested.value;
      secretFieldsOmitted.push(...nested.secretFieldsOmitted.map((field) => `${key}.${field}`));
    } else {
      value[key] = entry;
    }
  }
  return { value, secretFieldsOmitted };
}

function buildAudit(
  capability: OmpExternalIntegration | null,
  operation: string,
  workspaceId: string | null,
  userId: string | null,
  secretFieldsOmitted: readonly string[] = [],
): OmpExternalAudit {
  return {
    source: "omp-native-rpc",
    capability,
    operation,
    workspaceId,
    userId,
    redacted: true,
    secretFieldsOmitted,
  };
}

/**
 * Pure policy boundary. It only returns a decision; it never invokes host, browser,
 * filesystem, SSH, or network transports. Those transports require separate OMP evidence.
 */
export function evaluateOmpExternalOperation(
  records: OmpExternalCapabilityRecords,
  operation: string,
  context: { workspaceId?: string; userId?: string } = {},
): OmpExternalDecision {
  const capability = capabilityForOmpExternalOperation(operation);
  if (!capability) {
    return {
      outcome: "unknown",
      reason: "unknown-operation",
      capability: null,
      operation,
      audit: buildAudit(null, operation, context.workspaceId ?? null, context.userId ?? null),
    };
  }

  const typedOperation = operation as OmpExternalOperation;
  const record = records[capability];
  if (record.state === "unsupported") {
    return {
      outcome: "unsupported",
      reason: "unsupported-capability",
      capability,
      operation: typedOperation,
      audit: buildAudit(capability, typedOperation, context.workspaceId ?? null, context.userId ?? null),
    };
  }
  if (record.state !== "supported") {
    return {
      outcome: "unknown",
      reason: "unverified-capability",
      capability,
      operation: typedOperation,
      audit: buildAudit(capability, typedOperation, context.workspaceId ?? null, context.userId ?? null),
    };
  }
  if (!record.enabled) {
    return {
      outcome: "blocked",
      reason: "capability-disabled",
      capability,
      operation: typedOperation,
      audit: buildAudit(capability, typedOperation, context.workspaceId ?? null, context.userId ?? null),
    };
  }
  if (!record.workspaceGrant || record.workspaceGrant.workspaceId !== context.workspaceId) {
    return {
      outcome: "blocked",
      reason: "missing-workspace-grant",
      capability,
      operation: typedOperation,
      audit: buildAudit(capability, typedOperation, context.workspaceId ?? null, context.userId ?? null),
    };
  }
  if (!record.userGrant || record.userGrant.userId !== context.userId) {
    return {
      outcome: "blocked",
      reason: "missing-user-grant",
      capability,
      operation: typedOperation,
      audit: buildAudit(capability, typedOperation, context.workspaceId ?? null, context.userId ?? null),
    };
  }
  if (record.requiresApproval) {
    return {
      outcome: "blocked",
      reason: "approval-required",
      capability,
      operation: typedOperation,
      audit: buildAudit(capability, typedOperation, context.workspaceId ?? null, context.userId ?? null),
    };
  }
  return {
    outcome: "allowed",
    reason: "allowed",
    capability,
    operation: typedOperation,
    audit: buildAudit(capability, typedOperation, context.workspaceId ?? null, context.userId ?? null),
  };
}
