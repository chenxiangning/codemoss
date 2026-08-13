## Context

`conversation-render-surface-stability`'s "Live assistant text MAY bypass root reducer while
preserving final transcript convergence" requirement already mandates that a streaming assistant
message's completion converges to the durable transcript. The implementation only wired that
convergence into two boundary transitions (the interrupt path, tool-item-start segment
boundary) via `drainLiveAssistantTextTail`; the AskUserQuestion gate-settlement boundary
(`settleThreadWaitingForUserChoice`) was never retrofitted when the live-text channel landed, since
it predates the channel by roughly two and a half months.

## Decision

Add the same drain call to `settleThreadWaitingForUserChoice`, unconditionally (no perf-flag gate,
matching `useThreadMessaging.ts`'s interrupt call site - `drainLiveAssistantTextTail` is a no-op
when there's nothing buffered). `settleThreadWaitingForUserChoice` gained a `workspaceId`
parameter so the drained delta's `appendAgentDelta` dispatch can be scoped; both existing callers
already have `workspace_id` on the event they're handling.

The drain is preceded by `flushPendingRealtimeEvents()`, matching every other settlement boundary
in this file. Agent-text deltas are batched rather than dispatched synchronously, so draining
without the flush can emit the tail before the assistant item exists, and `appendAgentDelta`
would then create a second item - putting the tail after the ask card instead of before it.

## Alternatives

| Option | Verdict | Why |
|---|---|---|
| Gate the drain on `isLiveTextExternalizationEnabled()` like `useThreadItemEvents.ts` does | Not needed | `drainLiveAssistantTextTail` already returns `null` safely when the channel has nothing for that thread (flag off, or nothing streamed) - matches the interrupt call site's unconditional style (`useThreadMessaging.ts`) |
| Fix inside the live-text channel itself (e.g. auto-flush on any external read) | Not adopted | Would weaken the channel's "explicit boundary drain" contract for every consumer, not just this one gap |
| Special-case AskUserQuestion in the channel module | Not adopted | Keeps the fix local to the one boundary that was missing it, no new coupling from the channel to a specific tool |

## Validation

- New regression test in `useThreadEventHandlers.test.ts`: seeds the live-text channel with a
  shell delta + a tail delta, fires `onRequestUserInput`, asserts the tail is dispatched as
  `appendAgentDelta` before the gate settles. Verified to fail on the pre-fix code (reverted the
  hook change locally, re-ran the single test, confirmed `AssertionError`) and pass with the fix.
- Full `useThreadEventHandlers.test.ts` suite (65 tests) green.
- `npx tsc --noEmit` clean on the touched files.
