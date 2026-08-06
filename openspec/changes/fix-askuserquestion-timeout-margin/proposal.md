## Why

Transcript-mined evidence: 35 AskUserQuestion timeout errors across the fleet, persisting well
after the head-anchor fix (07-09) through 08-04. Two distinct, independently-real contributors:

1. **No margin between the CLI's own MCP fetch timeout and our server-side wait.** Both were set
   to the exact same duration (currently 1800s each, discovered mid-investigation to have already
   been bumped from an earlier 300s - this repo has drifted these two independently-hardcoded
   numbers apart before). A photo-finish race: whichever side's clock starts a few ms later "wins,"
   with no guaranteed ordering that our own graceful "timed out" MCP response always has time to
   reach the CLI before its fetch gives up first.
2. **The session-wide event bus can silently drop a `RequestUserInput` event.** The broadcast
   channel (`broadcast::channel(1024)`) is shared by every concurrent turn's event forwarder in a
   session. A burst of unrelated event volume from another turn between a forwarder subscribing
   and it catching up can push the channel past capacity, and `RecvError::Lagged` is currently just
   logged and skipped - the dropped event (possibly the AskUserQuestion ask itself) never reaches
   the renderer. 30 minutes later the server's own wait times out, looking identical to a genuinely
   slow human.

## What Changes

- Introduced `ASK_USER_QUESTION_TIMEOUT_SECS` as the single source of truth for how long we wait
  for an AskUserQuestion answer (both the native plan-mode resume path and the MCP bridge path),
  replacing three independently-hardcoded `1800` literals that had already drifted once (300s ->
  1800s, not all sites updated in lockstep going by prior comments).
- The CLI's `MCP_TOOL_TIMEOUT` env var is now set to `ASK_USER_QUESTION_TIMEOUT_SECS` **plus a
  30s margin**, not an exact match, so a graceful server-side timeout response has room to reach
  the CLI before its own fetch abandons the call.
- The session's broadcast event channel capacity is raised from 1024 to 4096, as a mitigation
  (raises the practical threshold; does not remove the possibility of a sufficiently large burst
  still exceeding it - flagged honestly in-code, not oversold as a full fix).

## Scope

- Backend only: `src-tauri/src/engine/claude.rs`, `src-tauri/src/engine/claude/user_input.rs`.
- Test: `src-tauri/src/engine/claude/tests_stream.rs` (updated the existing
  `build_command_raises_mcp_tool_timeout_when_ask_wired` assertion to the new margin-adjusted
  value).
- No frontend change, no protocol/schema change. `cargo check`/`cargo test` deferred - the live
  desktop app (this session's host) is running; George will gate this via the `/tmp` worktree
  rebuild before opening any PR.
- Verified against `docs/analysis/client-shortcuts-and-priorities-2026-07.md` before touching this:
  that doc frames the 300s-era timeout as already-shipped and its remaining gap as deferred
  cargo/rebuilt-app acceptance, not as "300s is wrong" - so this change does not relitigate the
  base timeout value, only the margin and the event-delivery reliability around it.

## Acceptance

- MUST: the CLI's own fetch timeout MUST always exceed our server-side wait by a fixed margin, not
  match it exactly.
- MUST: the three AskUserQuestion wait-duration call sites MUST derive from one constant, so they
  cannot silently drift apart again.
- SHOULD: a burst of unrelated event volume up to the new capacity MUST NOT cause an
  AskUserQuestion `RequestUserInput` event to be silently dropped (best-effort mitigation, not a
  hard guarantee for arbitrarily large bursts).
