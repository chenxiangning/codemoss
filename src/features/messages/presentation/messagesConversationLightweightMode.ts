import {
  TIMELINE_ADAPTIVE_RENDERING_ENABLED,
  type TimelineRenderWeightSummary,
} from "../timeline/virtualization/messagesTimelineVirtualization";

export const CONVERSATION_LIGHTWEIGHT_SUGGEST_RENDER_WEIGHT = 180;
export const CONVERSATION_LIGHTWEIGHT_SUGGEST_HEAVY_ROWS = 4;
export const CONVERSATION_OVERSIZED_HISTORY_RENDER_WEIGHT = 520;
export const CONVERSATION_OVERSIZED_HISTORY_ROWS = 260;
export const CONVERSATION_RENDER_MODE_KEY_LIMIT = 96;

export type ConversationLightweightPolicy = {
  suggested: boolean;
  oversized: boolean;
};

export type ConversationLightweightModeState = {
  active: boolean;
  reason: "manual" | "oversized" | "inactive";
};

/**
 * 统一幕布（unify-conversation-canvas）：对话级轻量「摘要墙」已下线。
 * 仍导出阈值常量供诊断/历史测试引用；policy 恒不建议、mode 恒 inactive。
 * 列表虚拟化与流式尾窗均已关闭（性能换丝滑）；块级「显示详情」仍保留。
 */
export function resolveConversationLightweightPolicy(
  _summary: Pick<TimelineRenderWeightSummary, "rowCount" | "renderWeight" | "heavyRowCount">,
): ConversationLightweightPolicy {
  void _summary;
  void TIMELINE_ADAPTIVE_RENDERING_ENABLED;
  return { suggested: false, oversized: false };
}

export function resolveConversationLightweightModeState(_input: {
  policy: ConversationLightweightPolicy;
  manualEnabled: boolean;
  detailHydrationRequested: boolean;
}): ConversationLightweightModeState {
  void _input;
  return { active: false, reason: "inactive" };
}

export function addBoundedConversationRenderModeKey(
  previous: Set<string>,
  key: string,
  limit = CONVERSATION_RENDER_MODE_KEY_LIMIT,
): Set<string> {
  if (!key || previous.has(key)) {
    return previous;
  }
  const next = new Set(previous);
  const normalizedLimit = Math.max(1, Math.floor(limit));
  while (next.size >= normalizedLimit) {
    const oldestKey = next.values().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    next.delete(oldestKey);
  }
  next.add(key);
  return next;
}
