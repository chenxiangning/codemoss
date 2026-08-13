## Why

Evidence from local usage logs (454 AskUserQuestion gate calls, 56 of them erroring): when
the assistant streams text before an `AskUserQuestion` gate fires mid-turn, that pre-gate text
never renders. The user sees only the option card; the turn's final (post-gate) message renders
fine.

Root cause: the A4 live-text externalization channel
(`externalize-live-assistant-text-channel`, archived 2026-07-09) keeps streamed assistant text out
of the reducer after the first ("shell") delta; only `drainLiveAssistantTextTail` flowing back into
the reducer before a boundary transition can recover it. Two boundaries already do this correctly
(terminal turn settlement, tool-item-start segment boundary). The AskUserQuestion gate-settlement
path (`settleThreadWaitingForUserChoice`, added 2026-04-29, ~2.5 months before the live-text
channel) never was.

## What Changes

- `settleThreadWaitingForUserChoice` drains the live-text tail for the settling thread and
  dispatches it as an `appendAgentDelta` before flipping `isStreaming` off, matching the existing
  drain-before-boundary convention.
- Both call sites (`onRequestUserInput`, `onModeBlocked`'s `requestUserInputBlocked` branch) now
  pass `workspaceId` through so the dispatch can be scoped correctly.

## Scope

- Frontend only: `src/features/threads/hooks/useThreadEventHandlers.ts`.
- Test: `src/features/threads/hooks/useThreadEventHandlers.test.ts` (new regression test).
- No backend change, no dialog/card layout change, no protocol/schema change.

## Acceptance

- MUST: text streamed before an AskUserQuestion gate fires mid-turn MUST remain visible after the
  gate settles.
- MUST NOT: regress the existing terminal-settlement or tool-item-start drain behavior.
