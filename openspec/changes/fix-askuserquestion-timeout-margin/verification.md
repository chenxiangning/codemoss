# Verification · fix-askuserquestion-timeout-margin

- **Date**: 2026-08-13
- **Base**: `upstream/main` @ v0.8.9 (`bd92e1388`)
- **Status**: implemented / awaiting upstream review

## Automated

- Cargo: `cargo test --lib engine::claude` 236/236 green.
- Cargo: full `cargo test --lib` run compared against a clean-`upstream/main` control under
  identical conditions. Integration 2026 passed / 6 failed; control 2022 passed / 6 failed, with
  the **same six** failures on both sides. No new failures attributable to this change.
- `npx tsc --noEmit`: clean.
- Verified no `1800` literal survives at either wait site; both now read
  `ASK_USER_QUESTION_TIMEOUT_SECS`.

## Rebase onto v0.8.9

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
- [ ] Not re-exercised by hand since rebasing onto v0.8.9.

## Known limits

- The broadcast channel bump (1024 to 4096) is a mitigation, not a guarantee. It raises the
  practical threshold at which a `RecvError::Lagged` can drop a `RequestUserInput` event; it does
  not remove the possibility. This is stated in the code comment as well.
- The 30s CLI margin is a fixed constant rather than a negotiated value. A server-authoritative
  deadline pushed to the frontend would remove this class of drift entirely, but needs a protocol
  change and is deliberately out of scope here.
