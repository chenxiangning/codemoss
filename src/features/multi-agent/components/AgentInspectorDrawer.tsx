import { useSyncExternalStore } from "react";
import X from "lucide-react/dist/esm/icons/x";
import { useTranslation } from "react-i18next";

import {
  getAgentLivePhase,
  subscribeAgentLivePhase,
} from "../runtime/livePhaseChannel";
import {
  closeAgentInspector,
  selectAgentStage,
  useAgentInspectorSelection,
} from "../store/inspectorStore";
import { useAgentProjection } from "../store/agentStore";
import { targetBadge } from "../types";

function useLivePhase(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
) {
  return useSyncExternalStore(
    subscribeAgentLivePhase,
    () => getAgentLivePhase(workspaceId, threadId),
    () => null,
  );
}

export function AgentInspectorDrawer() {
  const { t } = useTranslation();
  const selection = useAgentInspectorSelection();
  const projection = useAgentProjection(
    selection?.workspaceId,
    selection?.threadId,
  );
  const live = useLivePhase(selection?.workspaceId, selection?.threadId);

  if (!selection || !projection || projection.runId !== selection.runId) {
    return null;
  }

  const stages = projection.stages ?? [];
  const selectedStageId =
    selection.stageId ||
    stages.find((stage) => stage.status === "running")?.id ||
    stages[0]?.id ||
    null;
  const selectedStage =
    stages.find((stage) => stage.id === selectedStageId) ?? null;

  const liveText = live?.text?.trim() ?? "";
  const body =
    (live?.phase === selectedStageId || !selectedStageId ? liveText : "") ||
    (selectedStage?.id === "plan" ? projection.plan?.markdown?.trim() : "") ||
    selectedStage?.shortOutcome ||
    t("multiAgent.inspector.emptyLive");

  return (
    <aside
      className="multi-agent-inspector"
      aria-label={t("multiAgent.inspector.aria")}
    >
      <header className="multi-agent-inspector-header">
        <div className="min-w-0">
          <div className="multi-agent-inspector-title-row">
            <strong tabIndex={-1} data-inspector-initial-focus>
              {t("multiAgent.inspector.title")}
            </strong>
            <span className={`multi-agent-status is-${projection.status}`}>
              {t(`multiAgent.status.${projection.status}`, {
                defaultValue: projection.status,
              })}
            </span>
          </div>
          <div className="multi-agent-inspector-sub">
            {selectedStage
              ? `${selectedStage.title} · ${targetBadge(selectedStage.target)}`
              : t("multiAgent.inspector.phaseIdle")}
          </div>
        </div>
        <button
          type="button"
          className="multi-agent-inspector-close"
          onClick={closeAgentInspector}
          aria-label={t("multiAgent.inspector.close")}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="multi-agent-inspector-phases">
        {stages.map((stage) => (
          <button
            type="button"
            key={stage.id}
            className={`multi-agent-phase-chip is-${stage.status}${
              stage.id === selectedStageId ? " is-selected" : ""
            }`}
            onClick={() => selectAgentStage(stage.id)}
          >
            {stage.title}
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

      <div className="multi-agent-inspector-stream" aria-live="polite">
        <pre>{body}</pre>
      </div>
    </aside>
  );
}
