import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  openAgentInspector,
  selectAgentRound,
  selectAgentStage,
} from "../store/inspectorStore";
import { getHistoryFoldByItemId } from "../store/historyFoldRegistry";
import type { AgentProjectionV1, AgentStageProjection } from "../types";
import { isTerminalAgentStatus } from "../types";
import {
  formatDurationMs,
  stageStatusText,
  stageTargetLabel,
} from "../utils/format";
import { collabDisplayTitle } from "../runtime/mainCanvasContextInjection";

/** 图3 样式：终态历史折叠卡（主幕布时间线内嵌） */
export function HistoryFoldCard({
  projection,
  roundIndex,
  workspaceId,
  threadId,
}: {
  projection: AgentProjectionV1;
  roundIndex: number;
  workspaceId: string;
  threadId: string;
}) {
  const { t } = useTranslation();
  const terminal = isTerminalAgentStatus(projection.status);
  // 进行中默认展开，便于主幕看到节点进度；终态默认折叠
  const [open, setOpen] = useState(!terminal);
  const stages = projection.stages ?? [];
  const done = stages.filter((stage) => stage.status === "succeeded").length;
  const first = stages[0]?.startedAt;
  const last = stages[stages.length - 1]?.settledAt;
  const dur = formatDurationMs(first, last) ?? "—";
  const title =
    collabDisplayTitle(projection, 36) ||
    t("multiAgent.card.roundTitle", { n: roundIndex + 1 });
  const flow = stages.map((stage) => stage.title || stage.id).join(" → ");
  const statusKey =
    projection.status === "cancelled"
      ? "cancelled"
      : projection.status === "failed"
        ? "failed"
        : projection.status === "succeeded"
          ? "succeeded"
          : projection.status;

  const openStage = (stage: AgentStageProjection) => {
    openAgentInspector({
      workspaceId,
      threadId,
      runId: projection.runId,
      stageId: stage.id,
      roundIndex,
    });
    selectAgentStage(stage.id);
  };

  const openPanel = () => {
    const stage =
      stages.find((s) => s.status === "running") ?? stages[0] ?? null;
    openAgentInspector({
      workspaceId,
      threadId,
      runId: projection.runId,
      stageId: stage?.id ?? null,
      roundIndex,
    });
    selectAgentRound({
      runId: projection.runId,
      roundIndex,
      stageId: stage?.id ?? null,
    });
  };

  return (
    <div
      className={`ma-hist-wrap ma-hist-wrap--timeline${open ? " is-open" : ""}`}
    >
      <div className="ma-hist">
        <span
          className={`ma-hist-ck${statusKey !== "succeeded" ? " is-muted" : ""}`}
          aria-hidden
        >
          {statusKey === "succeeded" ? "✓" : statusKey === "failed" ? "✗" : "○"}
        </span>
        <button
          type="button"
          className="ma-hist-body ma-hist-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="ma-hist-title">
            {t("multiAgent.card.histTitle", {
              n: roundIndex + 1,
              title,
            })}
          </div>
          <div className="ma-hist-meta">
            {terminal
              ? t("multiAgent.card.histMeta", {
                  done,
                  total: stages.length || 3,
                  dur,
                })
              : t("multiAgent.card.histMetaRunning", {
                  done,
                  total: stages.length || 3,
                })}
            {statusKey === "cancelled"
              ? ` · ${t("multiAgent.status.cancelled")}`
              : statusKey === "failed"
                ? ` · ${t("multiAgent.status.failed")}`
                : !terminal
                  ? ` · ${t(`multiAgent.status.${statusKey}`)}`
                  : ""}
          </div>
        </button>
        <button
          type="button"
          className="ma-hist-open"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open
            ? t("multiAgent.card.collapse")
            : t("multiAgent.card.expand")}
        </button>
      </div>
      <div
        className="ma-hist-full"
        hidden={!open}
        aria-hidden={!open}
      >
        <div className="ma-orch ma-orch--in-hist">
          <div className="ma-orch-head">
            <span className="ma-orch-t">
              {t("multiAgent.card.roundTitle", { n: roundIndex + 1 })}
            </span>
            <span className="ma-orch-tpl">{flow}</span>
            <span
              className={`ma-orch-st is-${statusKey === "succeeded" ? "done" : statusKey === "failed" ? "fail" : "run"}`}
            >
              {t(`multiAgent.status.${statusKey}`)}
            </span>
          </div>
          <div className="ma-prog" aria-hidden>
            <i
              style={{
                width:
                  statusKey === "succeeded"
                    ? "100%"
                    : `${Math.round((done / Math.max(stages.length, 1)) * 100)}%`,
                background:
                  statusKey === "succeeded"
                    ? "var(--ma-green, #4ade80)"
                    : undefined,
              }}
            />
          </div>
          {stages.map((stage) => (
            <button
              type="button"
              key={stage.id}
              className="ma-stage-row"
              onClick={() => openStage(stage)}
            >
              <i
                className={`ma-dot${stage.status === "succeeded" ? " is-done" : ""}`}
              />
              <span className="ma-stage-nm">{stage.title || stage.id}</span>
              <span className="ma-stage-tg">{stageTargetLabel(stage)}</span>
              <span className="ma-stage-st">
                {stageStatusText(stage, {
                  approved:
                    (stage.requiresApproval || stage.id === "plan") &&
                    Boolean(projection.approvedAt),
                })}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="ma-lk ma-hist-panel-link" onClick={openPanel}>
          {t("multiAgent.card.viewFullInPanel", { n: roundIndex + 1 })}
        </button>
      </div>
      {/* 交付汇总：主幕模型终态再跑一轮（executor），不在此卡拼接节点原文 */}
    </div>
  );
}

/**
 * 时间线行：根据 message id 取 registry 渲染。
 * conversationBridge 每次 publish 都 upsert item text，text diff 触发重渲染。
 */
export function MultiAgentHistoryFoldTimelineRow({
  itemId,
  workspaceId,
  threadId,
}: {
  itemId: string;
  workspaceId: string | null | undefined;
  threadId: string | null | undefined;
}) {
  const record = getHistoryFoldByItemId(itemId, workspaceId, threadId);
  if (!record || !workspaceId || !threadId) {
    return null;
  }
  if (
    record.workspaceId !== workspaceId ||
    record.threadId !== threadId
  ) {
    return null;
  }
  return (
    <HistoryFoldCard
      projection={record.projection}
      roundIndex={record.roundIndex}
      workspaceId={workspaceId}
      threadId={threadId}
    />
  );
}
