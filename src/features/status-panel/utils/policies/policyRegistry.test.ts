import { describe, expect, it } from "vitest";
import type { CheckpointValidationEvidence } from "../../types";
import {
  composePolicyVerdict,
  createCheckpointAuditBuffer,
  createCheckpointAuditEntry,
  createDefaultCheckpointPolicies,
  createPolicyRegistry,
  evaluateCheckpointPolicies,
  evaluateCheckpointPoliciesShadow,
} from "./policyRegistry";
import type { PolicyDecision } from "./policyTypes";

function validation(
  kind: CheckpointValidationEvidence["kind"],
  status: CheckpointValidationEvidence["status"],
): CheckpointValidationEvidence {
  return { kind, status, sourceId: `${kind}-${status}` };
}

describe("checkpoint policy registry", () => {
  it("keeps core policy registered and optional policies replaceable", () => {
    const registry = createPolicyRegistry();
    expect(registry.listPolicies().map((policy) => policy.id)).toEqual([
      "core",
      "lintValidationPolicy",
      "typecheckValidationPolicy",
      "testsValidationPolicy",
    ]);
    registry.unregisterPolicy("core");
    expect(registry.listPolicies().some((policy) => policy.id === "core")).toBe(true);
    registry.unregisterPolicy("lintValidationPolicy");
    expect(registry.listPolicies().some((policy) => policy.id === "lintValidationPolicy")).toBe(false);
  });

  it("uses most severe contribution and keeps tie decisions in registration order", () => {
    const decisions: PolicyDecision[] = [
      {
        verdictContribution: "ready",
        reason: "ready",
        severity: "info",
        source: "first",
      },
      {
        verdictContribution: "needs_review",
        reason: "review-a",
        severity: "warn",
        source: "second",
      },
      {
        verdictContribution: "needs_review",
        reason: "review-b",
        severity: "warn",
        source: "third",
      },
    ];
    expect(composePolicyVerdict(decisions)).toBe("needs_review");
    expect(decisions.map((decision) => decision.reason)).toEqual([
      "ready",
      "review-a",
      "review-b",
    ]);
  });

  it("evaluates first-batch validation policies without optional blocked contribution", () => {
    const result = evaluateCheckpointPolicies({
      coreVerdict: "ready",
      validations: [
        validation("lint", "pass"),
        validation("typecheck", "fail"),
        validation("tests", "running"),
      ],
    });
    expect(result.finalVerdict).toBe("needs_review");
    expect(result.decisions.find((decision) => decision.source === "typecheckValidationPolicy")).toMatchObject({
      verdictContribution: "needs_review",
      severity: "warn",
    });
    expect(
      result.decisions
        .filter((decision) => decision.source !== "core")
        .some((decision) => decision.verdictContribution === "blocked"),
    ).toBe(false);
  });

  it("covers pass fail running not_run and not_observed validation states", () => {
    const statuses: CheckpointValidationEvidence["status"][] = [
      "pass",
      "fail",
      "running",
      "not_run",
      "not_observed",
    ];
    const decisions = statuses.map((status) =>
      evaluateCheckpointPolicies({
        coreVerdict: "ready",
        validations: [validation("tests", status)],
      }).decisions.find((decision) => decision.source === "testsValidationPolicy"),
    );
    expect(decisions.map((decision) => decision?.verdictContribution)).toEqual([
      "ready",
      "needs_review",
      "running",
      "needs_review",
      "no_contribution",
    ]);
  });

  it("bounds audit trail in memory without filesystem side effects", () => {
    const buffer = createCheckpointAuditBuffer(2);
    for (const occurredAt of [
      "2026-05-17T00:00:00.000Z",
      "2026-05-17T00:00:01.000Z",
      "2026-05-17T00:00:02.000Z",
    ]) {
      buffer.add(
        createCheckpointAuditEntry({
          evidence: { coreVerdict: "ready", validations: [] },
          finalVerdict: "ready",
          decisions: [],
          occurredAt,
        }),
      );
    }
    expect(buffer.list().map((entry) => entry.occurredAt)).toEqual([
      "2026-05-17T00:00:01.000Z",
      "2026-05-17T00:00:02.000Z",
    ]);
  });

  it("exports default policies as pure in-memory values", () => {
    expect(createDefaultCheckpointPolicies().every((policy) => typeof policy.evaluate === "function")).toBe(true);
  });

  it("supports shadow evaluation against the legacy checkpoint verdict without rerouting runtime", () => {
    const matching = evaluateCheckpointPoliciesShadow({
      coreVerdict: "needs_review",
      validations: [
        validation("lint", "not_observed"),
        validation("typecheck", "not_observed"),
        validation("tests", "not_observed"),
      ],
    });
    expect(matching).toMatchObject({
      legacyVerdict: "needs_review",
      policyVerdict: "needs_review",
      matchesLegacyVerdict: true,
    });

    const diverging = evaluateCheckpointPoliciesShadow({
      coreVerdict: "ready",
      validations: [validation("tests", "fail")],
    });
    expect(diverging).toMatchObject({
      legacyVerdict: "ready",
      policyVerdict: "needs_review",
      matchesLegacyVerdict: false,
    });
  });
});
