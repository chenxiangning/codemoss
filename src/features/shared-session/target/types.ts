/**
 * Execution Target 类型（Wave 4 / B.1）。
 *
 * 与 Rust `TurnExecutionSnapshot`（`shared_event_log::canonical::types`）对齐。
 * `ExecutionTarget` 是可变选择；`TurnExecutionSnapshot` 在 Turn Attempt 创建时
 * 固化，之后不可变（上游设计 §5.1/§5.2）。
 */

import type { EngineType } from "../../../types/engine";
import { isEngineExecutionEnabled } from "../../../utils/engineExecutionPolicy";
import {
  isSharedSessionSupportedEngine,
  type SharedSessionSupportedEngine,
} from "../utils/sharedSessionEngines";
import {
  LOCAL_PROVIDER_LABEL,
  LOCAL_PROVIDER_SOURCE,
} from "../../../utils/turnBadge";
export { resolveSnapshotProviderLabel } from "../../../utils/turnBadge";

export type ReasoningSelection = {
  effort: string;
};

/** Provider catalog / Picker 来源。`disk` 只属于可变选择域。 */
export type ProviderSelectionSource = "disk" | "managed";

/** Foundation canonical snapshot 来源。Canonical Fact 禁止出现 `disk`。 */
export type CanonicalProviderProfileSource = "local" | "managed";

export function toCanonicalProviderProfileSource(
  selectionSource: ProviderSelectionSource | null | undefined,
  isLocalProvider: boolean,
): CanonicalProviderProfileSource | null {
  if (selectionSource === "managed") {
    return "managed";
  }
  if (selectionSource === LOCAL_PROVIDER_SOURCE || isLocalProvider) {
    return "local";
  }
  return null;
}

/** “下一 Turn 要发给谁”的可变选择。发送时必须固化为 Snapshot。 */
export type ExecutionTarget = {
  engine: EngineType;
  providerProfileId?: string | null;
  /** Picker/catalog identity；`model` 始终保留 CLI runtime value。 */
  modelCatalogEntryId?: string | null;
  model?: string | null;
  reasoning?: ReasoningSelection | null;
  /** Picker 当次选择的可读身份；send boundary 会冻结进 Turn snapshot。 */
  providerProfileNameSnapshot?: string | null;
  providerProfileSource?: ProviderSelectionSource | null;
};

export type ResolvedExecutionTarget = Omit<ExecutionTarget, "engine"> & {
  engine: SharedSessionSupportedEngine;
  modelCatalogEntryId: string;
  model: string;
  providerProfileNameSnapshot: string;
  providerProfileSource: ProviderSelectionSource;
};

function optionalTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeProviderSelectionSource(
  value: unknown,
): ProviderSelectionSource | null {
  return value === "disk" || value === "managed" ? value : null;
}

/**
 * Loader boundary：保留 legacy partial target 的缺失字段，不把未知身份伪装成
 * local/default。是否允许发送由 `isResolvedExecutionTarget` 单独判定。
 */
export function normalizePersistedExecutionTarget(
  value: unknown,
): ExecutionTarget | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const target = value as Record<string, unknown>;
  const engine = optionalTrimmedString(target.engine)?.toLowerCase() as
    | EngineType
    | undefined;
  if (!isSharedSessionSupportedEngine(engine)) {
    return null;
  }
  const reasoning =
    target.reasoning && typeof target.reasoning === "object"
      ? optionalTrimmedString(
          (target.reasoning as Record<string, unknown>).effort,
        )
      : null;
  return {
    engine,
    providerProfileId: optionalTrimmedString(target.providerProfileId),
    modelCatalogEntryId: optionalTrimmedString(target.modelCatalogEntryId),
    model: optionalTrimmedString(target.model),
    reasoning: reasoning ? { effort: reasoning } : null,
    providerProfileNameSnapshot: optionalTrimmedString(
      target.providerProfileNameSnapshot,
    ),
    providerProfileSource: normalizeProviderSelectionSource(
      target.providerProfileSource,
    ),
  };
}

/**
 * Atomic / create-session picker 的可执行选择：字段完整即可，不要求 Shared 引擎集合。
 * PI 等「仅 Native、不进 Shared」的引擎走此校验；Shared 另用 isResolvedExecutionTarget。
 *
 * `providerProfileId = null` 只有在 selection source 明确为 `disk` 时才表示
 * intentional local/default；legacy engine-only target 缺少该证据，必须 fail closed。
 */
export function isAtomicExecutionTarget(
  target: ExecutionTarget | null | undefined,
): target is ExecutionTarget & {
  modelCatalogEntryId: string;
  model: string;
  providerProfileNameSnapshot: string;
  providerProfileSource: ProviderSelectionSource;
} {
  if (!target || !isEngineExecutionEnabled(target.engine)) {
    return false;
  }
  const providerProfileId = target.providerProfileId?.trim() || null;
  const modelCatalogEntryId = target.modelCatalogEntryId?.trim() || "";
  const runtimeModel = target.model?.trim() || "";
  const providerName = target.providerProfileNameSnapshot?.trim() || "";
  if (!modelCatalogEntryId || !runtimeModel || !providerName) {
    return false;
  }
  return providerProfileId
    ? target.providerProfileSource === "managed"
    : target.providerProfileSource === "disk";
}

