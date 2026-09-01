import { describe, expect, it } from "vitest";
import {
  evaluateOmpSharedSessionReleaseDecision,
  OMP_SHARED_SESSION_QUALIFICATION_MATRIX,
  type OmpSharedSessionQualificationMatrix,
} from "./ompSharedSessionQualification";

describe("OMP P14 Shared Session qualification", () => {
  it("covers every qualification area with evidence-backed states", () => {
    expect(Object.keys(OMP_SHARED_SESSION_QUALIFICATION_MATRIX)).toEqual([
      "terminal",
      "handoff",
      "providerBinding",
      "resume",
      "cancel",
      "toolExchange",
      "recovery",
    ]);

    for (const record of Object.values(
      OMP_SHARED_SESSION_QUALIFICATION_MATRIX,
    )) {
      expect(["supported", "unknown", "unsupported"]).toContain(record.state);
      expect(record.evidence.trim()).not.toBe("");
      expect(record.note.trim()).not.toBe("");
    }

    expect(OMP_SHARED_SESSION_QUALIFICATION_MATRIX.handoff.state).toBe(
      "unsupported",
    );
    expect(OMP_SHARED_SESSION_QUALIFICATION_MATRIX.providerBinding.state).toBe(
      "unsupported",
    );
  });

  it("keeps OMP Native-only and requires rollback when qualification is incomplete", () => {
    const decision = evaluateOmpSharedSessionReleaseDecision();

    expect(decision).toMatchObject({
      qualified: false,
      sharedSessionEnabled: false,
      mode: "native-only",
      rollbackRequired: true,
      rollbackReason: "shared-session-unqualified",
    });
    expect(decision.blockingAreas).toEqual([
      "terminal",
      "handoff",
      "providerBinding",
      "resume",
      "cancel",
      "toolExchange",
      "recovery",
    ]);
  });

  it("never enables Shared Session even if a future matrix becomes all green", () => {
    const allGreen = Object.fromEntries(
      Object.entries(OMP_SHARED_SESSION_QUALIFICATION_MATRIX).map(
        ([area, record]) => [area, { ...record, state: "supported" }],
      ),
    ) as OmpSharedSessionQualificationMatrix;

    expect(evaluateOmpSharedSessionReleaseDecision(allGreen)).toMatchObject({
      qualified: true,
      sharedSessionEnabled: false,
      mode: "qualification-passed-review-required",
      rollbackRequired: false,
      rollbackReason: null,
    });
  });
});
