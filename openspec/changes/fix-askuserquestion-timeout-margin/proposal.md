## Why

Evidence from local usage logs: 35 AskUserQuestion timeout errors, persisting well
after the head-anchor fix (07-09) through 08-04. The contributor addressed here:

1. **No margin between the CLI's own MCP fetch timeout and our server-side wait.** Both were set
   to the exact same duration (currently 1800s each, discovered mid-investigation to have already
   been bumped from an earlier 300s - this repo has drifted these two independently-hardcoded
   numbers apart before). A photo-finish race: whichever side's clock starts a few ms later "wins,"
   with no guaranteed ordering that our own graceful "timed out" MCP response always has time to
   reach the CLI before its fetch gives up first.

## What Changes

- Introduced `ASK_USER_QUESTION_TIMEOUT_SECS` as the single source of truth for how long we wait
  for an AskUserQuestion answer (both the native plan-mode resume path and the MCP bridge path),
  replacing three independently-hardcoded `1800` literals that had already drifted once (300s ->
  1800s, not all sites updated in lockstep going by prior comments).
- The CLI's `MCP_TOOL_TIMEOUT` env var is now set to `ASK_USER_QUESTION_TIMEOUT_SECS` **plus a
  30s margin**, not an exact match, so a graceful server-side timeout response has room to reach
  the CLI before its own fetch abandons the call.

## Scope

- Backend only: `src-tauri/src/engine/claude.rs`, `src-tauri/src/engine/claude/user_input.rs`.
- Test: `src-tauri/src/engine/claude/tests_stream.rs` (updated the existing
  `build_command_raises_mcp_tool_timeout_when_ask_wired` assertion to the new margin-adjusted
  value).
- No frontend change, no protocol/schema change. `cargo test --lib` was run on this branch against
  a clean-`upstream/main` control at the same base; results in `verification.md`.
- Verified against `docs/analysis/client-shortcuts-and-priorities-2026-07.md` before touching this:
  that doc frames the 300s-era timeout as already-shipped and its remaining gap as deferred
  cargo/rebuilt-app acceptance, not as "300s is wrong" - so this change does not relitigate the
  base timeout value, only the margin and the event-delivery reliability around it.

## Acceptance

- MUST: the CLI's own fetch timeout MUST always exceed our server-side wait by a fixed margin, not
  match it exactly.
- MUST: the three AskUserQuestion wait-duration call sites MUST derive from one constant, so they
  cannot silently drift apart again.
