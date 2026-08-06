import { useMemo } from "react";

import type { ConversationItem } from "../../../types";
import {
  EMPTY_ACTIVE_CANVAS_ITEMS,
  useActiveCanvasSelector,
} from "../../layout/hooks/activeCanvasStore";
import { freezeTurnSnapshot } from "../../shared-session/target/types";
import type { TurnExecutionSnapshot } from "../../shared-session/target/types";
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
    if (
      prev &&
      prev.engine === snapshot.engine &&
      (prev.model ?? null) === (snapshot.model ?? null) &&
      (prev.providerProfileNameSnapshot ?? null) ===
        (snapshot.providerProfileNameSnapshot ?? null)
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
 */
export function buildStageOwnedFallback(input: {
  stage: AgentStageProjection;
  projection: AgentProjectionV1;
  liveText: string;
  isLive: boolean;
}): ConversationItem[] {
  // plan 可用 plan.markdown；其它 stage **禁止**用 plan.markdown（串台根因之一）
  const planBody =
    input.stage.id === "plan"
      ? input.projection.plan?.markdown ?? ""
      : "";
  const body = pickLongestStageBody(
    input.liveText,
    input.stage.fullOutcome,
    planBody,
    input.stage.shortOutcome,
  );
  if (!body || isWeakStatusText(body)) return [];
  const baseId = `agent-stage-canvas:${input.projection.runId}:${input.stage.id}:${input.stage.attemptId ?? "na"}`;
  const snapshot = stageTargetToSnapshot(input.stage.target);
  const items: ConversationItem[] = [
    {
      id: `${baseId}:assistant`,
      kind: "message",
      role: "assistant",
      text: body,
      isFinal: !input.isLive,
      ...(snapshot ? { executionTargetSnapshot: snapshot } : {}),
    },
  ];
  return items;
}

/**
 * 右栏节点幕布（严格 attempt 隔离）：
 * 1) live：仅 agent-canvas:{shared}:{attemptId} 的 realtime items
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
  source: "canvas" | "synthetic";
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

  const canvasBodyLen = useMemo(() => {
    return liveCanvasItems
      .filter(
        (item): item is Extract<ConversationItem, { kind: "message" }> =>
          item.kind === "message" && item.role === "assistant",
      )
      .reduce((sum, item) => sum + (item.text?.trim().length ?? 0), 0);
  }, [liveCanvasItems]);

  // live：有 canvas 即用；settle：有实质正文或工具轨迹才用 canvas，否则 fullOutcome
  const useCanvas =
    Boolean(canvasThreadId) &&
    liveCanvasItems.length > 0 &&
    (isLive ||
      liveCanvasItems.some((i) => i.kind === "tool" || i.kind === "reasoning") ||
      canvasBodyLen >= 24);

  const items = useMemo(() => {
    if (!stage) return [] as ConversationItem[];
    const raw = useCanvas
      ? (liveCanvasItems as ConversationItem[])
      : synthetic;
    return alignItemsToStageTarget(raw, stage);
  }, [stage, useCanvas, liveCanvasItems, synthetic]);

  const stableStartedAt = useMemo(() => {
    if (!isLive || !stage) return null;
    if (stage.startedAt && stage.startedAt > 0) return stage.startedAt;
    return Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isLive, stage?.id, stage?.attemptId, stage?.startedAt]);

  return {
    items,
    source: useCanvas ? "canvas" : "synthetic",
    canvasThreadId,
    processingStartedAt: stableStartedAt,
  };
}
