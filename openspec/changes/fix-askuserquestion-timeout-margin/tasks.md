## 1. Spec

- [x] Confirm the 1800s base timeout is an intentional, already-shipped value (checked
      `docs/analysis/client-shortcuts-and-priorities-2026-07.md`) - not relitigating it
- [x] Identify the exact-match race between the CLI env timeout and the server-side wait
- [x] Identify the broadcast channel capacity as a distinct, concrete drop mechanism
- [x] Modify the existing CLI-timeout requirement to require a margin, not an exact match; add an
      ADDED requirement for event-delivery capacity

## 2. Implementation

- [x] Introduce `ASK_USER_QUESTION_TIMEOUT_SECS` as the single source of truth; replace three
      independently-hardcoded `1800` literals
- [x] `MCP_TOOL_TIMEOUT` env var now uses `ASK_USER_QUESTION_TIMEOUT_SECS +
      ASK_USER_QUESTION_CLI_TIMEOUT_MARGIN_SECS` (30s margin)
- [x] Raise the session broadcast event channel capacity from 1024 to 4096, documented in-code as
      a mitigation, not a guarantee

## 3. Tests

- [x] Updated `build_command_raises_mcp_tool_timeout_when_ask_wired` to assert the new
      margin-adjusted value (1830000ms)
- [ ] `cargo test` (deferred - live desktop app is this session's host; run via the `/tmp`
      worktree rebuild before opening a PR)
