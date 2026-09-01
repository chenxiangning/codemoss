/**
 * P14 qualification boundary for exposing OMP through Shared Session.
 *
 * This is deliberately feature-local: it records evidence without wiring OMP
 * into the Shared Session provider set. `unknown` means the protocol or a
 * unit contract exists, but no cross-client process evidence exists yet.
 */
export type OmpSharedSessionQualificationState =
  | "supported"
  | "unknown"
  | "unsupported";

export type OmpSharedSessionQualificationArea =
  | "terminal"
  | "handoff"
  | "providerBinding"
  | "resume"
  | "cancel"
  | "toolExchange"
  | "recovery";

export type OmpSharedSessionQualificationRecord = Readonly<{
  state: OmpSharedSessionQualificationState;
  evidence: string;
  note: string;
}>;

export type OmpSharedSessionQualificationMatrix = Readonly<
  Record<
    OmpSharedSessionQualificationArea,
    OmpSharedSessionQualificationRecord
  >
>;

/**
 * Evidence captured on 2026-08-31. ACP initialize/session-new and local
 * contract tests are not cross-client Shared Session qualification.
 */
export const OMP_SHARED_SESSION_QUALIFICATION_MATRIX: OmpSharedSessionQualificationMatrix =
  Object.freeze({
    terminal: {
      state: "unknown",
      evidence:
        "omp-cli-surface.txt: ACP initialize and session/new process smoke; no prompt terminal event was captured",
      note: "Transport entry points are real, but Shared terminal settlement is unproven.",
    },
    handoff: {
      state: "unsupported",
      evidence:
        "sharedSessionEngines.ts: OMP is absent from the Shared Session supported-engine set",
      note: "No cross-client context handoff path is registered for OMP.",
    },
    providerBinding: {
      state: "unsupported",
      evidence:
        "shared_projection/commands.rs: OMP is classified as Native-only and never a Shared local provider",
      note: "Provider/profile identity has not been qualified for Shared ownership.",
    },
    resume: {
      state: "unknown",
      evidence:
        "omp-cli-surface.txt: ACP initialize advertises resume; session/new smoke did not execute resume",
      note: "The advertised ACP capability is not process-level resume evidence.",
    },
    cancel: {
      state: "unknown",
      evidence:
        "omp-acp-transport/spec.md: cancellation contract exists; no real ACP cancel process trace was captured",
      note: "Cancel request, acknowledgement, and terminal cancellation remain unqualified across clients.",
    },
    toolExchange: {
      state: "unknown",
      evidence:
        "omp-cli-surface.txt: only ready/get_state and control frames were observed; no Shared tool exchange trace",
      note: "Tool ordering and ownership across clients are not proven.",
    },
    recovery: {
      state: "unknown",
      evidence:
        "omp-p13-release-hardening.txt: typed release recovery guards pass; no cross-client recovery process evidence",
      note: "Local launch rollback is not equivalent to Shared Session recovery.",
    },
  });

export type OmpSharedSessionReleaseDecision = Readonly<{
  qualified: boolean;
  sharedSessionEnabled: false;
  mode: "native-only" | "qualification-passed-review-required";
  rollbackRequired: boolean;
  rollbackReason: "shared-session-unqualified" | null;
  blockingAreas: readonly OmpSharedSessionQualificationArea[];
}>;

/**
 * Evaluate qualification without enabling Shared Session. Even a future
 * all-green matrix only reaches review-required; release wiring must make a
 * separate, explicit change to opt in.
 */
export function evaluateOmpSharedSessionReleaseDecision(
  matrix: OmpSharedSessionQualificationMatrix =
    OMP_SHARED_SESSION_QUALIFICATION_MATRIX,
): OmpSharedSessionReleaseDecision {
  const blockingAreas = (
    Object.keys(matrix) as OmpSharedSessionQualificationArea[]
  ).filter((area) => matrix[area].state !== "supported");
  const qualified = blockingAreas.length === 0;

  return {
    qualified,
    sharedSessionEnabled: false,
    mode: qualified ? "qualification-passed-review-required" : "native-only",
    rollbackRequired: !qualified,
    rollbackReason: qualified ? null : "shared-session-unqualified",
    blockingAreas,
  };
}
