## 1. Spec

- [x] Identify the clock-drift gap in the frontend countdown
- [x] Identify the Codex-fallback misrouting for a late Claude-origin AskUserQuestion answer
- [x] Add an ADDED requirement for wall-clock countdown accuracy, and a MODIFIED scenario on
      "Timed-Out User Input Settlement Releases Stale Cards" naming the distinct expired-answer
      error

## 2. Implementation

- [x] `RequestUserInputMessage.tsx`: replace per-tick decrement with a `Date.now()`-anchored
      deadline; un-gate the display-refresh interval from `isSubmitting`/`submitError`
- [x] `codex/mod.rs`: recognize a late Claude-origin `ask-*` request_id before falling through to
      the Codex-session lookup; return a distinct error
- [x] `useThreadUserInput.ts`: recognize the new error message unconditionally in
      `isStaleSettledRequestError`

## 3. Tests

- [x] New test: countdown reflects wall-clock time even without a timer tick
      (`RequestUserInputMessage.test.tsx`), confirmed failing pre-fix
- [x] New test: late submit recognized as expired without a local timeout hint
      (`useThreadUserInput.test.tsx`), confirmed failing pre-fix
- [x] Full `RequestUserInputMessage.test.tsx` (28/28) and `useThreadUserInput.test.tsx` (13/13)
      green
- [x] `npx tsc --noEmit` clean
- [x] `cargo test --lib` (2026-08-13, on v0.8.9): 2025 passed / 6 failed on this branch vs
      2022 passed / 6 failed on a clean-`upstream/main` control at the same base. The +3 is the
      three new `expired_claude_ask_*` tests; same six pre-existing failures both sides.
- [x] Unit tests for the `codex/mod.rs` gate via the extracted `expired_claude_ask_request_id`
      predicate: recognized for a Claude-origin user-input response, ignored for a
      `ccgui-plan-blocker:` id and for approval responses, and not fired when the workspace has
      no Claude session.
