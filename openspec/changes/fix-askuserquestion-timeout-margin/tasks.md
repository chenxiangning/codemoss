## 1. Spec

- [x] Confirm the 1800s base timeout is an intentional, already-shipped value (checked
      `docs/analysis/client-shortcuts-and-priorities-2026-07.md`) - not relitigating it
- [x] Identify the exact-match race between the CLI env timeout and the server-side wait
- [x] Modify the existing CLI-timeout requirement to require a margin, not an exact match

## 2. Implementation

- [x] Introduce `ASK_USER_QUESTION_TIMEOUT_SECS` as the single source of truth; replace three
      independently-hardcoded `1800` literals
- [x] `MCP_TOOL_TIMEOUT` env var now uses `ASK_USER_QUESTION_TIMEOUT_SECS +
      ASK_USER_QUESTION_CLI_TIMEOUT_MARGIN_SECS` (30s margin)

## 3. Tests

- [x] Updated `build_command_raises_mcp_tool_timeout_when_ask_wired` to assert the new
      margin-adjusted value (1830000ms)
- [x] `cargo test --lib` (2026-08-13, on v0.8.9): 2022 passed / 6 failed on this branch, and
      2022 passed / 6 failed on a clean-`upstream/main` control at the same base. Identical
      counts and the same six pre-existing failures, so this branch introduces none.
