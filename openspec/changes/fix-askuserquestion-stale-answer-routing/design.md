## Context

`codex-chat-canvas-user-input-elicitation`'s "Timed-Out User Input Settlement Releases Stale Cards"
requirement already lists the runtime-response phrases the frontend must recognize as stale
("unknown, stale, timeout-settled, cancelled, or workspace disconnected"). The gap wasn't in that
requirement's intent - it was that the actual runtime response for a late Claude AskUserQuestion
answer routed through the wrong code path (`codex/mod.rs`'s Codex-session fallback) and produced
an ambiguous `"workspace not connected"` that the classifier could only trust when a
locally-derived timing hint agreed - and that hint's own timer could be wrong.

## Decision

Two independent, complementary fixes:

- **Wall-clock countdown.** Replace the per-tick decrement with a fixed `Date.now()`-anchored
  deadline, recomputed on read. This shrinks (but does not eliminate) the window where the UI's
  belief about remaining time diverges from the backend's real deadline.
- **Distinct expired-answer error.** Rather than relying on the frontend to always guess right
  about timing, make the backend's response itself unambiguous: a `request_id` shaped like an
  AskUserQuestion id (`ask-*`) that no Claude session has pending, in a workspace that has a
  Claude session at all, is definitionally a late/already-settled AskUserQuestion answer - not a
  Codex workspace-connectivity problem. Returning a distinct error message lets the frontend
  classify it as stale unconditionally, independent of any local timer.

Together these close the gap from two sides: the countdown fix makes a genuinely-late submit less
likely to happen in the first place, and the error-routing fix makes sure that when one still
happens (a submit through a path that doesn't check the countdown, or a submit that beats the
countdown's own state update), it's classified correctly regardless.

## Alternatives

| Option | Verdict | Why |
|---|---|---|
| Only fix the countdown, leave the backend routing as-is | Not adopted | Doesn't fix the actual observed symptom (bcd0c219's reply "never got through") - a late submit through any path still hits the misleading Codex fallback |
| Only fix the backend routing, leave the naive tick-counter | Not adopted | Leaves the UI showing an inaccurate countdown, which is itself confusing even when the eventual error handling is correct |
| Track a server-authoritative deadline and push it to the frontend | Not adopted (this change) | The real, more complete fix - would remove the client/server clock-drift class of bug entirely - but requires a protocol change (a new field on the `RequestUserInput` event); larger surface than this scoped fix warrants |
| Have the frontend always treat any error on a `submit` after the local deadline as stale, without a distinct backend message | Not adopted | Papers over the routing bug rather than fixing it; a genuine `"workspace not connected"` for an unrelated reason would then also be silently swallowed |

## Validation

- `RequestUserInputMessage.test.tsx`: new test jumps the system clock past the deadline WITHOUT
  advancing any pending timers (`vi.setSystemTime`, no `vi.advanceTimersByTime`), then submits
  manually - proves the remaining time is derived fresh from `Date.now()` at submit time, not an
  accumulated tick count. All 27 pre-existing tests (which use `vi.advanceTimersByTime`) still
  pass, confirming this repo's fake-timer setup mocks `Date` in lockstep with the timer queue.
  Verified the new test fails on the pre-fix per-tick-decrement implementation.
- `useThreadUserInput.test.tsx`: new test mocks the backend's new expired-answer error message on
  a submit with no `staleSettlementHint`, asserts it settles as stale. Verified it fails on the
  pre-fix classifier (uncaught rejection).
  Merged with `fix-askuserquestion-settlement-tombstone`: that change made the stale branch write
  a durable terminal marker before removing the request, so this test now asserts the marker is
  present rather than absent. The marker is settlement behaviour shared with every stale path; what
  this test pins is unchanged - that the expired-answer error reaches the stale branch on its own,
  with no local timing hint to corroborate it. Re-verified load-bearing by removing the classifier
  clause and observing the test fail.
- `npx tsc --noEmit` clean on all touched frontend files.
- `cargo test --lib`: run on this branch against a clean-`upstream/main` control at the same base;
  counts in `verification.md`.
