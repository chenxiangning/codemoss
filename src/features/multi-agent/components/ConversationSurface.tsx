import { useEffect, useState } from "react";
import Check from "lucide-react/dist/esm/icons/check";
import Circle from "lucide-react/dist/esm/icons/circle";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import Octagon from "lucide-react/dist/esm/icons/octagon";
import UsersRound from "lucide-react/dist/esm/icons/users-round";
import { useTranslation } from "react-i18next";

import { pushErrorToast } from "../../../services/toasts";
import { isSharedSessionThreadId } from "../../shared-session/utils/sharedSessionIdentity";
import {
  approveAndExecuteAgent,
  hydrateAgentProjection,
  stopAgent,
} from "../runtime/executor";
import { isMultiAgentEnabled } from "../runtime/featureFlag";
import {
  claimAgentHydration,
  useAgentEvidenceRunId,
  useAgentProjection,
} from "../store/agentStore";
import {
  openAgentInspector,
  selectAgentStage,
} from "../store/inspectorStore";
import {
  isTerminalAgentStatus,
  targetBadge,
  type AgentStageProjection,
  type AgentStageStatus,
} from "../types";

type ConversationSurfaceProps = {
  workspaceId: string | null | undefined;
  threadId: string | null | undefined;
};

function diagnostic(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function StageIcon({ status }: { status: AgentStageStatus }) {
  if (status === "succeeded") return <Check size={13} aria-hidden="true" />;
  if (status === "running")
    return (
      <LoaderCircle size={13} className="multi-agent-spin" aria-hidden="true" />
    );
  if (status === "failed") return <Octagon size={12} aria-hidden="true" />;
  return <Circle size={11} aria-hidden="true" />;
}

export function MultiAgentConversationSurface({
  workspaceId,
  threadId,
}: ConversationSurfaceProps) {
  const { t } = useTranslation();
  const projection = useAgentProjection(workspaceId, threadId);
  const evidenceRunId = useAgentEvidenceRunId(workspaceId, threadId);
  const [busy, setBusy] = useState<"approve" | "stop" | null>(null);

  useEffect(() => {
    if (
      !isMultiAgentEnabled() ||
      !workspaceId ||
      !threadId ||
      !isSharedSessionThreadId(threadId) ||
      !evidenceRunId ||
      projection?.runId === evidenceRunId ||
      !claimAgentHydration(workspaceId, threadId, evidenceRunId)
    ) {
      return;
    }
    void hydrateAgentProjection(workspaceId, threadId, evidenceRunId).catch(
      (error) => {
        console.warn("[multi-agent] hydrate failed", error);
      },
    );
  }, [evidenceRunId, projection?.runId, threadId, workspaceId]);

  if (!workspaceId || !threadId || !projection) return null;

  const stages = projection.stages ?? [];

  const openStage = (stage: AgentStageProjection) => {
    openAgentInspector({
      workspaceId,
      threadId,
      runId: projection.runId,
      stageId: stage.id,
    });
    selectAgentStage(stage.id);
  };

  const approve = async () => {
    if (busy) return;
    setBusy("approve");
    try {
      await approveAndExecuteAgent(
        workspaceId,
        threadId,
        projection.runId,
        projection.planRevision,
      );
    } catch (error) {
      pushErrorToast({
        title: t("multiAgent.errors.startFailed"),
        message: t("multiAgent.errors.approvalFailed", {
          diagnostic: diagnostic(error),
        }),
      });
    } finally {
      setBusy(null);
    }
  };

  const stop = async () => {
    if (busy) return;
    setBusy("stop");
    try {
      await stopAgent(workspaceId, threadId, projection.runId);
    } catch (error) {
      pushErrorToast({
        title: t("multiAgent.errors.stopFailedTitle"),
        message: t("multiAgent.errors.stopFailed", {
          diagnostic: diagnostic(error),
        }),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="multi-agent-surface" aria-live="polite">
      <div className="multi-agent-card">
        <div className="multi-agent-card-heading">
          <div className="multi-agent-card-icon" aria-hidden="true">
            <UsersRound size={16} />
          </div>
          <div className="multi-agent-card-title">
            <strong>{t("multiAgent.card.runTitle")}</strong>
            <span>{projection.requestText}</span>
          </div>
          <span className={`multi-agent-status is-${projection.status}`}>
            {t(`multiAgent.status.${projection.status}`, {
              defaultValue: projection.status,
            })}
          </span>
        </div>

        <p className="multi-agent-hint">{t("multiAgent.card.orchestrationHint")}</p>

        {/* 主幕布：编排组合 + 环节状态（点开分屏看该节点直播） */}
        <div
          className="multi-agent-stage-list"
          aria-label={t("multiAgent.lifecycle.aria")}
        >
          {stages.map((stage, index) => (
            <button
              type="button"
              key={stage.id}
              className={`multi-agent-stage-card is-${stage.status}`}
              onClick={() => openStage(stage)}
            >
              <span className="multi-agent-stage-index">{index + 1}</span>
              <span className="multi-agent-stage-icon">
                <StageIcon status={stage.status} />
              </span>
              <span className="multi-agent-stage-body">
                <strong>{stage.title || stage.id}</strong>
                <small className="multi-agent-stage-badge">
                  {targetBadge(stage.target)}
                </small>
                {stage.shortOutcome ? (
                  <em className="multi-agent-stage-outcome">
                    {stage.shortOutcome}
                  </em>
                ) : (
                  <em className="multi-agent-stage-outcome is-muted">
                    {t(`multiAgent.stageStatus.${stage.status}`, {
                      defaultValue: stage.status,
                    })}
                  </em>
                )}
              </span>
            </button>
          ))}
        </div>

        {(projection.diagnostics ?? []).length > 0 ? (
          <div className="multi-agent-diagnostics" role="alert">
            {(projection.diagnostics ?? []).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        ) : null}

        {projection.status === "awaiting-approval" && projection.plan ? (
          <div className="multi-agent-plan">
            <p className="multi-agent-plan-summary">{projection.plan.summary}</p>
            {(projection.plan.steps ?? []).length > 0 ? (
              <ol className="multi-agent-plan-steps">
                {(projection.plan.steps ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
            <p className="multi-agent-hint is-muted">
              {t("multiAgent.card.confirmHint")}
            </p>
          </div>
        ) : null}

        {projection.status === "succeeded" && projection.finalSummary ? (
          <div className="multi-agent-final-box">
            <strong>{t("multiAgent.card.finalTitle")}</strong>
            <p className="multi-agent-final">{projection.finalSummary}</p>
          </div>
        ) : null}

        <div className="multi-agent-actions">
          {projection.status === "awaiting-approval" ? (
            <button
              type="button"
              className="multi-agent-primary"
              disabled={busy !== null}
              onClick={() => void approve()}
            >
              {busy === "approve"
                ? t("multiAgent.actions.approving")
                : t("multiAgent.actions.confirmExecute")}
            </button>
          ) : null}
          {!isTerminalAgentStatus(projection.status) ? (
            <button
              type="button"
              className="multi-agent-stop"
              disabled={busy !== null}
              onClick={() => void stop()}
            >
              <Octagon size={13} aria-hidden="true" />
              {busy === "stop"
                ? t("multiAgent.actions.stopping")
                : t("multiAgent.actions.stop")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
