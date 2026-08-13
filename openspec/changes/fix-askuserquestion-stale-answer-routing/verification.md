# Verification · fix-askuserquestion-stale-answer-routing

- **Date**: 2026-08-13
- **Base**: `upstream/main` @ v0.8.9 (`bd92e1388`)
- **Status**: implemented / awaiting upstream review

## Automated

- Vitest: `useThreadUserInput.test.tsx` 13/13 green, `RequestUserInputMessage.test.tsx` 28/28 green.
- Vitest: `userInputSettlementTombstone.test.ts` 3/3 green (upstream's, unaffected).
- `npx tsc --noEmit`: clean.
- Load-bearing check: with the `"already expired or was answered"` clause removed from
  `isStaleSettledRequestError`, `settles a late submit recognized as expired even without a local
  timeout hint` fails; restored, it passes. The fix is doing work at this base, not riding on
  upstream behaviour.

## Rebase onto v0.8.9

This change merged onto v0.8.9 without a textual conflict, but upstream's
`fix-askuserquestion-settlement-tombstone` changed behaviour in a path this change's tests cover,
so a clean merge was not sufficient evidence:

- Upstream made the stale-settle branch write a durable terminal marker (`upsertItem`) before
  removing the request, so a history reopen cannot rehydrate a live card.
- One assertion here predated that and pinned the older bare-remove behaviour
  (`expect(dispatch).not.toHaveBeenCalledWith({ type: "upsertItem" })`).

The assertion was realigned to expect the marker, matching the sibling test in the same file that
already asserts it. **No production code changed** as part of the rebase. What the test pins is
unchanged: that the expired-answer error is classified as stale on its own, with no local timing
hint to corroborate it.

## Manual

- [x] Exercised in daily use over roughly a week, on the pre-rebase branch.
- [ ] Not re-exercised by hand since rebasing onto v0.8.9.

## Known limits

- The wall-clock countdown shrinks the client/server drift window but does not close it. A
  server-authoritative deadline pushed to the frontend is the complete fix and needs a protocol
  change (a new field on `RequestUserInput`); deliberately out of scope.
- The backend classifier keys off a `request_id` shaped like an AskUserQuestion id (`ask-*`) with no
  pending Claude session in a workspace that has one. That is a heuristic about id shape, not a
  typed signal.
