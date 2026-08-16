import { useMemo } from "react";

import type { ConversationItem } from "../../../types";
import {
  EMPTY_ACTIVE_CANVAS_ITEMS,
  useActiveCanvasSelector,
} from "../../layout/hooks/activeCanvasStore";
import { freezeTurnSnapshot } from "@mossx/plugin-shared-session/runtime";
import type { TurnExecutionSnapshot } from "@mossx/plugin-shared-session/runtime";
import { buildAgentCanvasThreadId } from "../runtime/agentCanvasThread";
import { pickLongestStageBody } from "../utils/stageBodyText";
import type {
  AgentExecutionTarget,
  AgentProjectionV1,
  AgentStageProjection,
} from "../types";

/** 在 projection 原始项上按 attemptId 切片（ConversationItem 可能丢 attempt 字段）。 */
export function filterProjectionItemsForAttempt(
  items: Array<{ content?: Record<string, unknown> | null }>,
  attemptId: string,
): typeof items {
  const id = attemptId.trim();
  if (!id) return [];
  return items.filter((item) => {
    const content = item.content ?? {};
    const a =
      typeof content.attemptId === "string" ? content.attemptId.trim() : "";
    const t = typeof content.turnId === "string" ? content.turnId.trim() : "";
    return a === id || t === id;
  });
}

/** 状态词/占位正文，不可作为最终渲染结果 */
export function isWeakStatusText(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (t.length <= 24) {
    return /^(completed?|done|success(ful)?|failed?|error|cancelled?|ok|true|false|null|undefined|成功|完成|失败|取消)[.!。！]*$/i.test(
      t,
    );
  }
  return false;
}

/** stage.target → TurnExecutionSnapshot（徽章与头对齐） */
export function stageTargetToSnapshot(
  target: AgentExecutionTarget | null | undefined,
): TurnExecutionSnapshot | null {
  if (!target?.engine) return null;
  // ExecutionTarget 选择域只有 disk|managed；local 按本地 provider 处理
  const selectionSource =
    target.providerProfileSource === "managed"
      ? ("managed" as const)
      : target.providerProfileSource === "disk" ||
          target.providerProfileSource === "local" ||
          !target.providerProfileId?.trim()
        ? ("disk" as const)
        : null;
  return freezeTurnSnapshot(
    {
      engine: target.engine,
      providerProfileId: target.providerProfileId ?? null,
      modelCatalogEntryId: target.modelCatalogEntryId ?? null,
      model: target.model ?? null,
      reasoning: target.reasoningEffort
        ? { effort: target.reasoningEffort }
        : null,
      providerProfileNameSnapshot: target.providerProfileNameSnapshot ?? null,
      providerProfileSource: selectionSource,
    },
    {
      providerProfileNameSnapshot: target.providerProfileNameSnapshot ?? null,
      providerProfileSource: selectionSource,
    },
  );
}

/**
 * 幕布 items 徽章强制对齐当前 stage.target。
 * 防止跨 attempt 脏 snapshot 在 Inspector 里「骗人」。
 * 必须比 effort，否则 grok high/low 会串徽章。
 */
export function alignItemsToStageTarget(
  items: readonly ConversationItem[],
  stage: AgentStageProjection,
): ConversationItem[] {
  const snapshot = stageTargetToSnapshot(stage.target);
  if (!snapshot || items.length === 0) {
    return items as ConversationItem[];
  }
  let changed = false;
  const next = items.map((item) => {
    if (item.kind !== "message" || item.role !== "assistant") return item;
    const prev = item.executionTargetSnapshot;
    const prevEffort =
      prev?.reasoning && typeof prev.reasoning === "object"
        ? (prev.reasoning as { effort?: string | null }).effort ?? null
        : null;
    const nextEffort =
      snapshot.reasoning && typeof snapshot.reasoning === "object"
        ? (snapshot.reasoning as { effort?: string | null }).effort ?? null
        : null;
    if (
      prev &&
      prev.engine === snapshot.engine &&
      (prev.model ?? null) === (snapshot.model ?? null) &&
      (prev.providerProfileNameSnapshot ?? null) ===
        (snapshot.providerProfileNameSnapshot ?? null) &&
      (prevEffort ?? null) === (nextEffort ?? null)
    ) {
      return item;
    }
    changed = true;
    return { ...item, executionTargetSnapshot: snapshot };
  });
  return changed ? next : (items as ConversationItem[]);
}

/**
 * settle / 无 live 时：仅用本 stage 的 fullOutcome（plan 可用 plan.markdown）。
 * 禁止用共享 projection 整会话回填（worker 不进主 canvas，易空→串台）。
 *
 * LIVE / running / pending：只允许本 phase 的 liveText；禁止 fullOutcome /
 * plan.markdown 回填（否则上一节点审查/规划正文会顶到当前 LIVE 卡）。
 */
