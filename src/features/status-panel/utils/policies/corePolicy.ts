import type { Policy } from "./policyTypes";

export const corePolicy: Policy = {
  id: "core",
  appliesTo: () => true,
  evaluate: (evidence) => ({
    verdictContribution: evidence.coreVerdict ?? "no_contribution",
    reason: "statusPanel.policy.core.currentVerdict",
    severity:
      evidence.coreVerdict === "blocked"
        ? "block"
        : evidence.coreVerdict === "needs_review"
          ? "warn"
          : "info",
    source: "core",
    detail: {
      delegatedToExistingCheckpoint: true,
    },
  }),
};
