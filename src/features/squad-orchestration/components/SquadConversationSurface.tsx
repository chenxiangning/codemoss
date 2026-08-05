import { useEffect, useMemo, useState } from "react";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Octagon from "lucide-react/dist/esm/icons/octagon";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import UsersRound from "lucide-react/dist/esm/icons/users-round";
import { useTranslation } from "react-i18next";

import { pushErrorToast } from "../../../services/toasts";
import { isSharedSessionThreadId } from "../../shared-session/utils/sharedSessionIdentity";
import { isSquadOrchestrationEnabled } from "../runtime/squadFeatureFlag";
import {
  approveAndExecuteSquad,
  hydrateSquadProjection,
  stopSquad,
} from "../runtime/squadExecutor";
import {
  claimSquadHydration,
  openSquadInspector,
  useSquadEvidenceRunId,
  useSquadProjection,
} from "../store/squadStore";
import { isTerminalSquadStatus } from "../types";
import { SquadPlanEditor } from "./SquadPlanEditor";
import { SquadStopDialog } from "./SquadStopDialog";

type SquadConversationSurfaceProps = {
  workspaceId: string | null | undefined;
  threadId: string | null | undefined;
};

function diagnostic(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SquadConversationSurface({
  workspaceId,
  threadId,
}: SquadConversationSurfaceProps) {
  const { t } = useTranslation();
  const projection = useSquadProjection(workspaceId, threadId);
  const evidenceRunId = useSquadEvidenceRunId(workspaceId, threadId);
  const [busyAction, setBusyAction] = useState<"approve" | "stop" | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);

  useEffect(() => {
    if (
      !isSquadOrchestrationEnabled() ||
      !workspaceId ||
      !threadId ||
      !isSharedSessionThreadId(threadId) ||
      !evidenceRunId ||
      projection?.runId === evidenceRunId ||
      !claimSquadHydration(workspaceId, threadId, evidenceRunId)
    ) {
      return;
    }
    void hydrateSquadProjection(workspaceId, threadId, evidenceRunId).catch(
      (error) => {
        console.warn(
          `[squad-hydration] failed for ${workspaceId}/${threadId}/${evidenceRunId}`,
          error,
        );
      },
    );
  }, [evidenceRunId, projection?.runId, threadId, workspaceId]);

  const completedCount = useMemo(
    () =>
      projection?.nodes.filter((node) => node.status === "succeeded").length ??
      0,
    [projection],
  );
  if (!workspaceId || !threadId || !projection) return null;

  const openInspector = () =>
    openSquadInspector({
      workspaceId,
      threadId,
      runId: projection.runId,
    });
  const approve = async () => {
    if (busyAction) return;
    setBusyAction("approve");
    try {
      await approveAndExecuteSquad(
        workspaceId,
        threadId,
        projection.runId,
        projection.planRevision,
      );
    } catch (error) {
      pushErrorToast({
        title: t("squadOrchestration.errors.startFailed"),
        message: t("squadOrchestration.errors.approvalFailed", {
          diagnostic: diagnostic(error),
        }),
      });
    } finally {
      setBusyAction(null);
    }
  };
  const stop = async () => {
    if (busyAction) return;
    setBusyAction("stop");
    try {
      await stopSquad(workspaceId, threadId, projection.runId);
    } catch (error) {
      pushErrorToast({
        title: t("squadOrchestration.errors.stopFailedTitle"),
        message: t("squadOrchestration.errors.stopFailed", {
          diagnostic: diagnostic(error),
        }),
      });
    } finally {
      setBusyAction(null);
      setStopDialogOpen(false);
    }
  };

  return (
    <section className="squad-conversation-surface" aria-live="polite">
      <div className="squad-conversation-card">
        <div className="squad-card-heading">
          <div className="squad-card-icon" aria-hidden="true">
            <UsersRound size={16} />
          </div>
          <div className="squad-card-title-wrap">
            <strong>
              {projection.status === "planning"
                ? t("squadOrchestration.card.planningTitle")
                : projection.status === "awaiting-approval"
                  ? t("squadOrchestration.card.planTitle")
                  : t("squadOrchestration.card.runTitle")}
            </strong>
            <span>{projection.requestText}</span>
          </div>
          <span className={`squad-status-pill is-${projection.status}`}>
            {t(`squadOrchestration.status.${projection.status}`)}
          </span>
        </div>

        {projection.status === "awaiting-approval" && projection.plan ? (
          <>
            <p className="squad-plan-summary">{projection.plan.summary}</p>
            <div
              className="squad-plan-budget"
              aria-label={t("squadOrchestration.fields.budget")}
            >
              <span>RO × {projection.plan.budget.maxParallelReadOnly}</span>
              <span>
                {t("squadOrchestration.fields.nodeAttempts")} ×{" "}
                {projection.plan.budget.maxNodeAttempts}
              </span>
              <span>
                {t("squadOrchestration.fields.repairs")} ×{" "}
                {projection.plan.budget.maxRepairAttempts}
              </span>
              <span>{projection.plan.budget.maxWallClockSeconds}s</span>
            </div>
            <div className="squad-plan-node-strip">
              {projection.plan.nodes.map((node) => (
                <button
                  type="button"
                  key={node.id}
                  onClick={() =>
                    openSquadInspector({
                      workspaceId,
                      threadId,
                      runId: projection.runId,
                      nodeId: node.id,
                    })
                  }
                >
                  <span>{node.kind}</span>
                  {node.title}
                  <small>
                    {node.permission} ·{" "}
                    {node.dependsOn.length > 0
                      ? node.dependsOn.join(" + ")
                      : t("squadOrchestration.fields.rootNode")}
                  </small>
                </button>
              ))}
            </div>
            {editingPlan ? (
              <SquadPlanEditor
                workspaceId={workspaceId}
                threadId={threadId}
                runId={projection.runId}
                revision={projection.planRevision}
                plan={projection.plan}
                onClose={() => setEditingPlan(false)}
              />
            ) : null}
          </>
        ) : projection.plan ? (
          <div className="squad-progress-row">
            <div className="squad-progress-track" aria-hidden="true">
              <span
                style={{
                  width: `${Math.round((completedCount / projection.nodes.length) * 100) || 0}%`,
                }}
              />
            </div>
            <span>
              {completedCount}/{projection.nodes.length}{" "}
              {t("squadOrchestration.fields.nodes")}
            </span>
          </div>
        ) : (
          <p className="squad-plan-summary">
            {t("squadOrchestration.card.planningHint")}
          </p>
        )}

        <div className="squad-card-actions">
          <button
            type="button"
            className="squad-secondary-action"
            data-inspector-return-focus
            onClick={openInspector}
          >
            {t("squadOrchestration.actions.viewDetails")}{" "}
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          {projection.status === "awaiting-approval" ? (
            <>
              <button
                type="button"
                className="squad-secondary-action"
                disabled={busyAction !== null}
                onClick={() => setEditingPlan((editing) => !editing)}
              >
                <Pencil size={12} aria-hidden="true" />
                {t("squadOrchestration.actions.editPlan")}
              </button>
              <button
                type="button"
                className="squad-primary-action"
                disabled={busyAction !== null || editingPlan}
                onClick={() => void approve()}
              >
                {busyAction === "approve"
                  ? t("squadOrchestration.actions.approving")
                  : t("squadOrchestration.actions.confirmExecute")}
              </button>
            </>
          ) : !isTerminalSquadStatus(projection.status) ? (
            <button
              type="button"
              className="squad-stop-action"
              disabled={
                busyAction !== null || projection.status === "cancelling"
              }
              onClick={() => setStopDialogOpen(true)}
            >
              <Octagon size={13} aria-hidden="true" />
              {projection.status === "cancelling"
                ? t("squadOrchestration.actions.stopping")
                : t("squadOrchestration.actions.stop")}
            </button>
          ) : null}
        </div>
      </div>
      <SquadStopDialog
        open={stopDialogOpen}
        busy={busyAction === "stop"}
        onOpenChange={setStopDialogOpen}
        onConfirm={() => void stop()}
      />
    </section>
  );
}
