export default {
  multiAgent: {
    entry: {
      label: "Collab",
      aria: "Use multi-agent collab for the next send",
      activeRun: "This session already has an active collab run",
      arm: "Use multi-agent collab for the next send",
      disarm: "Cancel multi-agent for the next send",
    },
    card: {
      runTitle: "Multi-Agent collab",
      orchestrationHint:
        "Stages below form the pipeline. Each stage can use a different CLI·provider. Click a stage for live output on the right.",
      confirmHint: "Review the plan, then Confirm & implement. Implementation will not start without confirmation.",
      finalTitle: "Summary",
    },
    actions: {
      confirmExecute: "Confirm & implement",
      approving: "Confirming…",
      stop: "Stop",
      stopping: "Stopping…",
    },
    lifecycle: {
      aria: "Collab pipeline",
    },
    stageStatus: {
      pending: "Pending",
      running: "Running",
      succeeded: "Done",
      failed: "Failed",
      skipped: "Skipped",
    },
    phase: {
      plan: "Plan",
      implement: "Implement",
      execute: "Implement",
      review: "Review",
    },
    status: {
      planning: "Planning",
      "awaiting-approval": "Awaiting approval",
      implementing: "Implementing",
      executing: "Implementing",
      reviewing: "Reviewing",
      succeeded: "Succeeded",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    inspector: {
      title: "Stage live",
      aria: "Stage live output",
      resize: "Resize collab panel",
      close: "Close stage panel",
      emptyLive: "Waiting for stage output…",
      phaseIdle: "Select a stage",
    },
    errors: {
      unavailableTitle: "Collab unavailable",
      incompleteTarget:
        "Select a complete CLI, provider, and model in Shared Session.",
      attachmentsTitle: "Attachments are not supported",
      attachments:
        "Remove images, Browser Context, or Intent Canvas attachments first.",
      contextUnsupportedTitle: "Referenced context is not supported",
      contextUnsupported: "Remove {{context}} before starting collab.",
      contextKind: {
        "note-cards": "note cards",
        "manual-memory": "manual memory",
        "memory-reference": "memory references",
        skills: "skills",
      },
      busy: "Wait for the current Shared Session turn to finish.",
      targetUnavailable: "This CLI cannot run collab.",
      startFailed: "Failed to start collab",
      startFailedDiagnostic: "Run did not start. {{diagnostic}}",
      approvalFailed: "Could not confirm the plan. {{diagnostic}}",
      stopFailedTitle: "Stop failed",
      stopFailed: "Could not stop the run. {{diagnostic}}",
      executionInterrupted: "Collab execution interrupted",
    },
  },
};
