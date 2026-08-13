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
- [x] Full `RequestUserInputMessage.test.tsx` (28/28) and `useThreadUserInput.test.tsx` (12/12)
      green
- [x] `npx tsc --noEmit` clean
- [x] `cargo test` (2026-08-13, `/tmp` worktree on v0.8.9): full `--lib` run compared against a
      clean-`upstream/main` control under identical conditions. 2026 passed / 6 failed here vs
      2022 passed / 6 failed on the control, the same six failures both sides. No new failures.
