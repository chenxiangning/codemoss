import type { Virtualizer } from "@tanstack/react-virtual";
import type { ConversationItem } from "../../../../types";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";
import {
  shouldHideCodexCanvasCommandCard,
  type MessagesEngine,
} from "../../utils/messagesRenderUtils";

/** 稳定态 timeline 虚拟化门槛；从 200 降到 48，覆盖典型长对话（~56 可见行）idle 卡顿。 */
export const TIMELINE_VIRTUALIZATION_MIN_ROWS = 48;
/** 流式期虚拟化门槛；20+ static rows 已在 DMG 复现 250ms+ commits。 */
export const TIMELINE_VIRTUALIZATION_STREAMING_MIN_ROWS = 16;
export const TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT = 96;
export const TIMELINE_VIRTUALIZATION_HEAVY_ROW_WEIGHT = 16;
export const TIMELINE_CANVAS_STABLE_OVERSCAN = 12;
export const TIMELINE_CANVAS_STREAMING_OVERSCAN = 8;
export const TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MIN_HEIGHT = 1;
export const TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MAX_HEIGHT = 320;
export const TIMELINE_LIGHTWEIGHT_ROW_PLACEHOLDER_HEIGHT = 44;
export const TIMELINE_RENDER_WEIGHT_BASELINE_FLAG_KEY =
  "ccgui.perf.timelineRenderWeightBaseline";
export const TIMELINE_VIRTUALIZER_STABILITY_MAX_REMEASURE_COUNT = 3;
/**
 * Adaptive timeline rendering：idle 长历史可进入虚拟化，降低全量 DOM 滚动成本。
 * 流式期仍由 TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED 单独门禁
 * （默认关闭，继续依赖 STREAMING_VISIBLE_WINDOW 尾窗 + static 行，避免 attach 重叠）。
 * Virtualizer 须提供 initialOffset=当前 scrollTop，避免 attach 默认 0 把视口拽到顶。
 */
export const TIMELINE_ADAPTIVE_RENDERING_ENABLED = true;

export type TimelineRenderWeightCategory =
  | "anchorOutlinePressure"
  | "codeFence"
  | "deferredImage"
  | "diff"
  | "generatedImage"
  | "image"
  | "markdownTable"
  | "messageText"
  | "readBatch"
  | "reasoning"
  | "review"
  | "toolOutput"
  | "toolRawPayload";

export type TimelineRenderWeightCategoryCounts = Partial<
  Record<TimelineRenderWeightCategory, number>
>;

export type TimelineRenderWeightSummary = {
  rowCount: number;
  renderWeight: number;
  heavyRowCount: number;
  categoryCounts: TimelineRenderWeightCategoryCounts;
};

/**
 * 流式期虚拟化：默认关闭。流式期用 STREAMING_VISIBLE_WINDOW 裁剪 + static DOM，
 * 避免 enabled 切换时空 size cache 导致行重叠；idle 长历史再走虚拟化。
 */
export const TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED = false;

