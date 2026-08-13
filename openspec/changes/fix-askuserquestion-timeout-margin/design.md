## Context

`codex-chat-canvas-user-input-elicitation`'s "AskUserQuestion MCP Calls MUST Survive Answers Slower
Than The CLI Default Fetch Timeout" requirement already mandates raising `MCP_TOOL_TIMEOUT` to "a
value not shorter than the server's wait window." The implementation satisfied that literally (set
it to exactly the server's wait window) but not the intent behind it - an exact match is still a
race, not a safety margin. The requirement's own example value (300000ms) had also gone stale
relative to the shipped code (1800000ms), a small but telling sign of the same
duplicated-constant drift this change closes structurally.

## Decision

- One constant (`ASK_USER_QUESTION_TIMEOUT_SECS`) for the wait duration, consumed by both wait
  sites and the CLI margin calculation. This doesn't just fix today's drift - it makes the next
  drift structurally harder (change the value once, both wait sites and the CLI margin move
  together).
- A small, fixed 30s margin rather than a percentage or a second independently-configurable value.
  Simplicity: the race window this closes is scheduling jitter (milliseconds), not proportional to
  the total timeout, so a fixed small margin is the right shape, not `1.1x` or similar.

## Alternatives

| Option | Verdict | Why |
|---|---|---|
| Leave `MCP_TOOL_TIMEOUT` exactly matching the server wait | Not adopted | Satisfies the spec's literal wording but not its intent; the whole point of raising it is to give the CLI room, and zero margin gives none |
| Percentage-based margin (e.g. server wait * 1.02) | Not adopted | Overcomplicated for what is fundamentally a fixed scheduling-jitter budget, not something that scales with the total timeout |

## Validation

- Updated `build_command_raises_mcp_tool_timeout_when_ask_wired` (existing regression test) to
  assert `1830000` (1800 + 30 margin, in ms) instead of the old exact-match `1800000`. This is the
  test that would have originally caught "not raised at all"; it now also encodes "raised past, not
  to."
- `npx tsc --noEmit`: clean.
- `cargo test --lib`: run on this branch against a clean-`upstream/main` control at the same base;
  counts in `verification.md`. (Superseded note: to run via the `/tmp` worktree rebuild, not
  this live session.
