export default {
  subagentUi: {
    defaultName: "Subagent",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "Claude Agent launch ack detected, but no claude:subagent session is linked yet (native owner may still be binding/indexing). Retry later or open the subagent from the session tree.",
    toolCount: "{{count}} tools",
    close: "Close",
    resizeSplit: "Resize subagent panel",
    inspectorAria: "Subagent details",
    loadingSession: "Loading subagent session…",
    sessionLoadFailed: "Failed to load subagent session",
    emptySession: "No messages in subagent session yet (still indexing)",
    noSessionYet:
      "No linked subagent session yet (agentId missing or transcript still indexing). Open the subagent row in the session tree.",
    status: {
      running: "Running",
      completed: "Completed",
      error: "Failed",
    },
    fields: {
      output: "Delivery report",
    },
  },
};
