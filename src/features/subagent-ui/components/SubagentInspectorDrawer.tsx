import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import X from "lucide-react/dist/esm/icons/x";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadSubagentStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import { useActiveCanvasSelector } from "../../layout/hooks/activeCanvasStore";
import { EngineTaskOutputInspector } from "../../engine-task-output/components/EngineTaskOutputInspector";
import { useEngineTaskOutputSnapshot } from "../../engine-task-output/hooks/useEngineTaskOutputSnapshot";
import { buildEngineTaskOutputSnapshot } from "../../engine-task-output/utils/engineTaskOutputProjection";
import {
  closeSubagentInspector,
  useSubagentInspectorSelection,
} from "../hooks/useSubagentInspectorStore";
import {
  isClaudeAsyncAgentLaunchOutput,
  resolveClaudeSubagentSessionFromContext,
  resolveSubagentSessionThreadId,
} from "../utils/subagentViewModel";
import { SubagentProgressBar } from "./SubagentProgressBar";
import { SubagentSessionCanvas } from "./SubagentSessionCanvas";

type SubagentInspectorDrawerProps = {
  className?: string;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

/**
 * 右侧子代理详情：persona 头 + 子会话幕布（与侧栏打开子代理 session 同源 Messages 渲染）。
 */
export const SubagentInspectorDrawer = memo(function SubagentInspectorDrawer({
  className,
  workspaceId = null,
  workspacePath = null,
}: SubagentInspectorDrawerProps) {
  const stylesReady = useFeatureStylesReady(loadSubagentStyles);
  const { t } = useTranslation();
  const card = useSubagentInspectorSelection();
  const parentThreadId = useActiveCanvasSelector((snapshot) => snapshot.threadId);
  const nativeThreadIds = useActiveCanvasSelector(
    (snapshot) => snapshot.activeNativeThreadIds,
  );
  const canvasItems = useActiveCanvasSelector((snapshot) => snapshot.items);
  const threadItemsByThread = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread,
  );
  const childSubagentThreads = useActiveCanvasSelector(
    (snapshot) => snapshot.childSubagentThreads,
  );

  useEffect(() => {
    if (!card) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSubagentInspector();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [card]);

  const parentItemsForResolve = useMemo(() => {
    const table =
      parentThreadId && threadItemsByThread
        ? threadItemsByThread[parentThreadId]
        : null;
    if (table && table.length > 0) return table;
    return canvasItems;
  }, [canvasItems, parentThreadId, threadItemsByThread]);

  const sessionThreadId = useMemo(() => {
    if (!card) {
      return null;
    }
    const fromCard =
      card.sessionThreadId?.trim() || card.taskOutput?.threadId?.trim() || null;
    // 已是合法引擎会话 id
    if (
      fromCard &&
      (fromCard.startsWith("claude:") ||
        fromCard.startsWith("grok:") ||
        fromCard.startsWith("kimi:") ||
        fromCard.startsWith("gemini:") ||
        fromCard.startsWith("opencode:") ||
        fromCard.startsWith("shared:"))
    ) {
      return fromCard;
    }
    // Shared Claude / DeepSeek：父线 items + child 列表 + native owner 宽解析
    const fromContext = resolveClaudeSubagentSessionFromContext({
      agentId: card.agentId || fromCard,
      outputText: card.outputText,
      nativeThreadIds,
      childThreadIds: childSubagentThreads.map((thread) => thread.id),
      parentItems: parentItemsForResolve,
    });
    if (fromContext) {
      return fromContext;
    }
    // 通用解析（含 Shared 其它引擎 / native Claude 父）
    const resolved = resolveSubagentSessionThreadId({
      parentThreadId: parentThreadId,
      agentId: card.agentId || fromCard,
      outputText: card.outputText,
      nativeThreadIds,
      explicitThreadId:
        fromCard && fromCard.includes(":") ? fromCard : null,
    });
    return resolved;
  }, [
    card,
    childSubagentThreads,
    nativeThreadIds,
    parentItemsForResolve,
    parentThreadId,
  ]);

  const isClaudeLaunchAck =
    Boolean(card) && isClaudeAsyncAgentLaunchOutput(card?.outputText);

  const taskOutputSnapshot = useMemo(() => {
    if (!card?.taskOutput?.outputFilePath?.trim()) {
      return null;
    }
    return buildEngineTaskOutputSnapshot(card.taskOutput, null);
  }, [card]);
  const taskOutputState = useEngineTaskOutputSnapshot({
    workspaceId,
    snapshot: taskOutputSnapshot,
  });

  if (!card) {
    return null;
  }
  if (!stylesReady) {
    return null;
  }

  const hasArtifactPath = Boolean(taskOutputSnapshot?.outputFilePath);
  // 有可加载 session 时优先幕布；artifact 仅作补充
  const showArtifactAsPrimary = hasArtifactPath && !sessionThreadId;
  const showArtifactAsSecondary = hasArtifactPath && Boolean(sessionThreadId);

  const artifactBlock =
    hasArtifactPath && taskOutputSnapshot ? (
      <div className="subagent-session-canvas-fallback">
        <EngineTaskOutputInspector
          snapshot={taskOutputState.snapshot ?? taskOutputSnapshot}
          refreshState={taskOutputState.refreshState}
          onRefresh={taskOutputState.refresh}
          className="border-border/60 bg-muted/30 shadow-none before:hidden"
        />
      </div>
    ) : null;

  const resultFallback =
    card.outputText?.trim() && !isClaudeLaunchAck ? (
      <div className="subagent-session-canvas-fallback">
        <div className="subagent-inspector-label">
          {t("subagentUi.fields.output", { defaultValue: "交付报告" })}
        </div>
        <pre className="subagent-session-canvas-fallback-body">
          {card.outputText.trim()}
        </pre>
      </div>
    ) : null;

  return (
    <aside
      className={cn("subagent-inspector-drawer", className)}
      aria-label={t("subagentUi.inspectorAria", { defaultValue: "子代理详情" })}
    >
      <header className="subagent-inspector-header">
        <div className="subagent-inspector-identity">
          <div className="min-w-0">
            <div className="subagent-inspector-name-row">
              <strong className="subagent-inspector-name">
                {t("subagentUi.defaultName", { defaultValue: "子代理" })}
              </strong>
              <span className="subagent-persona-index">{card.indexLabel}</span>
            </div>
            <div className="subagent-inspector-type" title={card.description}>
              {card.typeLabel}
              {card.description ? ` · ${card.description}` : ""}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="subagent-inspector-close"
          onClick={() => closeSubagentInspector()}
          aria-label={t("subagentUi.close", { defaultValue: "关闭" })}
        >
          <X size={16} aria-hidden />
        </Button>
      </header>

      <div className="subagent-inspector-meta-bar">
        <SubagentProgressBar progress={card.progress} status={card.status} />
      </div>

      <div className="subagent-inspector-body is-session-canvas">
        {/* 有 session 就开幕布：即使 output 仍是 launch ack（DeepSeek/Shared 常见） */}
        {sessionThreadId ? (
          <>
            <SubagentSessionCanvas
              sessionThreadId={sessionThreadId}
              workspaceId={workspaceId}
              workspacePath={workspacePath}
            />
            {showArtifactAsSecondary ? artifactBlock : null}
          </>
        ) : showArtifactAsPrimary ? (
          <>
            {artifactBlock}
            {resultFallback}
          </>
        ) : isClaudeLaunchAck ? (
          <div className="subagent-session-canvas-status">
            {t("subagentUi.claudeLaunchNoSession", {
              defaultValue:
                "已识别 Claude Agent 启动回执，但尚未关联到 claude:subagent 会话（native owner 可能仍在绑定/索引）。请稍后重试，或从左侧会话树打开对应子代理。",
            })}
            {card.agentId ? (
              <span className="subagent-session-canvas-error-detail">
                agentId: {card.agentId}
              </span>
            ) : null}
          </div>
        ) : card.outputText || card.description ? (
          <div className="subagent-session-canvas-fallback">
            <div className="subagent-inspector-label">
              {t("subagentUi.fields.output", { defaultValue: "交付报告" })}
            </div>
            <pre className="subagent-session-canvas-fallback-body">
              {card.outputText?.trim() || card.description}
            </pre>
          </div>
        ) : (
          <div className="subagent-session-canvas-status">
            {t("subagentUi.noSessionYet", {
              defaultValue:
                "尚未关联到子代理会话（agentId 未解析或 transcript 仍在索引中）。可从左侧会话树打开「子代理」行查看。",
            })}
          </div>
        )}
      </div>
    </aside>
  );
});
