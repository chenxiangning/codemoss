export type OmpCapabilityState = "supported" | "unknown" | "unsupported" | "degraded";

export type OmpCapability =
  | "provider.catalog"
  | "profile.auth"
  | "tool.read"
  | "tool.write"
  | "tool.edit"
  | "tool.shell"
  | "tool.lsp"
  | "tool.notebook"
  | "attachment.image"
  | "mcp"
  | "browser"
  | "computer"
  | "ssh"
  | "search";

export type OmpCapabilityRecord = Readonly<{
  state: OmpCapabilityState;
  enabled: boolean;
  requiresApproval: boolean;
}>;

export type OmpCapabilityMatrix = Readonly<Record<OmpCapability, OmpCapabilityRecord>>;

const DEFAULT_CAPABILITY_RECORD: OmpCapabilityRecord = Object.freeze({
  state: "unknown",
  enabled: false,
  requiresApproval: true,
});

// ACP initialize 已证实 image prompt 支持（evidence/omp-cli-surface.txt:
// agentCapabilities.promptCapabilities.image=true）；state 记录协议事实，
// enabled 仍默认关闭，等待显式 grant。
const IMAGE_ATTACHMENT_DEFAULT_RECORD: OmpCapabilityRecord = Object.freeze({
  state: "supported",
  enabled: false,
  requiresApproval: false,
});

export const DEFAULT_OMP_CAPABILITY_MATRIX: OmpCapabilityMatrix = Object.freeze({
  "provider.catalog": DEFAULT_CAPABILITY_RECORD,
  "profile.auth": DEFAULT_CAPABILITY_RECORD,
  "tool.read": DEFAULT_CAPABILITY_RECORD,
  "tool.write": DEFAULT_CAPABILITY_RECORD,
  "tool.edit": DEFAULT_CAPABILITY_RECORD,
  "tool.shell": DEFAULT_CAPABILITY_RECORD,
  "tool.lsp": DEFAULT_CAPABILITY_RECORD,
  "tool.notebook": DEFAULT_CAPABILITY_RECORD,
  "attachment.image": IMAGE_ATTACHMENT_DEFAULT_RECORD,
  mcp: DEFAULT_CAPABILITY_RECORD,
  browser: DEFAULT_CAPABILITY_RECORD,
  computer: DEFAULT_CAPABILITY_RECORD,
  ssh: DEFAULT_CAPABILITY_RECORD,
  search: DEFAULT_CAPABILITY_RECORD,
});

/**
 * 每项 capability 的协议证据说明（design Decision 6：state 必须可追溯到 evidence）。
 * 未被协议证实的能力保持 unknown，禁止凭 help 文本臆测支持。
 */
export const OMP_CAPABILITY_EVIDENCE: Readonly<Record<OmpCapability, string>> = Object.freeze({
  "provider.catalog": "no catalog surface observed in ACP/RPC probes",
  "profile.auth": "no auth/profile surface observed in ACP/RPC probes",
  "tool.read": "ACP initialize advertises no per-tool read capability; agent owns reads internally",
  "tool.write": "ACP initialize advertises no per-tool write capability",
  "tool.edit": "ACP initialize advertises no per-tool edit capability",
  "tool.shell": "no shell/bash capability observed in ACP/RPC probes",
  "tool.lsp": "no LSP capability observed in ACP/RPC probes",
  "tool.notebook": "no python/notebook capability observed in ACP/RPC probes",
  "attachment.image":
    "ACP initialize agentCapabilities.promptCapabilities.image=true (evidence/omp-cli-surface.txt)",
  mcp: "no MCP capability observed in ACP/RPC probes",
  browser: "no browser capability observed in ACP/RPC probes",
  computer: "no computer-use capability observed in ACP/RPC probes",
  ssh: "no SSH capability observed in ACP/RPC probes",
  search: "no search capability observed in ACP/RPC probes",
});

/**
 * 高风险 capability 的 grant 必须显式 approve（approval boundary，默认 fail-closed）。
 * read/image attachment 属于用户主动发起的低危面，其余工具与外部集成一律高危。
 */
export const OMP_CAPABILITY_APPROVAL_POLICY: Readonly<
  Record<OmpCapability, Readonly<{ highRisk: boolean }>>
> = Object.freeze({
  "provider.catalog": Object.freeze({ highRisk: false }),
  "profile.auth": Object.freeze({ highRisk: false }),
  "tool.read": Object.freeze({ highRisk: false }),
  "tool.write": Object.freeze({ highRisk: true }),
  "tool.edit": Object.freeze({ highRisk: true }),
  "tool.shell": Object.freeze({ highRisk: true }),
  "tool.lsp": Object.freeze({ highRisk: true }),
  "tool.notebook": Object.freeze({ highRisk: true }),
  "attachment.image": Object.freeze({ highRisk: false }),
  mcp: Object.freeze({ highRisk: true }),
  browser: Object.freeze({ highRisk: true }),
  computer: Object.freeze({ highRisk: true }),
  ssh: Object.freeze({ highRisk: true }),
  search: Object.freeze({ highRisk: true }),
});

export function canUseOmpCapability(
  matrix: OmpCapabilityMatrix,
  capability: OmpCapability,
): boolean {
  const record = matrix[capability];
  return record.state === "supported" && record.enabled;
}

/**
 * 记录观测到的协议事实（evidence → state）。观测只更新 state，绝不自动 enabled；
 * 任何执行仍需经过 requestOmpCapabilityGrant 的显式 grant。
 */
export function recordOmpCapabilityEvidence(
  matrix: OmpCapabilityMatrix,
  capability: OmpCapability,
  state: OmpCapabilityState,
): OmpCapabilityMatrix {
  return Object.freeze({
    ...matrix,
    [capability]: Object.freeze({
      state,
      enabled: false,
      requiresApproval: OMP_CAPABILITY_APPROVAL_POLICY[capability].highRisk,
    }),
  });
}

export type OmpCapabilityGrantDecision = Readonly<{
  capability: OmpCapability;
  granted: boolean;
  reason: "granted" | "approval-required" | "capability-not-proven";
  requiresApproval: boolean;
  matrix: OmpCapabilityMatrix;
}>;

/**
 * Grant 边界：协议未证实（state 非 supported）或高危能力缺少显式 approve 时
 * 一律 fail-closed，matrix 原样返回。
 */
export function requestOmpCapabilityGrant(
  matrix: OmpCapabilityMatrix,
  capability: OmpCapability,
  options: { approved?: boolean } = {},
): OmpCapabilityGrantDecision {
  const record = matrix[capability];
  const highRisk = OMP_CAPABILITY_APPROVAL_POLICY[capability].highRisk;
  if (record.state !== "supported") {
    return Object.freeze({
      capability,
      granted: false,
      reason: "capability-not-proven",
      requiresApproval: highRisk,
      matrix,
    });
  }
  if (highRisk && options.approved !== true) {
    return Object.freeze({
      capability,
      granted: false,
      reason: "approval-required",
      requiresApproval: true,
      matrix,
    });
  }
  return Object.freeze({
    capability,
    granted: true,
    reason: "granted",
    requiresApproval: highRisk,
    matrix: grantOmpCapability(matrix, capability, { requiresApproval: highRisk }),
  });
}

export function grantOmpCapability(
  matrix: OmpCapabilityMatrix,
  capability: OmpCapability,
  options: { requiresApproval?: boolean } = {},
): OmpCapabilityMatrix {
  return Object.freeze({
    ...matrix,
    [capability]: Object.freeze({
      state: "supported",
      enabled: true,
      requiresApproval: options.requiresApproval ?? true,
    }),
  });
}