function canReadBaselineFlag() {
  if (typeof globalThis === "undefined") {
    return false;
  }
  try {
    return typeof globalThis.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function isTimelineRenderWeightGateEnabled() {
  if (!TIMELINE_ADAPTIVE_RENDERING_ENABLED) {
    return false;
  }
  if (!canReadBaselineFlag()) {
    return true;
  }
  try {
    const value = globalThis.localStorage.getItem(TIMELINE_RENDER_WEIGHT_BASELINE_FLAG_KEY);
    return value !== "1" && value !== "true" && value !== "on";
  } catch {
    return true;
  }
}

export function shouldVirtualizeTimelineRows(input: {
  isThinking: boolean;
  isWorking?: boolean;
  rowCount: number;
  renderWeight?: number;
}) {
  if (!TIMELINE_ADAPTIVE_RENDERING_ENABLED) {
    return false;
  }
  if (input.isThinking || input.isWorking) {
    return TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED &&
      input.rowCount >= TIMELINE_VIRTUALIZATION_STREAMING_MIN_ROWS;
  }
  const renderWeightGateEnabled = isTimelineRenderWeightGateEnabled();
  const hasHighRenderDensity = renderWeightGateEnabled &&
    typeof input.renderWeight === "number" &&
    input.renderWeight >= TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT &&
    input.renderWeight > input.rowCount * 2;
  if (hasHighRenderDensity) {
    return true;
  }
  return input.rowCount >= TIMELINE_VIRTUALIZATION_MIN_ROWS;
}

export function resolveTimelineCanvasOverscan(input: {
  isThinking: boolean;
  isWorking: boolean;
  rowCount: number;
  renderWeight: number;
}) {
  if (!input.isThinking && !input.isWorking) {
    return TIMELINE_CANVAS_STABLE_OVERSCAN;
  }
  if (
    input.rowCount >= TIMELINE_VIRTUALIZATION_MIN_ROWS ||
    input.renderWeight >= TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT
  ) {
    return TIMELINE_CANVAS_STREAMING_OVERSCAN;
  }
  return TIMELINE_CANVAS_STABLE_OVERSCAN;
}

export function resolveVirtualizedTimelineRowPlaceholderHeight(size: unknown) {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MIN_HEIGHT;
  }
  return Math.min(
    TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MAX_HEIGHT,
    Math.max(TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MIN_HEIGHT, Math.ceil(size)),
  );
}

export function resolveVirtualizedTimelineRowVisualHeight(input: {
  measuredSize: unknown;
  estimatedSize: number;
  lightweight: boolean;
}) {
  if (input.lightweight) {
    return TIMELINE_LIGHTWEIGHT_ROW_PLACEHOLDER_HEIGHT;
  }
  return resolveVirtualizedTimelineRowPlaceholderHeight(
    typeof input.measuredSize === "number" && Number.isFinite(input.measuredSize)
      ? input.measuredSize
      : input.estimatedSize,
  );
}

type RenderWeightBreakdown = {
  weight: number;
  categoryCounts: TimelineRenderWeightCategoryCounts;
};

function incrementCategory(
  categoryCounts: TimelineRenderWeightCategoryCounts,
  category: TimelineRenderWeightCategory,
  amount: number,
) {
  if (amount <= 0) {
    return;
  }
  categoryCounts[category] = (categoryCounts[category] ?? 0) + amount;
}

function mergeCategoryCounts(
  target: TimelineRenderWeightCategoryCounts,
  source: TimelineRenderWeightCategoryCounts,
) {
  for (const [category, amount] of Object.entries(source)) {
    incrementCategory(
      target,
      category as TimelineRenderWeightCategory,
      typeof amount === "number" ? amount : 0,
    );
  }
}

function countRegexMatches(input: string, pattern: RegExp, maxCount: number) {
  let count = 0;
  for (const _match of input.matchAll(pattern)) {
    count += 1;
    if (count >= maxCount) {
      break;
    }
  }
  return count;
}

function countMarkdownTableRows(text: string) {
  let tableRows = 0;
  for (const line of text.split(/\r?\n/)) {
    const pipeCount = countRegexMatches(line, /\|/g, 8);
    if (pipeCount >= 2) {
      tableRows += 1;
    }
    if (tableRows >= 160) {
      break;
    }
  }
  return tableRows;
}

function estimateMarkdownTextBreakdown(text: string): RenderWeightBreakdown {
  const categoryCounts: TimelineRenderWeightCategoryCounts = {};
  let weight = Math.min(24, Math.floor(text.length / 2_000));
  incrementCategory(categoryCounts, "messageText", weight);

  const tableRows = countMarkdownTableRows(text);
  if (tableRows > 0) {
    const tableWeight = Math.min(48, tableRows * 2);
    weight += tableWeight;
    incrementCategory(categoryCounts, "markdownTable", tableRows);
  }

  const codeFenceCount = countRegexMatches(text, /(^|\n)(```|~~~)/g, 32);
  if (codeFenceCount > 0) {
    const codeFenceWeight = Math.min(40, codeFenceCount * 6 + Math.floor(text.length / 6_000));
    weight += codeFenceWeight;
    incrementCategory(categoryCounts, "codeFence", codeFenceCount);
  }

  const toolXmlCount = countRegexMatches(
    text,
    /<(?:function_calls?|invoke|tool_call|tool_result|tool_use)\b/gi,
    12,
  );
  if (toolXmlCount > 0) {
    const toolXmlWeight = Math.min(36, toolXmlCount * 12);
    weight += toolXmlWeight;
    incrementCategory(categoryCounts, "toolRawPayload", toolXmlCount);
  }

  return { weight, categoryCounts };
}

function estimateConversationItemRenderWeight(item: ConversationItem): RenderWeightBreakdown {
  const categoryCounts: TimelineRenderWeightCategoryCounts = {};
  if (item.kind === "message") {
    const imageWeight = (item.images ?? []).reduce((total, image) => {
      const inlineDataWeight = image.toLowerCase().startsWith("data:image/")
        ? Math.min(160, Math.ceil(image.length / 32_768))
        : 0;
      return total + 28 + inlineDataWeight;
    }, 0);
    const deferredImageWeight = (item.deferredImages?.length ?? 0) * 18;
    const textBreakdown = estimateMarkdownTextBreakdown(item.text);
    incrementCategory(categoryCounts, "image", item.images?.length ?? 0);
    incrementCategory(categoryCounts, "deferredImage", item.deferredImages?.length ?? 0);
    mergeCategoryCounts(categoryCounts, textBreakdown.categoryCounts);
    return {
      weight: 1 + imageWeight + deferredImageWeight + textBreakdown.weight,
      categoryCounts,
    };
  }
  if (item.kind === "generatedImage") {
    const imageWeight = item.images.reduce((total, image) => {
      const inlineDataWeight = image.src.toLowerCase().startsWith("data:image/")
        ? Math.min(160, Math.ceil(image.src.length / 32_768))
        : 0;
      return total + 28 + inlineDataWeight;
    }, 0);
    incrementCategory(categoryCounts, "generatedImage", item.images.length || 1);
    return { weight: 24 + imageWeight, categoryCounts };
  }
  if (item.kind === "reasoning") {
    const weight = Math.min(18, Math.floor((item.summary.length + item.content.length) / 2_000));
    incrementCategory(categoryCounts, "reasoning", weight);
    return { weight: 1 + weight, categoryCounts };
  }
  if (item.kind === "tool") {
    const outputLength = item.output?.length ?? 0;
    const changeCount = item.changes?.length ?? 0;
    const changeDiffLength =
      item.changes?.reduce((total, change) => total + (change.diff?.length ?? 0), 0) ?? 0;
    const outputWeight = Math.min(32, Math.floor(outputLength / 1_500));
    const changeWeight = Math.min(32, changeCount * 4 + Math.floor(changeDiffLength / 1_500));
    const rawPayloadCount = countRegexMatches(
      `${item.title}\n${item.detail}\n${item.output ?? ""}`,
      /<(?:function_calls?|invoke|tool_call|tool_result|tool_use)\b/gi,
      12,
    );
    const rawPayloadWeight = Math.min(36, rawPayloadCount * 12);
    incrementCategory(categoryCounts, "toolOutput", outputWeight);
    incrementCategory(categoryCounts, "diff", changeCount);
    incrementCategory(categoryCounts, "toolRawPayload", rawPayloadCount);
    return {
      weight: 1 + outputWeight + changeWeight + rawPayloadWeight,
      categoryCounts,
    };
  }
  if (item.kind === "diff" || item.kind === "review") {
    const textLength = item.kind === "diff" ? item.diff.length : item.text.length;
    const diffMarkerCount =
      item.kind === "diff"
        ? countRegexMatches(item.diff, /(^|\n)(diff --git|@@|\+\+\+ |--- )/g, 80)
        : 0;
    const weight = Math.min(40, Math.floor(textLength / 1_500) + diffMarkerCount * 2);
    incrementCategory(categoryCounts, item.kind === "diff" ? "diff" : "review", weight);
    return { weight: 1 + weight, categoryCounts };
  }
  return { weight: 1, categoryCounts };
}

export function estimateTimelineProjectionRenderWeight(row: TimelineProjectionRow) {
  return summarizeTimelineProjectionRowRenderWeight(row).renderWeight;
}

function summarizeTimelineProjectionRowRenderWeight(row: TimelineProjectionRow) {
  if (row.kind !== "entry") {
    return {
      renderWeight: row.kind === "bottomAnchor" ? 0 : 1,
      categoryCounts: {} satisfies TimelineRenderWeightCategoryCounts,
    };
  }
  const categoryCounts: TimelineRenderWeightCategoryCounts = {};
  let renderWeight = 0;
  if (row.entry.kind === "item") {
    const breakdown = estimateConversationItemRenderWeight(row.entry.item);
    renderWeight += breakdown.weight;
    mergeCategoryCounts(categoryCounts, breakdown.categoryCounts);
  } else {
    if (row.entry.kind === "readGroup") {
      const readBatchWeight = Math.min(48, row.entry.items.length * 6);
      renderWeight += readBatchWeight;
      incrementCategory(categoryCounts, "readBatch", row.entry.items.length);
    }
    for (const item of row.entry.items) {
      const breakdown = estimateConversationItemRenderWeight(item);
      renderWeight += breakdown.weight;
      mergeCategoryCounts(categoryCounts, breakdown.categoryCounts);
    }
  }
  if (row.hasActiveUserInputAnchor) {
    renderWeight += 8;
    incrementCategory(categoryCounts, "anchorOutlinePressure", 1);
  }
  return { renderWeight, categoryCounts };
}

export function summarizeTimelineProjectionRenderWeight(
  rows: readonly TimelineProjectionRow[],
): TimelineRenderWeightSummary {
  const categoryCounts: TimelineRenderWeightCategoryCounts = {};
  let renderWeight = 0;
  let heavyRowCount = 0;
  for (const row of rows) {
    const rowSummary = summarizeTimelineProjectionRowRenderWeight(row);
    renderWeight += rowSummary.renderWeight;
    if (rowSummary.renderWeight >= TIMELINE_VIRTUALIZATION_HEAVY_ROW_WEIGHT) {
      heavyRowCount += 1;
    }
    mergeCategoryCounts(categoryCounts, rowSummary.categoryCounts);
  }
  return {
    rowCount: rows.length,
    renderWeight,
    heavyRowCount,
    categoryCounts,
  };
}

export function getTimelineVirtualizationThresholdReason(input: {
  rowCount: number;
  renderWeight: number;
}) {
  if (input.rowCount >= TIMELINE_VIRTUALIZATION_MIN_ROWS) {
    return "row-count";
  }
  if (
    isTimelineRenderWeightGateEnabled() &&
    input.renderWeight >= TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT &&
    input.renderWeight > input.rowCount * 2
  ) {
    return "render-weight";
  }
  return "disabled";
}

export function buildTimelineRenderWeightDiagnosticPayload(input: {
  summary: TimelineRenderWeightSummary;
  shouldVirtualize: boolean;
  hydratedHeavyRowCount?: number | null;
  localErrorState?: "none" | "contained" | "blocked" | "unknown";
  threadId?: string | null;
  workspaceId?: string | null;
}) {
  const thresholdReason = getTimelineVirtualizationThresholdReason({
    rowCount: input.summary.rowCount,
    renderWeight: input.summary.renderWeight,
  });
  return {
    threadId: input.threadId ?? null,
    workspaceId: input.workspaceId ?? null,
    rowCount: input.summary.rowCount,
    renderWeight: input.summary.renderWeight,
    heavyRowCount: input.summary.heavyRowCount,
    hydratedHeavyRowCount: input.hydratedHeavyRowCount ?? null,
    localErrorState: input.localErrorState ?? "unknown",
    categoryCounts: input.summary.categoryCounts,
    shouldVirtualize: input.shouldVirtualize,
    thresholdReason,
  };
}

export function estimateTimelineProjectionRowSize(row: TimelineProjectionRow) {
  switch (row.kind) {
    case "entry":
      if (row.entry.kind !== "item") {
        if (row.entry.kind === "bashGroup" || row.entry.kind === "readGroup") {
          return 128;
        }
        return 112;
      }
      switch (row.entry.item.kind) {
        case "explore":
          // 折叠 explore 行约 22px 行高 + 上下 6px margin
          return row.entry.item.status === "exploring" ? 52 : 36;
        case "tool":
          // 折叠 Marker 行 + 6px 外层 margin（展开体另由 measure 纠正）
          return 44;
        case "reasoning":
          // 折叠思考头 + 6px 外层 margin；展开/流式由 measure 纠正
          return 40;
        case "message": {
          const textLength = row.entry.item.text.length;
          if (row.entry.item.role === "user") {
            return Math.min(180, 48 + Math.ceil(textLength / 220) * 18);
          }
          return Math.min(260, 72 + Math.ceil(textLength / 320) * 20);
        }
        case "diff":
        case "review":
          return 104;
        case "generatedImage":
          return 180;
        default:
          return 112;
      }
    case "dockedReasoning":
      return 96;
    case "tailUserInput":
      return 132;
    case "liveMiddleCollapsed":
      // drawer header + hairline + 上下 4/12 外层 margin
      return 40;
    case "workingIndicator":
      return 52;
    case "emptyState":
      return 160;
    case "historyRecoveryFailure":
      return 132;
    case "approval":
      return 132;
    case "bottomAnchor":
      return 1;
  }
}

/**
 * 部分投影行在某些上下文下会渲染成 null/空（如非工作态的 workingIndicator）。
 * 虚拟行容器对每行强制 minHeight=估高，这些空行因而被撑出大段空白。此函数复刻
 * MessagesTimeline 中对应的渲染条件，供虚拟化层把空行的占位高度归零。
 *
 * 注意：判断逻辑必须与 renderEntry/renderProjectionRow/WorkingIndicator 的真实
 * 渲染分支保持同步，否则会错判（漏判=残留空白，误判=塌掉真实行）。
 * bash/command 工具卡已始终上画布，不再按引擎判空。
 */
export function isEmptyVirtualProjectionRow(
  row: TimelineProjectionRow,
  input: {
    activeEngine: MessagesEngine;
    claudeHistoryTranscriptFallbackActive: boolean;
    hasTailUserInputNode: boolean;
    isWorking: boolean;
    lastDurationMs: number | null;
    effectiveItemsCount: number;
  },
): boolean {
  switch (row.kind) {
    case "bottomAnchor":
      return true;
    case "workingIndicator": {
      // WorkingIndicator 收到 isThinking={isWorking}、hasItems={effectiveItemsCount > 0}。
      // 工作态显示 spinner；非工作态仅在「上一轮耗时已知且有内容」时显示完成提示，否则为空。
      if (input.isWorking) {
        return false;
      }
      const showsTurnComplete =
        input.lastDurationMs !== null && input.effectiveItemsCount > 0;
      return !showsTurnComplete;
    }
    case "tailUserInput":
      return !input.hasTailUserInputNode;
    case "entry": {
      if (row.entry.kind === "bashGroup") {
        // Empty only when every command row is pure shell noise.
        return row.entry.items.every((toolItem) =>
          shouldHideCodexCanvasCommandCard(toolItem, input.activeEngine),
        );
      }
      if (row.entry.kind === "item" && row.entry.item.kind === "tool") {
        return shouldHideCodexCanvasCommandCard(row.entry.item, input.activeEngine);
      }
      return false;
    }
    default:
      return false;
  }
}

export function getActiveLiveTimelineRowKeys(input: {
  rows: readonly TimelineProjectionRow[];
  liveAssistantItemId?: string | null;
  liveReasoningItemId?: string | null;
}) {
  const liveItemIds = new Set(
    [input.liveAssistantItemId, input.liveReasoningItemId].filter(
      (itemId): itemId is string => typeof itemId === "string" && itemId.length > 0,
    ),
  );
  if (liveItemIds.size === 0) {
    return [];
  }
  return input.rows
    .filter((row) => {
      if (row.kind === "entry") {
        return row.itemIds.some((itemId) => liveItemIds.has(itemId));
      }
      if (row.kind === "dockedReasoning") {
        return liveItemIds.has(row.itemId);
      }
      return false;
    })
    .map((row) => row.key);
}

export type TimelineVirtualizerStabilityState =
  | "stable"
  | "empty-visible-set"
  | "active-live-row-missing";

export type TimelineVirtualizerStabilityRecoveryBudget = {
  signature: string;
  remeasureCount: number;
  lastRemeasureAt: number;
  lastDiagnosticAt: number;
};

export const DEFAULT_TIMELINE_VIRTUALIZER_STABILITY_RECOVERY_BUDGET: TimelineVirtualizerStabilityRecoveryBudget = {
  signature: "",
  remeasureCount: 0,
  lastRemeasureAt: 0,
  lastDiagnosticAt: 0,
};

export function classifyTimelineVirtualizerStability(input: {
  shouldVirtualize: boolean;
  rowCount: number;
  hasScrollElement: boolean;
  virtualItemKeys: ReadonlyArray<unknown>;
  activeLiveRowKeys: readonly string[];
  streamingActive: boolean;
}): TimelineVirtualizerStabilityState {
  if (!input.shouldVirtualize || !input.hasScrollElement || input.rowCount <= 0) {
    return "stable";
  }
  if (input.virtualItemKeys.length === 0) {
    return "empty-visible-set";
  }
  if (!input.streamingActive || input.activeLiveRowKeys.length === 0) {
    return "stable";
  }
  const visibleKeys = new Set(input.virtualItemKeys.map(String));
  return input.activeLiveRowKeys.some((rowKey) => !visibleKeys.has(rowKey))
    ? "active-live-row-missing"
    : "stable";
}

export function resolveTimelineVirtualizerStabilityRecovery(input: {
  previous: TimelineVirtualizerStabilityRecoveryBudget;
  signature: string;
  now: number;
  remeasureCooldownMs: number;
  diagnosticCooldownMs: number;
  maxRemeasureCount?: number;
}) {
  const maxRemeasureCount =
    input.maxRemeasureCount ?? TIMELINE_VIRTUALIZER_STABILITY_MAX_REMEASURE_COUNT;
  const previous =
    input.previous.signature === input.signature
      ? input.previous
      : DEFAULT_TIMELINE_VIRTUALIZER_STABILITY_RECOVERY_BUDGET;
  const canRemeasureByCooldown =
    input.now - previous.lastRemeasureAt >= input.remeasureCooldownMs;
  const shouldRemeasure =
    previous.remeasureCount < maxRemeasureCount && canRemeasureByCooldown;
  const shouldDiagnose =
    input.now - previous.lastDiagnosticAt >= input.diagnosticCooldownMs;
  const nextBudget: TimelineVirtualizerStabilityRecoveryBudget = {
    signature: input.signature,
    remeasureCount: shouldRemeasure
      ? previous.remeasureCount + 1
      : previous.remeasureCount,
    lastRemeasureAt: shouldRemeasure
      ? input.now
      : previous.lastRemeasureAt,
    lastDiagnosticAt: shouldDiagnose
      ? input.now
      : previous.lastDiagnosticAt,
  };
  return {
    nextBudget,
    shouldRemeasure,
    shouldDiagnose,
    remeasureSuppressed: nextBudget.remeasureCount >= maxRemeasureCount,
  };
}

export function resolveVirtualizedTimelineScopeReset(input: {
  previousScopeKey: string | null;
  nextScopeKey: string;
  shouldVirtualize: boolean;
  stableHistoryView: boolean;
  hasPendingJump: boolean;
  hasScrollElement: boolean;
}) {
  if (!input.shouldVirtualize) {
    return {
      nextScopeKey: null,
      shouldMeasure: false,
      // 虚拟化 ON→OFF 也是整体布局重排：估高摆放换回真实高度，scrollHeight 跳变，
      // parked 在底部的视口会被甩到半空，需要一次落位收敛（armed 与否由调用方判定）。
      shouldPinBottomWhenArmed:
        input.previousScopeKey !== null &&
        !input.hasPendingJump &&
        input.hasScrollElement,
    };
  }
  // 虚拟化刚翻开（previousScopeKey=null）必须立即重测，不能等 stableHistoryView：
  // TanStack 在 enabled=false 期间会清空 itemSizeCache（getMeasurements 的 disabled
  // 分支），发送消息使 isWorking=true、门槛从 48 降到 16 时虚拟化带着空缓存翻开，
  // 全部行按估高摆放（长回复封顶 260px），新气泡/working 指示会叠进上一条长回复
  // 的真实高度区间；此时四条重测路径全被工作态门禁挡住，重叠会一直持续到首个
  // delta 触发 liveRowRemeasure 才自愈。
  if (input.previousScopeKey === null) {
    if (input.hasPendingJump || !input.hasScrollElement) {
      return {
        nextScopeKey: null,
        shouldMeasure: false,
        shouldPinBottomWhenArmed: false,
      };
    }
    return {
      nextScopeKey: input.nextScopeKey,
      shouldMeasure: true,
      // OFF→ON 翻开瞬间总高度塌缩到估高之和，浏览器把 scrollTop 钳位后重测回填，
      // 视口会离开真实底部；parked 在底部的用户需要一次落位收敛追回。
      shouldPinBottomWhenArmed: true,
    };
  }
  if (!input.stableHistoryView || input.hasPendingJump || !input.hasScrollElement) {
    return {
      nextScopeKey: input.previousScopeKey,
      shouldMeasure: false,
      shouldPinBottomWhenArmed: false,
    };
  }
  if (
    resolveVirtualizedTimelineScopeIdentity(input.previousScopeKey) ===
    resolveVirtualizedTimelineScopeIdentity(input.nextScopeKey)
  ) {
    const keyChanged = input.previousScopeKey !== input.nextScopeKey;
    return {
      nextScopeKey: input.nextScopeKey,
      shouldMeasure: keyChanged,
      // 同 thread 内 deferred 回刷 / 呈现 scope 变化会改 key 并 remeasure；
      // 此前不 pin 会导致估高→真高后视口停在假底（结束后 1–2s 丢底）。
      shouldPinBottomWhenArmed: keyChanged && input.stableHistoryView,
    };
  }
  return {
    nextScopeKey: input.nextScopeKey,
    shouldMeasure: true,
    shouldPinBottomWhenArmed: true,
  };
}

function resolveVirtualizedTimelineScopeIdentity(scopeKey: string): string {
  const [workspaceId = "", threadId = ""] = scopeKey.split("\u0000");
  return [workspaceId, threadId].join("\u0000");
}

/**
 * virtual-core 的 measure() 只清空行高缓存（所有行回落到估高），并不会重测已挂载
 * 的 DOM：measureElement ref 只在行挂载时触发一次，ResizeObserver 只在行高变化时
 * 触发。清缓存后 DOM 高度并没有变 → 没有任何回调把真实高度写回缓存 → 已挂载的
 * 重内容行被压回估高（消息行封顶 260px），真实内容溢出进后续行的 translateY 区间，
 * 形成进入长对话时的行堆叠，且在滚动触发重挂载前不会自愈。
 *
 * 需要重测时应逐行重测仍挂载的节点（只更新有偏差的行，不丢弃有效测量值）；
 * 仅当没有任何挂载行时（如 empty-visible-set 卡死恢复），全量 measure() 才安全。
 */
export function remeasureTimelineVirtualizerRows<TScrollElement extends Element>(
  instance: Virtualizer<TScrollElement, Element>,
) {
  const mountedNodes: Element[] = [];
  // elementsCache 属于公开字段，但测试替身可能不提供；缺失时按「无挂载行」回落。
  (instance.elementsCache as typeof instance.elementsCache | undefined)?.forEach(
    (node) => {
      if (node?.isConnected) {
        mountedNodes.push(node);
      }
    },
  );
  if (mountedNodes.length === 0) {
    instance.measure();
    return;
  }
  for (const node of mountedNodes) {
    instance.measureElement(node);
  }
}

export function observeTimelineElementOffset<TScrollElement extends Element>(
  instance: Virtualizer<TScrollElement, Element>,
  callback: (offset: number, isScrolling: boolean) => void,
) {
  const element = instance.scrollElement;
  const targetWindow = instance.targetWindow;
  if (!element || !targetWindow) {
    return;
  }

  let offset = 0;
  let timeoutId: number | null = null;
  const clearPendingScrollEnd = () => {
    if (timeoutId !== null) {
      targetWindow.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  const supportsScrollEnd = "onscrollend" in targetWindow;
  const useScrollEndEvent = instance.options.useScrollendEvent && supportsScrollEnd;

  const scheduleScrollEndFallback = () => {
    if (useScrollEndEvent) {
      return;
    }
    clearPendingScrollEnd();
    timeoutId = targetWindow.setTimeout(() => {
      timeoutId = null;
      callback(offset, false);
    }, instance.options.isScrollingResetDelay);
  };

  const createHandler = (isScrolling: boolean) => () => {
    offset = instance.options.horizontal
      ? element.scrollLeft * (instance.options.isRtl ? -1 : 1)
      : element.scrollTop;
    scheduleScrollEndFallback();
    callback(offset, isScrolling);
  };
  const scrollHandler = createHandler(true);
  const scrollEndHandler = createHandler(false);
  element.addEventListener("scroll", scrollHandler, { passive: true });
  if (useScrollEndEvent) {
    element.addEventListener("scrollend", scrollEndHandler, { passive: true });
  }
  return () => {
    clearPendingScrollEnd();
    element.removeEventListener("scroll", scrollHandler);
    if (useScrollEndEvent) {
      element.removeEventListener("scrollend", scrollEndHandler);
    }
  };
}
