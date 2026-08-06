import { useEffect, useMemo, useState } from "react";

import type { ConversationItem } from "../../../types";
import { loadSharedProjection } from "../../shared-session/services/sharedSessions";
import {
  resolveSharedConversationItems,
} from "../../messages/presentation/sharedProjection/dataSource";
import type { SharedProjectionItem } from "../../messages/presentation/sharedProjection/types";
import { pickLongestStageBody } from "../utils/stageBodyText";
import type { AgentProjectionV1, AgentStageProjection } from "../types";

/** 在 projection 原始项上按 attemptId 切片（ConversationItem 可能丢 attempt 字段）。 */
export function filterProjectionItemsForAttempt(
  items: SharedProjectionItem[],
  attemptId: string,
): SharedProjectionItem[] {
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

/** 状态词/占位正文，不可作为最终渲染结果（渲染失败时降级合成正文） */
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

function assistantBodyLength(items: ConversationItem[]): number {
  return items
    .filter(
      (item): item is Extract<ConversationItem, { kind: "message" }> =>
        item.kind === "message" && item.role === "assistant",
    )
    .reduce((sum, item) => sum + (item.text?.trim().length ?? 0), 0);
}

function buildSyntheticFallback(input: {
  stage: AgentStageProjection;
  projection: AgentProjectionV1;
  liveText: string;
  isLive: boolean;
}): ConversationItem[] {
  const body = pickLongestStageBody(
    input.liveText,
    input.stage.fullOutcome,
    input.stage.id === "plan" || input.stage.requiresApproval
      ? input.projection.plan?.markdown
      : "",
    input.stage.shortOutcome,
  );
  if (!body || isWeakStatusText(body)) return [];
  const baseId = `agent-stage-canvas:${input.projection.runId}:${input.stage.id}`;
  const roleHint =
    input.stage.rolePrompt?.trim() ||
    (input.stage.id === "plan"
      ? "规划节点"
      : input.stage.id === "implement"
        ? "实现节点"
        : input.stage.id === "review"
          ? "审查节点"
          : input.stage.title || input.stage.id);
  const items: ConversationItem[] = [];
  if (roleHint) {
    items.push({
      id: `${baseId}:user`,
      kind: "message",
      role: "user",
      text: roleHint,
    });
  }
  items.push({
    id: `${baseId}:assistant`,
    kind: "message",
    role: "assistant",
    text: body,
    isFinal: !input.isLive,
  });
  return items;
}

/**
 * 右栏节点幕布：优先 Shared projection 真 items（工具/MD/改文件与主 session 同源），
 * 无切片时回退 live/fullOutcome 文本合成。
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
  source: "projection" | "synthetic";
  processingStartedAt: number | null;
} {
  const { workspaceId, threadId, projection, stage, isLive, liveText } = input;
  const [projected, setProjected] = useState<ConversationItem[]>([]);
  const attemptId = stage?.attemptId?.trim() || "";

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId || !threadId || !attemptId) {
      setProjected([]);
      return;
    }
    void (async () => {
      try {
        const raw = (await loadSharedProjection(
          workspaceId,
          threadId,
        )) as SharedProjectionItem[];
        if (cancelled) return;
        const slicedRaw = filterProjectionItemsForAttempt(raw ?? [], attemptId);
        const items = resolveSharedConversationItems(slicedRaw) ?? [];
        setProjected(items);
      } catch {
        if (!cancelled) setProjected([]);
      }
    })();
    // 运行中每 2.5s 轻量刷新，便于工具/文本落入 projection 后右栏对齐主 session
    const poll =
      stage?.status === "running"
        ? window.setInterval(() => {
            void loadSharedProjection(workspaceId, threadId)
              .then((raw) => {
                if (cancelled) return;
                const slicedRaw = filterProjectionItemsForAttempt(
                  (raw ?? []) as SharedProjectionItem[],
                  attemptId,
                );
                setProjected(
                  resolveSharedConversationItems(slicedRaw) ?? [],
                );
              })
              .catch(() => undefined);
          }, 2500)
        : undefined;
    return () => {
      cancelled = true;
      if (poll !== undefined) window.clearInterval(poll);
    };
  }, [workspaceId, threadId, attemptId, stage?.status, stage?.settledAt]);

  const synthetic = useMemo(() => {
    if (!projection || !stage) return [] as ConversationItem[];
    return buildSyntheticFallback({
      stage,
      projection,
      liveText,
      isLive,
    });
  }, [projection, stage, liveText, isLive]);

  const projectedBodyLen = useMemo(
    () => assistantBodyLength(projected),
    [projected],
  );
  const syntheticBodyLen = useMemo(
    () => assistantBodyLength(synthetic),
    [synthetic],
  );

  // 有工具/reasoning 时优先 projection；纯文本时若弱于 fullOutcome/plan 则降级合成
  const useProjection =
    projected.length > 0 &&
    (projected.some((i) => i.kind === "tool" || i.kind === "reasoning") ||
      (projectedBodyLen >= 48 &&
        projectedBodyLen + 32 >= syntheticBodyLen &&
        !isWeakStatusText(
          projected
            .filter(
              (i): i is Extract<ConversationItem, { kind: "message" }> =>
                i.kind === "message" && i.role === "assistant",
            )
            .map((i) => i.text || "")
            .join("\n"),
        )));

  const items = useMemo(() => {
    if (useProjection) {
      // 进行中：projection 切片 + 尾部 live 文本（若更长）
      if (isLive && liveText.trim()) {
        const lastAssistant = [...projected]
          .reverse()
          .find((i) => i.kind === "message" && i.role === "assistant");
        const lastText =
          lastAssistant && lastAssistant.kind === "message"
            ? lastAssistant.text?.trim() || ""
            : "";
        if (liveText.trim().length > lastText.length) {
          const baseId = `agent-stage-live:${projection?.runId}:${stage?.id}`;
          return [
            ...projected.filter((i) => i.id !== lastAssistant?.id),
            {
              id: `${baseId}:assistant`,
              kind: "message" as const,
              role: "assistant" as const,
              text: liveText.trim(),
              isFinal: false,
            },
          ];
        }
      }
      return projected;
    }
    return synthetic;
  }, [
    useProjection,
    projected,
    synthetic,
    isLive,
    liveText,
    projection?.runId,
    stage?.id,
  ]);

  // startedAt 稳定：优先 projection；无则在进入 live 时钉住一次
  const stableStartedAt = useMemo(() => {
    if (!isLive || !stage) return null;
    if (stage.startedAt && stage.startedAt > 0) return stage.startedAt;
    return Date.now();
    // 仅在进入 live / 换 stage 时重算
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isLive, stage?.id, stage?.attemptId, stage?.startedAt]);

  return {
    items,
    source: useProjection ? "projection" : "synthetic",
    processingStartedAt: stableStartedAt,
  };
}
