// runtimeNotice — English UI strings
const runtimeNotice = {
  runtimeNotice: {
    title: "Runtime Notice",
    open: "Open runtime notices",
    minimize: "Minimize",
    clear: "Clear",
    emptyTitle: "No runtime notices yet",
    emptyDescription:
      "Initialization progress and key errors will appear here.",
    statusIdle: "Idle",
    statusError: "Error",
    severityInfo: "Info",
    severityWarning: "Warning",
    severityError: "Error",
    bootstrap: {
      start: "Initializing local state...",
      storageMigrationCheck: "Checking local state migration...",
      inputHistoryRestore: "Restoring input history...",
      interfaceResources: "Loading interface resources...",
      mountShell: "Mounting the client shell...",
      localStorageMigrationFailed:
        "Local state migration failed. Startup continues in degraded mode.",
      ready: "Client initialization completed.",
      failed: "Client initialization failed. Reload and try again.",
    },
    startupGate: {
      title: "Starting",
      message:
        "Finishing startup. Please wait — clicking the UI now may freeze the app.",
      forceDismiss: "Enter now",
    },
    uiScale: {
      startupGuardReset:
        "The previous launch froze at {{scale}}% interface scale, so scale was temporarily reset to 100% for this session. Your setting was not changed — you can re-apply it in Settings.",
    },
    runtime: {
      startupPending: "{{workspace}}: {{engine}} runtime is connecting...",
      resumePending:
        "{{workspace}}: Runtime health check failed. Trying recovery.",
      ready: "{{workspace}}: {{engine}} runtime is connected",
      suspectStale:
        "{{workspace}}: Runtime health check failed. Trying recovery.",
      cooldown: "{{workspace}}: Runtime recovery failed. Cooldown is active.",
      quarantined:
        "{{workspace}}: Runtime recovery failed and needs attention.",
      codexSessionStartHookSkipped:
        "Codex skipped the project SessionStart hook and created the session. Inspect `.codex/hooks.json`; project context may be incomplete. ({{reason}})",
    },
    startup: {
      taskStarted:
        "Background load started: {{task}} ({{phase}} / {{workspace}})",
      taskCompleted: "Background load completed: {{task}} ({{durationMs}}ms)",
      taskFailed: "Background load failed: {{task}}",
      taskTimedOut:
        "Background load timed out: {{task}}. Degraded path is active.",
      taskDegraded: "Background load degraded: {{task}} ({{reason}})",
      taskCancelled: "Background load cancelled: {{task}} ({{reason}})",
      commandCompleted:
        "Internal command completed: {{command}} ({{workspace}} / {{durationMs}}ms)",
      commandFailed:
        "Internal command failed: {{command}} ({{workspace}} / {{durationMs}}ms)",
      shellReady: "Client shell is ready",
      inputReady: "Input is interactive",
      activeWorkspaceReady: "Active workspace first screen is ready",
    },
    engine: {
      checking: "Checking {{engine}} status...",
      ready: "{{engine}} is ready",
      unavailable: "{{engine}} is not installed. Install it first.",
      requiresLogin: "{{engine}} requires sign-in",
    },
    codex: {
      providerSelected:
        "{{name}} enabled. Click the Codex entry to create a session.",
    },
    claude: {
      providerSelected:
        "{{name}} enabled. Click the Claude Code entry to create a session.",
      resumeCommandCopied:
        "Claude resume command copied. If the TUI /resume picker does not show this GUI session, run claude --resume {{sessionId}} or /resume {{sessionId}} explicitly.",
    },
    kimi: {
      providerSelected:
        "{{name}} enabled. Click the Kimi CLI entry to create a session.",
    },
    grok: {
      providerSelected:
        "{{name}} enabled. Click the Grok CLI entry to create a session.",
    },
    opencode: {
      providerSelected:
        "{{name}} enabled. Click the OpenCode entry to create a session.",
    },
    vendor: {
      activateProviderFailed: "Failed to enable provider {{name}}: {{detail}}",
    },
    error: {
      createSessionRecoveryRequired:
        "{{workspace}}: Session creation failed while runtime recovery is in progress",
      threadTurnFailed: "{{engine}} session failed: {{message}}",
      codexSessionRecoverableFailure:
        "Codex connection interrupted: the previous session binding or runtime connection is no longer usable. Retry or reconnect.",
    },
  },
};

export default runtimeNotice;
