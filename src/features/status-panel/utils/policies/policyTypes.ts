import type {
  CheckpointAction,
  CheckpointValidationEvidence,
  CheckpointVerdict,
} from "../../types";

export type PolicyVerdictContribution =
  | CheckpointVerdict
  | "no_contribution";

export type PolicyDecisionSeverity = "info" | "warn" | "block";

export type CheckpointPolicyEvidence = {
  validations: readonly CheckpointValidationEvidence[];
  coreVerdict?: CheckpointVerdict | null;
};

export type PolicyDecision = {
  verdictContribution: PolicyVerdictContribution;
  reason: string;
  repairAction?: CheckpointAction;
  severity: PolicyDecisionSeverity;
  source: string;
  detail?: Record<string, unknown>;
};

export type Policy = {
  id: string;
  appliesTo: (evidence: CheckpointPolicyEvidence) => boolean;
  evaluate: (evidence: CheckpointPolicyEvidence) => PolicyDecision;
};

export type CheckpointAuditEntry = {
  occurredAt: string;
  finalVerdict: CheckpointVerdict;
  decisions: readonly PolicyDecision[];
  evidenceSnapshot: {
    validations: readonly CheckpointValidationEvidence[];
  };
};
