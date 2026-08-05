import { describe, expect, it } from "vitest";

import type { SquadProjectionV1 } from "../types";
import {
  claimSquadHydration,
  findCanonicalSquadRunId,
  getSquadEvidenceRunId,
  getSquadProjection,
  isSquadAttempt,
  publishSquadProjection,
  registerSquadConversationEvidence,
  registerSquadAttempt,
} from "./squadStore";

function projection(runId: string): SquadProjectionV1 {
  return {
    schemaVersion: 1,
    runId,
    workspaceId: "workspace-id",
    workspaceRoot: "/workspace",
    sessionId: `shared:${runId}`,
    requestText: "task",
    leadTarget: {
      engine: "codex",
      providerProfileId: null,
      modelCatalogEntryId: "gpt-5",
      model: "gpt-5",
      providerProfileNameSnapshot: "Local",
      providerProfileSource: "local",
    },
    status: "planning",
    planRevision: 0,
    plan: null,
    nodes: [],
    activeAttemptIds: [],
    diagnostics: [],
    requestedAt: 1,
    approvedAt: null,
    updatedAt: 1,
  };
}

describe("Squad external store", () => {
  it("isolates projections by workspace and Shared Session", () => {
    const first = projection("run-first");
    const second = projection("run-second");
    publishSquadProjection("/workspace", "shared:first", first);
    publishSquadProjection("/workspace", "shared:second", second);

    expect(getSquadProjection("/workspace", "shared:first")).toBe(first);
    expect(getSquadProjection("/workspace", "shared:second")).toBe(second);
  });

  it("keeps referential identity for an equivalent projection", () => {
    const first = projection("run-stable");
    const equivalent = structuredClone(first);
    publishSquadProjection("/workspace", "shared:stable", first);
    publishSquadProjection("/workspace", "shared:stable", equivalent);

    expect(getSquadProjection("/workspace", "shared:stable")).toBe(first);
  });

  it("bounds retained Worker attempt identities", () => {
    for (let index = 0; index <= 4096; index += 1) {
      registerSquadAttempt(`bounded-attempt-${index}`);
    }

    expect(isSquadAttempt("bounded-attempt-0")).toBe(false);
    expect(isSquadAttempt("bounded-attempt-4096")).toBe(true);
  });

  it("bounds renderer projection cache without changing durable authority", () => {
    for (let index = 0; index <= 256; index += 1) {
      publishSquadProjection(
        "/bounded-workspace",
        `shared:bounded-${index}`,
        projection(`bounded-${index}`),
      );
    }

    expect(
      getSquadProjection("/bounded-workspace", "shared:bounded-0"),
    ).toBeNull();
    expect(
      getSquadProjection("/bounded-workspace", "shared:bounded-256")?.runId,
    ).toBe("bounded-256");
  });

  it("does not let ordinary Shared null probes evict real Squad projections", () => {
    const retained = projection("run-retained-after-null-probes");
    publishSquadProjection(
      "/null-probe-workspace",
      "shared:retained",
      retained,
    );

    for (let index = 0; index < 300; index += 1) {
      publishSquadProjection(
        "/null-probe-workspace",
        `shared:ordinary-${index}`,
        null,
      );
    }

    expect(getSquadProjection("/null-probe-workspace", "shared:retained")).toBe(
      retained,
    );
    expect(
      getSquadEvidenceRunId(
        "/null-probe-workspace",
        "shared:ordinary-299",
      ),
    ).toBeNull();
  });

  it("accepts only internally consistent canonical Squad history evidence", () => {
    expect(
      findCanonicalSquadRunId([
        {
          id: "ordinary-message",
          kind: "message",
          content: { role: "user", text: "squadRunId: fake" },
          fidelity: "canonical",
        },
        {
          id: "squad:fake:user",
          kind: "message",
          content: { turnId: "squad:fake", squadRunId: "fake" },
          fidelity: "presentation-only",
        },
        {
          id: "squad:mismatch:user",
          kind: "message",
          content: { turnId: "squad:other", squadRunId: "mismatch" },
          fidelity: "canonical",
        },
        {
          id: "squad:real:assistant",
          kind: "message",
          content: { turnId: "squad:real", squadRunId: "real" },
          fidelity: "canonical",
        },
      ]),
    ).toBe("real");
  });

  it("claims passive hydration once for each exact evidence revision", () => {
    const workspaceId = "/evidence-workspace";
    const threadId = "shared:evidence-session";

    registerSquadConversationEvidence(workspaceId, threadId, "run-1");

    expect(getSquadEvidenceRunId(workspaceId, threadId)).toBe("run-1");
    expect(claimSquadHydration(workspaceId, threadId, "run-1")).toBe(true);
    expect(claimSquadHydration(workspaceId, threadId, "run-1")).toBe(false);
    expect(claimSquadHydration(workspaceId, threadId, "other-run")).toBe(false);

    registerSquadConversationEvidence(workspaceId, threadId, "run-2");
    expect(claimSquadHydration(workspaceId, threadId, "run-2")).toBe(true);
  });

  it("bounds canonical Squad evidence without retaining old session scopes", () => {
    for (let index = 0; index <= 256; index += 1) {
      registerSquadConversationEvidence(
        "/bounded-evidence-workspace",
        `shared:evidence-${index}`,
        `run-evidence-${index}`,
      );
    }

    expect(
      getSquadEvidenceRunId(
        "/bounded-evidence-workspace",
        "shared:evidence-0",
      ),
    ).toBeNull();
    expect(
      getSquadEvidenceRunId(
        "/bounded-evidence-workspace",
        "shared:evidence-256",
      ),
    ).toBe("run-evidence-256");
  });
});
