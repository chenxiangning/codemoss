# Verification · fix-askuserquestion-gate-text-loss

- **Date**: 2026-08-13
- **Base**: `upstream/main` @ v0.8.9 (`bd92e1388`)
- **Status**: implemented / awaiting upstream review

## Automated

- Vitest: `useThreadEventHandlers.test.ts` 65/65 green, including the new case that asserts the
  live-text tail is drained into the reducer before the user-choice gate settles.
- Vitest: `liveAssistantTextChannel.test.ts` 14/14 green (the channel this change drains from).
- `npx tsc --noEmit`: clean.
- Merges clean onto v0.8.9 with no conflicts, and alongside the three sibling AskUserQuestion
  changes in a combined integration build.

## Manual

- [x] Exercised in daily use over roughly a week, on the pre-rebase branch.
- [ ] Not re-exercised by hand since rebasing onto v0.8.9. The rebase was conflict-free and did not
      touch this change's files, so the risk is low, but it is untested by hand at this base.

## Scope notes

- `useThreadEventHandlers.ts` is not touched by upstream's `fix-askuserquestion-settlement-tombstone`,
  so this change and that one are independent.
- The drain-before-boundary contract this reuses is already applied at two other boundaries
  (terminal settlement and `incrementAgentSegment`). This adds the gate settle site as a third
  consumer rather than introducing a new mechanism.
