# Verification · fix-askuserquestion-timeout-margin

- **Date**: 2026-08-13
- **Base**: `upstream/main` @ v0.8.9 (`bd92e1388`)
- **Status**: implemented / awaiting upstream review

## Automated

- Cargo: `cargo test --lib engine::claude` 236/236 green.
- Cargo: `cargo test --lib` on this branch, 2022 passed / 6 failed. Clean-`upstream/main` control
  at the same base, 2022 passed / 6 failed. Identical counts, and the **same six** pre-existing
  failures both sides, so this branch introduces none. (It adds no tests, so an identical count
  is the expected result.)
- `npx tsc --noEmit`: clean.
- Verified no `1800` literal survives at either wait site; both now read
  `ASK_USER_QUESTION_TIMEOUT_SECS`.

## Merge with v0.8.9

Upstream's `fix-askuserquestion-settlement-tombstone` edited the same MCP timeout branch, producing
one conflict hunk in `user_input.rs`. The two edits are complementary, not competing:

- Upstream added `mark_user_input_request_settled` plus `emit_user_input_request_completed`, so a
  timed-out card is dismissed rather than left lingering.
- This change replaces the hardcoded duration with the shared constant.

Resolution kept both: upstream's settle-and-emit lines, with this change's constant substituted
into the error message. The resulting message is byte-identical to upstream's literal
("AskUserQuestion timed out after 30 minutes") because `ASK_USER_QUESTION_TIMEOUT_SECS / 60` is 30,
so no test or log consumer sees a different string.

## Manual

- [x] Exercised in daily use over roughly a week, on the pre-rebase branch.
- Not re-exercised by hand since merging v0.8.9 in.

## Known limits

- The 30s CLI margin is a fixed constant rather than a negotiated value. A server-authoritative
  deadline pushed to the frontend would remove this class of drift entirely, but needs a protocol
  change and is deliberately out of scope here.
