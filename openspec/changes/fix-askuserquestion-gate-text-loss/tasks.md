## 1. Spec

- [x] Identify the gap: `settleThreadWaitingForUserChoice` never drains the live-text tail before a
      boundary transition, unlike the terminal-settlement and tool-item-start call sites
- [x] Add a MODIFIED scenario to `conversation-render-surface-stability` naming the AskUserQuestion
      gate-settlement boundary explicitly

## 2. Implementation

- [x] Thread `workspaceId` through both callers of `settleThreadWaitingForUserChoice`
      (`onRequestUserInput`, `onModeBlocked`)
- [x] Drain the live-text tail and dispatch `appendAgentDelta` before flipping `isStreaming` off
- [x] Flush the batched realtime delta queue before the drain (via a ref, since
      `flushPendingRealtimeEvents` is destructured after this callback is defined). Without it the
      shell delta can still be queued when the tail is dispatched, and `appendAgentDelta` would
      create a second assistant item rather than appending to the existing one.

## 3. Tests

- [x] New regression test: pre-gate text streamed before `onRequestUserInput` fires survives gate
      settlement
- [x] Confirmed the test fails on pre-fix code (reverted locally, re-ran, restored)
- [x] Test asserts flush-before-drain and drain-before-not-processing via `invocationCallOrder`,
      not merely that each call happened
- [x] Confirmed load-bearing: deleting the flush call fails this test (64/65), restoring it passes
- [x] Full `useThreadEventHandlers.test.ts` suite green (65/65)
- [x] `npx tsc --noEmit` clean on touched files
