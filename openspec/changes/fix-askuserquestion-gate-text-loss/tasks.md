## 1. Spec

- [x] Identify the gap: `settleThreadWaitingForUserChoice` never drains the live-text tail before a
      boundary transition, unlike the terminal-settlement and tool-item-start call sites
- [x] Add a MODIFIED scenario to `conversation-render-surface-stability` naming the AskUserQuestion
      gate-settlement boundary explicitly

## 2. Implementation

- [x] Thread `workspaceId` through both callers of `settleThreadWaitingForUserChoice`
      (`onRequestUserInput`, `onModeBlocked`)
- [x] Drain the live-text tail and dispatch `appendAgentDelta` before flipping `isStreaming` off

## 3. Tests

- [x] New regression test: pre-gate text streamed before `onRequestUserInput` fires survives gate
      settlement
- [x] Confirmed the test fails on pre-fix code (reverted locally, re-ran, restored)
- [x] Full `useThreadEventHandlers.test.ts` suite green (65/65)
- [x] `npx tsc --noEmit` clean on touched files
