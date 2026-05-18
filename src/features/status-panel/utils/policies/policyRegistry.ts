import type { CheckpointVerdict } from "../../types";
import { corePolicy } from "./corePolicy";
import type {
  CheckpointAuditEntry,
  CheckpointPolicyEvidence,
  Policy,
  PolicyDecision,
  PolicyVerdictContribution,
} from "./policyTypes";
import { FIRST_BATCH_VALIDATION_POLICIES } from "./validationPolicies";

const VERDICT_SEVERITY: Record<PolicyVerdictContribution, number> = {
  no_contribution: 0,
  ready: 1,
  running: 2,
  needs_review: 3,
  blocked: 4,
};

export const CHECKPOINT_POLICY_AUDIT_LIMIT = 50;

export function createDefaultCheckpointPolicies(): readonly Policy[] {
  return [corePolicy, ...FIRST_BATCH_VALIDATION_POLICIES];
}

export function createPolicyRegistry(
  initialPolicies: readonly Policy[] = createDefaultCheckpointPolicies(),
) {
  const policies = new Map<string, Policy>();
  for (const policy of initialPolicies) {
    policies.set(policy.id, policy);
  }
  return {
    registerPolicy(policy: Policy): void {
      policies.set(policy.id, policy);
    },
    unregisterPolicy(id: string): void {
      if (id === corePolicy.id) {
        return;
      }
      policies.delete(id);
    },
    listPolicies(): readonly Policy[] {
      return [...policies.values()];
    },
  };
}

export function composePolicyVerdict(
  decisions: readonly PolicyDecision[],
  fallbackVerdict: CheckpointVerdict = "needs_review",
): CheckpointVerdict {
  const winner = decisions
    .filter((decision) => decision.verdictContribution !== "no_contribution")
    .reduce<PolicyVerdictContribution>(
      (current, decision) =>
        VERDICT_SEVERITY[decision.verdictContribution] > VERDICT_SEVERITY[current]
          ? decision.verdictContribution
          : current,
      "no_contribution",
    );
  return winner === "no_contribution" ? fallbackVerdict : winner;
}

export function evaluateCheckpointPolicies(
  evidence: CheckpointPolicyEvidence,
  policies: readonly Policy[] = createDefaultCheckpointPolicies(),
): {
  finalVerdict: CheckpointVerdict;
  decisions: readonly PolicyDecision[];
} {
  const decisions = policies
    .filter((policy) => policy.appliesTo(evidence))
    .map((policy) => policy.evaluate(evidence));
  return {
    finalVerdict: composePolicyVerdict(decisions, evidence.coreVerdict ?? "needs_review"),
    decisions,
  };
}

export function evaluateCheckpointPoliciesShadow(
  evidence: CheckpointPolicyEvidence,
  policies: readonly Policy[] = createDefaultCheckpointPolicies(),
): {
  legacyVerdict: CheckpointVerdict | null;
  policyVerdict: CheckpointVerdict;
  matchesLegacyVerdict: boolean;
  decisions: readonly PolicyDecision[];
} {
  const result = evaluateCheckpointPolicies(evidence, policies);
  const legacyVerdict = evidence.coreVerdict ?? null;
  return {
    legacyVerdict,
    policyVerdict: result.finalVerdict,
    matchesLegacyVerdict: legacyVerdict === result.finalVerdict,
    decisions: result.decisions,
  };
}

export function createCheckpointAuditBuffer(limit = CHECKPOINT_POLICY_AUDIT_LIMIT) {
  const entries: CheckpointAuditEntry[] = [];
  return {
    add(entry: CheckpointAuditEntry): void {
      entries.push(entry);
      while (entries.length > limit) {
        entries.shift();
      }
    },
    list(): readonly CheckpointAuditEntry[] {
      return [...entries];
    },
  };
}

export function createCheckpointAuditEntry(input: {
  evidence: CheckpointPolicyEvidence;
  finalVerdict: CheckpointVerdict;
  decisions: readonly PolicyDecision[];
  occurredAt: string;
}): CheckpointAuditEntry {
  return {
    occurredAt: input.occurredAt,
    finalVerdict: input.finalVerdict,
    decisions: input.decisions,
    evidenceSnapshot: {
      validations: input.evidence.validations,
    },
  };
}
