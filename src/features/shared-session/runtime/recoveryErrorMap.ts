/**
 * Shared recovery 错误前缀 → 可操作下一步（供 StatusBar / toast 映射 i18n key 后缀）。
 * 保留 raw message 供技术详情；不依赖完整 JSON 结构化错误一期。
 */

export type RecoveryErrorKind =
  | "recovery-active"
  | "recovery-active-requires-stop"
  | "recovery-owner-ambiguous"
  | "recovery-owner-missing"
  | "recovery-owner-mismatch"
  | "empty-context-handoff"
  | "other";

/** 触发恢复动作的来源；文案按动作分流，避免「换连接」却提示「自动处理」。 */
export type RecoveryActionKind =
  | "auto"
  | "rebuild"
  | "probe"
  | "stop"
  | "skip";

export function recoveryErrorRaw(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error ?? "");
}

export function classifyRecoveryError(error: unknown): {
  kind: RecoveryErrorKind;
  raw: string;
} {
  const raw = recoveryErrorRaw(error);
  const lower = raw.toLowerCase();
  if (
    lower.startsWith("empty-context-handoff:") ||
    lower.includes("empty-context-handoff:")
  ) {
    return { kind: "empty-context-handoff", raw };
  }
  if (
    lower.startsWith("recovery-active-requires-stop:") ||
    lower.includes("recovery-active-requires-stop:")
  ) {
    return { kind: "recovery-active-requires-stop", raw };
  }
  if (
    lower.startsWith("recovery-active:") ||
    lower.includes("still owned by runtime")
  ) {
    return { kind: "recovery-active", raw };
  }
  if (
    lower.startsWith("recovery-owner-ambiguous:") ||
    lower.includes("recovery-owner-ambiguous:")
  ) {
    return { kind: "recovery-owner-ambiguous", raw };
  }
  if (
    lower.startsWith("recovery-owner-missing:") ||
    lower.includes("recovery-owner-missing:")
  ) {
    return { kind: "recovery-owner-missing", raw };
  }
  // 例如：binding owner mismatch: key 'squad:…' does not match durable owner 'claude:default'
  if (
    lower.includes("owner mismatch") ||
    lower.includes("does not match durable owner")
  ) {
    return { kind: "recovery-owner-mismatch", raw };
  }
  return { kind: "other", raw };
}

/**
 * 从 owner-mismatch 错误中解析 durable binding key，供 rebuild 重试。
 * 例：`… does not match durable owner 'claude:default'` → `claude:default`
 */
export function extractDurableOwnerFromMismatch(error: unknown): string | null {
  const raw = recoveryErrorRaw(error);
  const match = raw.match(
    /does not match durable owner ['"]([^'"]+)['"]/i,
  );
  const durable = match?.[1]?.trim();
  return durable && durable.length > 0 ? durable : null;
}

/**
 * Squad worker key：`squad:{runId}:{nodeId}:{engine}:{provider…}`。
 * 返回末尾 durable base key（engine:provider…）；无法解析则 null。
 */
export function squadBaseBindingKey(bindingKey: string): string | null {
  const trimmed = bindingKey.trim();
  if (!trimmed.startsWith("squad:")) {
    return null;
  }
  const parts = trimmed.split(":");
  // squad + run + node + engine + provider… → 至少 5 段
  if (parts.length < 5) {
    return null;
  }
  const base = parts.slice(3).join(":").trim();
  return base.length > 0 ? base : null;
}

/** begin / prepare 路径：明确 target 不可用且可安全视为无 ambiguous durable 时使用。 */
export function isExplicitTargetUnavailableMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.startsWith("target-unavailable:") ||
    normalized.startsWith("target-provider-rejected:") ||
    normalized.includes("provider removed") ||
    normalized.includes("missing-provider") ||
    normalized.includes("missing-runtime")
  );
}
