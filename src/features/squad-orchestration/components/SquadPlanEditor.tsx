import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { reviseSquadPlan } from "../runtime/squadExecutor";
import type { SquadPlanProposalV1 } from "../types";

type SquadPlanEditorProps = {
  workspaceId: string;
  threadId: string;
  runId: string;
  revision: number;
  plan: SquadPlanProposalV1;
  onClose: () => void;
};

function boundedInteger(
  value: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value, 10);
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(parsed) ? parsed : minimum),
  );
}

export function SquadPlanEditor({
  workspaceId,
  threadId,
  runId,
  revision,
  plan,
  onClose,
}: SquadPlanEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(plan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(plan);
    setError(null);
  }, [plan, revision]);

  const updateBudget = (
    field: keyof SquadPlanProposalV1["budget"],
    value: number,
  ) => {
    setDraft((current) => {
      const budget = { ...current.budget, [field]: value };
      const nodes =
        field === "maxNodeAttempts"
          ? current.nodes.map((node) => ({
              ...node,
              maxAttempts: Math.min(node.maxAttempts, value),
            }))
          : current.nodes;
      return { ...current, budget, nodes };
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await reviseSquadPlan(workspaceId, threadId, runId, draft);
      onClose();
    } catch (saveError) {
      setError(
        t("squadOrchestration.errors.planRevisionFailed", {
          diagnostic:
            saveError instanceof Error ? saveError.message : String(saveError),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="squad-plan-editor"
      aria-label={t("squadOrchestration.planEditor.aria")}
    >
      <div className="squad-plan-editor-grid">
        <label>
          <span>{t("squadOrchestration.planEditor.parallel")}</span>
          <input
            type="number"
            min={1}
            max={4}
            value={draft.budget.maxParallelReadOnly}
            onChange={(event) =>
              updateBudget(
                "maxParallelReadOnly",
                boundedInteger(event.target.value, 1, 4),
              )
            }
          />
        </label>
        <label>
          <span>{t("squadOrchestration.planEditor.nodeAttempts")}</span>
          <input
            type="number"
            min={1}
            max={3}
            value={draft.budget.maxNodeAttempts}
            onChange={(event) =>
              updateBudget(
                "maxNodeAttempts",
                boundedInteger(event.target.value, 1, 3),
              )
            }
          />
        </label>
        <label>
          <span>{t("squadOrchestration.planEditor.repairs")}</span>
          <input
            type="number"
            min={0}
            max={2}
            value={draft.budget.maxRepairAttempts}
            onChange={(event) =>
              updateBudget(
                "maxRepairAttempts",
                boundedInteger(event.target.value, 0, 2),
              )
            }
          />
        </label>
        <label>
          <span>{t("squadOrchestration.planEditor.wallClock")}</span>
          <input
            type="number"
            min={60}
            max={7200}
            step={60}
            value={draft.budget.maxWallClockSeconds}
            onChange={(event) =>
              updateBudget(
                "maxWallClockSeconds",
                boundedInteger(event.target.value, 60, 7200),
              )
            }
          />
        </label>
      </div>
      <div className="squad-plan-editor-nodes">
        {draft.nodes.map((node, index) => (
          <label key={node.id}>
            <span>
              {node.title}
              <small>
                {node.target.engine} ·{" "}
                {t("squadOrchestration.planEditor.targetSealed")}
              </small>
            </span>
            <input
              type="number"
              aria-label={t("squadOrchestration.planEditor.nodeAttemptAria", {
                title: node.title,
              })}
              min={1}
              max={draft.budget.maxNodeAttempts}
              value={node.maxAttempts}
              onChange={(event) => {
                const maxAttempts = boundedInteger(
                  event.target.value,
                  1,
                  draft.budget.maxNodeAttempts,
                );
                setDraft((current) => ({
                  ...current,
                  nodes: current.nodes.map((candidate, candidateIndex) =>
                    candidateIndex === index
                      ? { ...candidate, maxAttempts }
                      : candidate,
                  ),
                }));
              }}
            />
          </label>
        ))}
      </div>
      {error ? (
        <p className="squad-plan-editor-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="squad-plan-editor-actions">
        <button
          type="button"
          className="squad-secondary-action"
          disabled={saving}
          onClick={onClose}
        >
          {t("squadOrchestration.actions.cancel")}
        </button>
        <button
          type="button"
          className="squad-primary-action"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving
            ? t("squadOrchestration.actions.saving")
            : t("squadOrchestration.actions.saveRevision")}
        </button>
      </div>
    </div>
  );
}
