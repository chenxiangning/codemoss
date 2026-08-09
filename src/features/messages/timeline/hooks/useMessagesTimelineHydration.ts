import { useCallback, useMemo, useRef } from "react";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";
import {
  countHydratedHeavyTimelineRows,
  deriveTimelineRowHydrationStates,
  type TimelineRowHydrationState,
} from "../virtualization/messagesTimelineHydration";
import { TIMELINE_ADAPTIVE_RENDERING_ENABLED } from "../virtualization/messagesTimelineVirtualization";

/**
 * 行级 hydration 状态（轻量模式 / 诊断用）。
 * 2026-08 起时间线不再虚拟化：heavy 行一律 hydrated，不再依赖 visible-window / remeasure。
 */
export function useMessagesTimelineHydration(input: {
  activeLiveTimelineRowKeySet: Set<string>;
  conversationDetailHydrationRequested: boolean;
  effectiveConversationLightweightMode: boolean;
  isThinking: boolean;
  isWorking: boolean;
  pendingJumpRowKey: string | null;
  rendererOptionsKey: string;
  retainedScopeKey: string;
  /** 保留字段：静态轻量历史策略仍可上报；呈现层已不画 lightweight 摘要条。 */
  shouldDeferHeavyTimelineRows: boolean;
  timelineProjectionRows: TimelineProjectionRow[];
}) {
  const {
    activeLiveTimelineRowKeySet,
    conversationDetailHydrationRequested,
    effectiveConversationLightweightMode,
    isThinking,
    isWorking,
    pendingJumpRowKey,
    rendererOptionsKey,
    retainedScopeKey,
    shouldDeferHeavyTimelineRows,
    timelineProjectionRows,
  } = input;
  const retainedHydratedTimelineRowKeysRef = useRef<{
    scopeKey: string;
    rowKeys: Set<string>;
  }>({ scopeKey: "", rowKeys: new Set() });

  const retainedHydratedTimelineRowKeys = useMemo(() => {
    const retained = retainedHydratedTimelineRowKeysRef.current;
    if (retained.scopeKey !== retainedScopeKey) {
      retained.scopeKey = retainedScopeKey;
      retained.rowKeys = new Set();
    }
    return retained.rowKeys;
  }, [retainedScopeKey]);

  const timelineRowHydrationStates = useMemo(() => {
    if (!TIMELINE_ADAPTIVE_RENDERING_ENABLED || isThinking || isWorking) {
      return timelineProjectionRows.map((row) => ({
        rowKey: row.key,
        contentHash: `${rendererOptionsKey}:${row.key}`,
        rendererOptionsKey,
        renderWeight: 1,
        heavy: false,
        mode: "static" as const,
        hydrationReason: "not-heavy" as const,
      }));
    }
    // 无虚拟化：shouldVirtualize=false → heavy 行直接 hydrated。
    void shouldDeferHeavyTimelineRows;
    const nextStates = deriveTimelineRowHydrationStates({
      rows: timelineProjectionRows,
      shouldVirtualize: false,
      visibleRowKeys: new Set<string>(),
      activeRowKeys: activeLiveTimelineRowKeySet,
      retainedHydratedRowKeys: retainedHydratedTimelineRowKeys,
      anchorTargetRowKey: pendingJumpRowKey,
      detailHydrationRequested: conversationDetailHydrationRequested,
      rendererOptionsKey,
    });
    for (const state of nextStates) {
      if (state.heavy && state.mode === "hydrated") {
        retainedHydratedTimelineRowKeys.add(state.rowKey);
      }
    }
    return nextStates;
  }, [
    activeLiveTimelineRowKeySet,
    conversationDetailHydrationRequested,
    isThinking,
    isWorking,
    pendingJumpRowKey,
    rendererOptionsKey,
    retainedHydratedTimelineRowKeys,
    shouldDeferHeavyTimelineRows,
    timelineProjectionRows,
  ]);

  const hydratedHeavyTimelineRowCount = useMemo(
    () => countHydratedHeavyTimelineRows(timelineRowHydrationStates),
    [timelineRowHydrationStates],
  );
  const timelineRowHydrationStateByKey = useMemo(
    () => new Map(timelineRowHydrationStates.map((state) => [state.rowKey, state])),
    [timelineRowHydrationStates],
  );

  // 统一幕布：行级「详情已延迟」摘要条永久关闭。
  const shouldRenderLightweightProjectionRow = useCallback((
    _row: TimelineProjectionRow,
    _hydrationState: TimelineRowHydrationState | undefined,
  ) => {
    void _row;
    void _hydrationState;
    void conversationDetailHydrationRequested;
    void effectiveConversationLightweightMode;
    void isThinking;
    void isWorking;
    return false;
  }, [
    conversationDetailHydrationRequested,
    effectiveConversationLightweightMode,
    isThinking,
    isWorking,
  ]);

  return {
    hydratedHeavyTimelineRowCount,
    shouldRenderLightweightProjectionRow,
    timelineRowHydrationStateByKey,
  };
}