/**
 * Shared Session V2 Turn 的 executable contract（Shared 引擎子集 + Atomic 字段完整）。
 */
export function isResolvedExecutionTarget(
  target: ExecutionTarget | null | undefined,
): target is ResolvedExecutionTarget {
  return (
    isAtomicExecutionTarget(target) &&
    isSharedSessionSupportedEngine(target.engine)
  );
}

function selectedTargetFromBackendResponse(response: unknown): unknown {
  if (!response || typeof response !== "object") {
    return null;
  }
  const root = response as Record<string, unknown>;
  const result =
    root.result && typeof root.result === "object"
      ? (root.result as Record<string, unknown>)
      : root;
  const thread =
    result.thread && typeof result.thread === "object"
      ? (result.thread as Record<string, unknown>)
      : null;
  return thread?.selectedTarget ?? result.selectedTarget ?? null;
}

function executionTargetIdentity(target: ResolvedExecutionTarget): string {
  return JSON.stringify([
    target.engine,
    target.providerProfileId?.trim() || null,
    target.modelCatalogEntryId,
    target.model,
    target.reasoning?.effort ?? null,
    target.providerProfileNameSnapshot,
    target.providerProfileSource,
  ]);
}

/**
 * create / Picker 的 backend-authoritative publish gate。
 *
 * 只发布后端回传并规范化后的完整 Target；缺失或与请求不一致时 fail closed，
 * 禁止用 frontend request 值乐观填充。
 */
export function resolveBackendAuthoritativeExecutionTarget(
  response: unknown,
  requestedTarget: ExecutionTarget,
): ResolvedExecutionTarget {
  const normalizedRequestedTarget =
    normalizePersistedExecutionTarget(requestedTarget);
  const normalizedBackendTarget = normalizePersistedExecutionTarget(
    selectedTargetFromBackendResponse(response),
  );
  if (
    !isResolvedExecutionTarget(normalizedRequestedTarget) ||
    !isResolvedExecutionTarget(normalizedBackendTarget)
  ) {
    throw new Error(
      "Backend returned a malformed Shared Execution Target.",
    );
  }
  if (
    executionTargetIdentity(normalizedRequestedTarget) !==
    executionTargetIdentity(normalizedBackendTarget)
  ) {
    throw new Error(
      "Backend returned a mismatched Shared Execution Target.",
    );
  }
  return normalizedBackendTarget;
}

/** 一次 Turn Attempt 创建时固化的不可变目标快照。 */
export type TurnExecutionSnapshot = {
  engine: EngineType;
  providerProfileId?: string | null;
  modelCatalogEntryId?: string | null;
  model?: string | null;
  reasoning?: ReasoningSelection | null;
  providerProfileNameSnapshot?: string | null;
  providerProfileSource?: CanonicalProviderProfileSource | null;
  runtimeCapabilityFingerprint?: string | null;
};

/** Binding Key = Engine + ProviderProfile；Model 不进 Key（上游设计 §5.4）。 */
export function bindingKeyOf(
  target: Pick<ExecutionTarget, "engine" | "providerProfileId">,
): string {
  const provider = target.providerProfileId?.trim();
  return `${target.engine}:${provider ? provider : "default"}`;
}

/** 把可变选择固化为不可变快照（创建后不得修改）。 */
export function freezeTurnSnapshot(
  target: ExecutionTarget,
  providerMeta?: {
    providerProfileNameSnapshot?: string | null;
    providerProfileSource?: ProviderSelectionSource | null;
    runtimeCapabilityFingerprint?: string | null;
  },
): TurnExecutionSnapshot {
  const providerProfileId = target.providerProfileId?.trim() || null;
  const isLocalProvider = providerProfileId === null;
  const selectionSource =
    providerMeta?.providerProfileSource ?? target.providerProfileSource ?? null;
  const canonicalSource = toCanonicalProviderProfileSource(
    selectionSource,
    isLocalProvider,
  );
  const snapshot: TurnExecutionSnapshot = {
    engine: target.engine,
    providerProfileId,
    modelCatalogEntryId: target.modelCatalogEntryId ?? null,
    model: target.model ?? null,
    reasoning: target.reasoning ? { ...target.reasoning } : null,
    providerProfileNameSnapshot:
      providerMeta?.providerProfileNameSnapshot ??
      target.providerProfileNameSnapshot ??
      (isLocalProvider ? LOCAL_PROVIDER_LABEL : null),
    providerProfileSource: canonicalSource,
    runtimeCapabilityFingerprint:
      providerMeta?.runtimeCapabilityFingerprint ?? null,
  };
  return Object.freeze(snapshot);
}
