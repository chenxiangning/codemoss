import type {
  MemoryPickComposerMode,
  MemoryPickSessionPolicy,
} from "./memoryPickTypes";
import { ALWAYS_TOP_K } from "./memoryPickTypes";

export type EnterPickGateDecision =
  | { kind: "show-ui"; reason: "first-pick" | "pick-mode" | "always-mode" }
  | { kind: "skip"; reason: string };

/**
 * 决策表：是否进入挑选 UI / 静默 TopK / 跳过。
 * 不区分 Shared / Native。
 */
export function decideMemoryPickGateEntry(params: {
  composerMode: MemoryPickComposerMode;
  policy: Pick<MemoryPickSessionPolicy, "firstPickRequired" | "dismissed">;
  queryText: string;
  hasRetrievableText: boolean;
  isStreaming?: boolean;
  isQueuedFollowUp?: boolean;
  /** workspace 是否有记忆（未知时 true，允许 first-pick 尝试检索） */
  workspaceMayHaveMemories?: boolean;
}): EnterPickGateDecision {
  const {
    composerMode,
    policy,
    hasRetrievableText,
    isStreaming = false,
    isQueuedFollowUp = false,
    workspaceMayHaveMemories = true,
  } = params;

  if (isStreaming) {
    return { kind: "skip", reason: "streaming" };
  }
  if (isQueuedFollowUp) {
    return { kind: "skip", reason: "queued-follow-up" };
  }
  if (policy.dismissed) {
    return { kind: "skip", reason: "session-dismissed" };
  }
  if (!hasRetrievableText) {
    return { kind: "skip", reason: "no-query-text" };
  }

  // opt-in：Composer 未开启记忆参考时绝不进闸门（含取消历史 first-pick 强弹）
  if (composerMode === "off") {
    return { kind: "skip", reason: "mode-off" };
  }

  // 用户已开启 pick/always 时，新 session 首次仍可强制手勾一次
  if (policy.firstPickRequired && workspaceMayHaveMemories) {
    return { kind: "show-ui", reason: "first-pick" };
  }

  if (composerMode === "pick") {
    return { kind: "show-ui", reason: "pick-mode" };
  }

  // 一直开启：每轮仍要 matching + Top3 预览 UI（对齐 UX 图5/6，禁止静默直发）
  if (composerMode === "always") {
    return { kind: "show-ui", reason: "always-mode" };
  }

  return { kind: "skip", reason: "mode-off" };
}

export function createDefaultSessionPolicy(
  composerMode: MemoryPickComposerMode = "off",
  options?: { firstPickRequired?: boolean; alwaysPreferredCount?: number },
): MemoryPickSessionPolicy {
  const preferred = options?.alwaysPreferredCount;
  return {
    composerMode,
    firstPickRequired: options?.firstPickRequired ?? true,
    dismissed: false,
    alwaysPreferredCount:
      typeof preferred === "number" && Number.isFinite(preferred)
        ? Math.max(0, Math.floor(preferred))
        : ALWAYS_TOP_K,
  };
}

/** 一直开启预勾条数：上次确认数量，夹在 [0, candidateCount] */
export function resolveAlwaysPrefillCount(
  preferredCount: number | undefined,
  candidateCount: number,
  fallback: number = ALWAYS_TOP_K,
): number {
  const base =
    typeof preferredCount === "number" && Number.isFinite(preferredCount)
      ? Math.max(0, Math.floor(preferredCount))
      : fallback;
  return Math.min(base, Math.max(0, candidateCount));
}

export function applyFirstPickCompleted(
  policy: MemoryPickSessionPolicy,
): MemoryPickSessionPolicy {
  return { ...policy, firstPickRequired: false };
}

export function applySessionDismissed(
  policy: MemoryPickSessionPolicy,
): MemoryPickSessionPolicy {
  return {
    ...policy,
    dismissed: true,
    firstPickRequired: false,
  };
}

export function applyComposerMode(
  policy: MemoryPickSessionPolicy,
  composerMode: MemoryPickComposerMode,
): MemoryPickSessionPolicy {
  return {
    ...policy,
    composerMode,
    // 用户主动改模式时解除静音
    dismissed: false,
  };
}

export function selectTopKIds(
  candidates: ReadonlyArray<{ id: string; score: number; updatedAt?: number }>,
  topK: number,
): string[] {
  return [...candidates]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    })
    .slice(0, Math.max(0, topK))
    .map((entry) => entry.id);
}
