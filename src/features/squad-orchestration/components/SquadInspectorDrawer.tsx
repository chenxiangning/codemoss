import { useMemo, useState } from "react";
import Check from "lucide-react/dist/esm/icons/check";
import Circle from "lucide-react/dist/esm/icons/circle";
import Octagon from "lucide-react/dist/esm/icons/octagon";
import X from "lucide-react/dist/esm/icons/x";
import { useTranslation } from "react-i18next";

import { pushErrorToast } from "../../../services/toasts";
import { stopSquad } from "../runtime/squadExecutor";
import {
  closeSquadInspector,
  selectSquadNode,
  useSquadInspectorSelection,
  useSquadProjection,
} from "../store/squadStore";
import { isTerminalSquadStatus, type SquadNodeStatus } from "../types";
import { SquadStopDialog } from "./SquadStopDialog";

function statusIcon(status: SquadNodeStatus) {
  if (status === "succeeded") return <Check size={13} aria-hidden="true" />;
  if (["failed", "blocked", "cancelled"].includes(status)) {
    return <Octagon size={12} aria-hidden="true" />;
  }
  return <Circle size={11} aria-hidden="true" />;
}

export function SquadInspectorDrawer() {
  const { t } = useTranslation();
  const selection = useSquadInspectorSelection();
  const projection = useSquadProjection(
    selection?.workspaceId,
    selection?.threadId,
  );
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const selectedNode = useMemo(() => {
    if (!projection) return null;
    return (
      projection.nodes.find((node) => node.node.id === selection?.nodeId) ??
      projection.nodes.find((node) =>
        ["running", "prepared", "failed"].includes(node.status),
      ) ??
      projection.nodes[0] ??
      null
    );
  }, [projection, selection?.nodeId]);
  if (!selection || !projection || projection.runId !== selection.runId)
    return null;
  const latestAttempt = selectedNode?.attempts.at(-1) ?? null;

  const confirmStop = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await stopSquad(
        selection.workspaceId,
        selection.threadId,
        selection.runId,
      );
    } catch (error) {
      pushErrorToast({
        title: t("squadOrchestration.errors.stopFailedTitle"),
        message: t("squadOrchestration.errors.stopFailed", {
          diagnostic: error instanceof Error ? error.message : String(error),
        }),
      });
    } finally {
      setStopping(false);
      setStopDialogOpen(false);
    }
  };

  return (
    <aside
      className="subagent-inspector-drawer squad-inspector-drawer"
      aria-label={t("squadOrchestration.inspector.aria")}
    >
      <header className="subagent-inspector-header squad-inspector-header">
        <div className="subagent-inspector-identity">
          <div className="min-w-0">
            <div className="subagent-inspector-name-row">
              <strong
                className="subagent-inspector-name"
                tabIndex={-1}
                data-inspector-initial-focus
              >
                {t("squadOrchestration.inspector.title")}
              </strong>
              <span className={`squad-status-pill is-${projection.status}`}>
                {t(`squadOrchestration.status.${projection.status}`)}
              </span>
            </div>
            <div className="subagent-inspector-type">
              {t("squadOrchestration.inspector.revisionNodes", {
                revision: projection.planRevision,
                count: projection.nodes.length,
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="subagent-inspector-close"
          onClick={closeSquadInspector}
          aria-label={t("squadOrchestration.actions.closeInspector")}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="squad-inspector-command-bar">
        <span>
          {projection.plan?.summary ??
            t("squadOrchestration.card.planningTitle")}
        </span>
        {!isTerminalSquadStatus(projection.status) &&
        projection.status !== "awaiting-approval" ? (
          <button type="button" onClick={() => setStopDialogOpen(true)}>
            {t("squadOrchestration.actions.stop")}
          </button>
        ) : null}
      </div>

      <div className="squad-inspector-layout">
        <nav
          className="squad-dag-list"
          aria-label={t("squadOrchestration.inspector.dagAria")}
        >
          {projection.nodes.map((node) => (
            <button
              type="button"
              key={node.node.id}
              className={
                selectedNode?.node.id === node.node.id
                  ? "is-selected"
                  : undefined
              }
              onClick={() => selectSquadNode(node.node.id)}
            >
              <span className={`squad-node-state is-${node.status}`}>
                {statusIcon(node.status)}
              </span>
              <span className="squad-node-copy">
                <strong>{node.node.title}</strong>
                <small>
                  {node.node.kind} · {node.node.target.engine} ·{" "}
                  {t(`squadOrchestration.status.${node.status}`)}
                </small>
              </span>
            </button>
          ))}
        </nav>

        <div className="squad-node-detail">
          {selectedNode ? (
            <>
              <section>
                <span className="squad-detail-label">
                  {t("squadOrchestration.fields.goal")}
                </span>
                <h3>{selectedNode.node.title}</h3>
                <p>{selectedNode.node.goal}</p>
              </section>
              <section className="squad-detail-grid">
                <div>
                  <span className="squad-detail-label">
                    {t("squadOrchestration.fields.target")}
                  </span>
                  <strong>{selectedNode.node.target.engine}</strong>
                  <small>
                    {selectedNode.node.target.providerProfileNameSnapshot} ·{" "}
                    {selectedNode.node.target.model}
                  </small>
                </div>
                <div>
                  <span className="squad-detail-label">
                    {t("squadOrchestration.fields.authority")}
                  </span>
                  <strong>{selectedNode.node.permission}</strong>
                  <small>
                    {t("squadOrchestration.fields.maxAttempts", {
                      count: selectedNode.node.maxAttempts,
                    })}
                  </small>
                  <code title={projection.workspaceRoot}>
                    {projection.workspaceRoot}
                  </code>
                </div>
              </section>
              <section>
                <span className="squad-detail-label">
                  {t("squadOrchestration.fields.dependencies")}
                </span>
                <p>
                  {selectedNode.node.dependsOn.length > 0
                    ? selectedNode.node.dependsOn.join(" → ")
                    : t("squadOrchestration.fields.rootNode")}
                </p>
              </section>
              <section>
                <span className="squad-detail-label">
                  {t("squadOrchestration.fields.successCriteria")}
                </span>
                <ul>
                  {selectedNode.node.successCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </section>
              <section>
                <span className="squad-detail-label">
                  {t("squadOrchestration.fields.attempts")}
                </span>
                <div className="squad-attempt-list">
                  {selectedNode.attempts.length > 0 ? (
                    selectedNode.attempts.map((attempt, index) => (
                      <article key={attempt.attemptId}>
                        <strong>
                          #{index + 1} ·{" "}
                          {t(`squadOrchestration.status.${attempt.status}`)}
                        </strong>
                        <code>{attempt.attemptId}</code>
                      </article>
                    ))
                  ) : (
                    <p>{t("squadOrchestration.fields.noAttempts")}</p>
                  )}
                </div>
              </section>
              {latestAttempt?.contextPackage ? (
                <section>
                  <span className="squad-detail-label">
                    {t("squadOrchestration.fields.contextPackage")}
                  </span>
                  <div className="squad-context-package">
                    <strong>{latestAttempt.contextPackage.mode}</strong>
                    <code>{latestAttempt.contextPackage.packageId}</code>
                    <small>{latestAttempt.contextPackage.sourceChecksum}</small>
                    {latestAttempt.contextPackage.scope ? (
                      <pre>
                        {JSON.stringify(
                          latestAttempt.contextPackage.scope,
                          null,
                          2,
                        )}
                      </pre>
                    ) : null}
                  </div>
                </section>
              ) : null}
              {selectedNode.outcome ? (
                <section>
                  <span className="squad-detail-label">
                    {t("squadOrchestration.fields.typedOutcome")}
                  </span>
                  <p>{selectedNode.outcome.summary}</p>
                  {selectedNode.outcome.evidence.length > 0 ? (
                    <div className="squad-evidence-list">
                      {selectedNode.outcome.evidence.map((evidence, index) => (
                        <article key={`${evidence.label}-${index}`}>
                          <strong>{evidence.label}</strong>
                          <p>{evidence.detail}</p>
                          {evidence.path ? <code>{evidence.path}</code> : null}
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {selectedNode.outcome.changedPaths.length > 0 ? (
                    <div className="squad-path-list">
                      {selectedNode.outcome.changedPaths.map((path) => (
                        <code key={path}>{path}</code>
                      ))}
                    </div>
                  ) : null}
                  {selectedNode.outcome.artifacts.length > 0 ? (
                    <div className="squad-path-list">
                      {selectedNode.outcome.artifacts.map((artifact) => (
                        <code key={artifact}>{artifact}</code>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}
              {selectedNode.diagnostics.length > 0 ? (
                <section className="squad-diagnostics">
                  <span className="squad-detail-label">
                    {t("squadOrchestration.fields.diagnostics")}
                  </span>
                  {selectedNode.diagnostics.map((diagnostic) => (
                    <p key={diagnostic}>{diagnostic}</p>
                  ))}
                </section>
              ) : null}
            </>
          ) : (
            <div className="squad-empty-detail">
              {t("squadOrchestration.inspector.empty")}
            </div>
          )}
        </div>
      </div>
      <SquadStopDialog
        open={stopDialogOpen}
        busy={stopping}
        onOpenChange={setStopDialogOpen}
        onConfirm={() => void confirmStop()}
      />
    </aside>
  );
}
