## Why

Observed 2026-07-12 in local usage: a user answered an AskUserQuestion gate and the reply never
reached the agent. Root cause investigation found two compounding bugs:

1. The frontend countdown (`RequestUserInputMessage.tsx`) was a naive per-`setInterval`-tick
   decrement, not anchored to a wall-clock deadline. Any delay in `setInterval` scheduling
   (backgrounded/minimized window, main-thread jank) makes the displayed remaining time lag real
   elapsed time, so a submit can reach the backend after its real 300s deadline while the UI still
   showed time remaining.
2. When a submit genuinely arrives late, `respond_to_server_request` (`codex/mod.rs`) finds no
   Claude session with the request still pending (already removed by the backend timeout) and
   falls through to the Codex-session lookup - architecturally wrong for a Claude-only request id
   - which returns a generic `"workspace not connected"` error. The frontend only recognizes that
   message as stale for a submit if a `staleSettlementHint: "timeout"` was attached, which is
   itself derived from the same drift-prone local countdown - so exactly when the real race
   occurs, the hint is most likely absent, and the user sees a misleading "Submit failed. Please
   retry." banner that can never actually succeed on retry.

## What Changes

- `RequestUserInputMessage.tsx`'s countdown is now derived from a `Date.now()`-anchored deadline
  set once per request, recomputed on every read, instead of an accumulated per-tick counter. The
  display-refresh interval is also no longer paused while a submit is in flight or has failed
  (it's now a pure display tick, decoupled from submit state).
- `respond_to_server_request` (`codex/mod.rs`) now recognizes a late Claude-origin AskUserQuestion
  answer (a `request_id` shaped like `ask-*` that no Claude session has pending, in a workspace
  that has at least one Claude session) before falling through to the Codex-session lookup, and
  returns a distinct `"...already expired or was answered"` error.
- The frontend's stale-error classifier recognizes that message unconditionally, matching the
  existing `"unknown request_id for askuserquestion"` pattern, so it settles cleanly regardless of
  whether a `staleSettlementHint` was attached.

## Scope

- Frontend: `src/features/app/components/RequestUserInputMessage.tsx`,
  `src/features/threads/hooks/useThreadUserInput.ts`.
- Backend: `src-tauri/src/codex/mod.rs`.
- Tests: `RequestUserInputMessage.test.tsx`, `useThreadUserInput.test.tsx` (new regression tests).
  `cargo test --lib` was run on this branch against a clean-`upstream/main` control at the same
  base; results in `verification.md`.
- No change to the question card layout, MCP bridge protocol, or non-AskUserQuestion routing
  (approval requests, Codex's own user-input requests are untouched).

## Acceptance

- MUST: a request's displayed remaining time MUST reflect actual elapsed wall-clock time, not an
  accumulated tick count that can lag behind a throttled timer.
- MUST: a late Claude AskUserQuestion answer MUST be recognized as stale and settled cleanly
  (pending request removed, no misleading retry-invite banner) regardless of whether the local
  countdown had already reached zero.
- MUST NOT: change behavior for Codex's own `RequestUserInput` requests, or for a genuine
  workspace-connectivity failure unrelated to AskUserQuestion.
