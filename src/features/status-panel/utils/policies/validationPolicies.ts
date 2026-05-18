import type {
  CheckpointValidationEvidence,
  CheckpointValidationKind,
} from "../../types";
import type { Policy, PolicyDecision } from "./policyTypes";

const VALIDATION_POLICY_KIND_BY_ID = {
  lintValidationPolicy: "lint",
  typecheckValidationPolicy: "typecheck",
  testsValidationPolicy: "tests",
} as const satisfies Record<string, CheckpointValidationKind>;

function latestValidation(
  validations: readonly CheckpointValidationEvidence[],
  kind: CheckpointValidationKind,
): CheckpointValidationEvidence | null {
  return validations.find((entry) => entry.kind === kind) ?? null;
}

function decisionForValidation(
  policyId: keyof typeof VALIDATION_POLICY_KIND_BY_ID,
  validation: CheckpointValidationEvidence,
): PolicyDecision {
  const reasonPrefix = `statusPanel.policy.${policyId}`;
  switch (validation.status) {
    case "fail":
      return {
        verdictContribution: "needs_review",
        reason: `${reasonPrefix}.failed`,
        severity: "warn",
        source: policyId,
        detail: { kind: validation.kind, status: validation.status },
      };
    case "running":
      return {
        verdictContribution: "running",
        reason: `${reasonPrefix}.running`,
        severity: "info",
        source: policyId,
        detail: { kind: validation.kind, status: validation.status },
      };
    case "pass":
      return {
        verdictContribution: "ready",
        reason: `${reasonPrefix}.passed`,
        severity: "info",
        source: policyId,
        detail: { kind: validation.kind, status: validation.status },
      };
    case "not_run":
      return {
        verdictContribution: "needs_review",
        reason: `${reasonPrefix}.notRun`,
        severity: "warn",
        source: policyId,
        detail: { kind: validation.kind, status: validation.status },
      };
    case "not_observed":
      return {
        verdictContribution: "no_contribution",
        reason: `${reasonPrefix}.notObserved`,
        severity: "info",
        source: policyId,
        detail: { kind: validation.kind, status: validation.status },
      };
  }
}

function createValidationPolicy(
  id: keyof typeof VALIDATION_POLICY_KIND_BY_ID,
): Policy {
  const kind = VALIDATION_POLICY_KIND_BY_ID[id];
  return {
    id,
    appliesTo: (evidence) => latestValidation(evidence.validations, kind) !== null,
    evaluate: (evidence) => {
      const validation = latestValidation(evidence.validations, kind);
      if (!validation) {
        return {
          verdictContribution: "no_contribution",
          reason: `statusPanel.policy.${id}.missing`,
          severity: "info",
          source: id,
        };
      }
      return decisionForValidation(id, validation);
    },
  };
}

export const lintValidationPolicy = createValidationPolicy("lintValidationPolicy");
export const typecheckValidationPolicy = createValidationPolicy("typecheckValidationPolicy");
export const testsValidationPolicy = createValidationPolicy("testsValidationPolicy");

export const FIRST_BATCH_VALIDATION_POLICIES = [
  lintValidationPolicy,
  typecheckValidationPolicy,
  testsValidationPolicy,
] as const satisfies readonly Policy[];