export function buildStageOwnedFallback(input: {
  stage: AgentStageProjection;
  projection: AgentProjectionV1;
  liveText: string;
  isLive: boolean;
}): ConversationItem[] {
  const stageRunning =
    input.isLive ||
    input.stage.status === "running" ||
    input.stage.status === "pending";

  if (stageRunning) {
    const liveOnly = (input.liveText ?? "").trim();
    if (!liveOnly || isWeakStatusText(liveOnly)) return [];
    const baseId = `agent-stage-canvas:${input.projection.runId}:${input.stage.id}:${input.stage.attemptId ?? "na"}`;
    const snapshot = stageTargetToSnapshot(input.stage.target);
    return [
      {
        id: `${baseId}:assistant`,
        kind: "message",
        role: "assistant",
        text: liveOnly,
        isFinal: false,
        ...(snapshot ? { executionTargetSnapshot: snapshot } : {}),
      },
    ];
  }

  // settle：只用本 stage 落盘正文。禁止 liveText 归档（易串 phase）、禁止 plan 串非 plan。
  const planBody =
    input.stage.id === "plan"
      ? input.projection.plan?.markdown ?? ""
      : "";
  const body = pickLongestStageBody(
    // 明确不传 liveText：归档可能被错误 phase 污染，导致润色卡显示审查汇总
    "",
    input.stage.fullOutcome,
    planBody,
    input.stage.shortOutcome,
  );
  if (!body || isWeakStatusText(body)) return [];
  const baseId = `agent-stage-canvas:${input.projection.runId}:${input.stage.id}:${input.stage.attemptId ?? "na"}`;
  const snapshot = stageTargetToSnapshot(input.stage.target);
  return [
    {
      id: `${baseId}:assistant`,
      kind: "message",
      role: "assistant",
      text: body,
      isFinal: true,
      ...(snapshot ? { executionTargetSnapshot: snapshot } : {}),
    },
  ];
}

/** 本 attempt canvas 是否已有可展示的实质内容（非空壳） */
export function canvasHasOwnStageContent(
  items: readonly ConversationItem[],
  options?: { minAssistantChars?: number },
): boolean {
  const minChars = options?.minAssistantChars ?? 24;
  if (items.length === 0) return false;
  if (items.some((i) => i.kind === "tool" || i.kind === "reasoning")) {
    return true;
  }
  let assistantLen = 0;
  for (const item of items) {
    if (item.kind === "message" && item.role === "assistant") {
      assistantLen += item.text?.trim().length ?? 0;
    }
  }
  return assistantLen >= minChars;
}

/**
 * 右栏节点幕布（严格 attempt 隔离）：
 * 1) live：仅 agent-canvas:{shared}:{attemptId} 的 realtime items；
 *    无本 attempt 实质内容时返回空 → Inspector emptyLive（禁止串上一节点）
 * 2) settle / 空 canvas：仅本 stage fullOutcome（徽章=stage.target）
 * 3) 不用 shared projection 整会话切片（防串台）
 */
export function useAgentStageTranscript(input: {
  workspaceId: string | null | undefined;
  threadId: string | null | undefined;
  projection: AgentProjectionV1 | null;
  stage: AgentStageProjection | null;
  isLive: boolean;
  liveText: string;
}): {
  items: ConversationItem[];
  source: "canvas" | "synthetic" | "empty";
  canvasThreadId: string;
  processingStartedAt: number | null;
} {
  const { threadId, projection, stage, isLive, liveText } = input;
  const attemptId = stage?.attemptId?.trim() || "";
  const canvasThreadId =
    threadId && attemptId
      ? buildAgentCanvasThreadId(threadId, attemptId)
      : "";

  // 无 attemptId 时绝不读其它 canvas key
  const liveCanvasItems = useActiveCanvasSelector((state) => {
    if (!canvasThreadId) return EMPTY_ACTIVE_CANVAS_ITEMS;
    return (
      state.threadItemsByThread[canvasThreadId] ?? EMPTY_ACTIVE_CANVAS_ITEMS
    );
  });

  const synthetic = useMemo(() => {
    if (!projection || !stage) return [] as ConversationItem[];
    return buildStageOwnedFallback({
      stage,
      projection,
      liveText,
      isLive,
    });
  }, [projection, stage, liveText, isLive]);

  const ownCanvasReady = useMemo(
    () => canvasHasOwnStageContent(liveCanvasItems as ConversationItem[]),
    [liveCanvasItems],
  );

  // live：仅本 attempt 有实质 canvas 才用
  // settle：**强制** fullOutcome synthetic，禁用 canvas（canvas 常残留他段/末段流）
  const useCanvas = Boolean(isLive) && Boolean(canvasThreadId) && ownCanvasReady;

  const items = useMemo(() => {
    if (!stage) return [] as ConversationItem[];
    if (isLive) {
      if (useCanvas) {
        return alignItemsToStageTarget(
          liveCanvasItems as ConversationItem[],
          stage,
        );
      }
      // LIVE 无本 attempt 流：只允许本 phase liveText synthetic；否则空 → emptyLive
      return alignItemsToStageTarget(synthetic, stage);
    }
    // 终态：永远本 stage fullOutcome，保证切节点正文互不相同
    return alignItemsToStageTarget(synthetic, stage);
  }, [stage, isLive, useCanvas, liveCanvasItems, synthetic]);

  const stableStartedAt = useMemo(() => {
    if (!isLive || !stage) return null;
    if (stage.startedAt && stage.startedAt > 0) return stage.startedAt;
    return Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isLive, stage?.id, stage?.attemptId, stage?.startedAt]);

  const source: "canvas" | "synthetic" | "empty" = useCanvas
    ? "canvas"
    : items.length > 0
      ? "synthetic"
      : "empty";

  return {
    items,
    source,
    canvasThreadId,
    processingStartedAt: stableStartedAt,
  };
}
