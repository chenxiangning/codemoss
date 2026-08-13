# pi-thread-session-continuity Specification

## Purpose

Native Pi 线程与 `~/.pi/agent/sessions` jsonl 的一对一续聊契约。Synced from `fix-pi-session-continuity-and-sidebar`.

## Requirements

### Requirement: Native Pi continue uses the bound session id

When the active Native thread is already bound to a PI session (`pi:<sessionId>`), the next send MUST pass that session id to the engine and MUST set `continueSession` true so `pi --print` resumes the same jsonl.

#### Scenario: Follow-up on a finalized Pi thread stays in one file

- **WHEN** the user sends a second message on thread `pi:019ffb7b-dedc-7b36-8d2f-f85f35501036`
- **THEN** `engine_send_message` is called with `continueSession=true` and `sessionId=019ffb7b-dedc-7b36-8d2f-f85f35501036`
- **AND** the backend includes `--session-id 019ffb7b-dedc-7b36-8d2f-f85f35501036`
- **AND** PI appends the new turn to the existing session file instead of creating a new one

#### Scenario: Model switch on the same Pi thread does not fork a file

- **WHEN** the user changes the composer model and sends again on the same `pi:<sessionId>` thread
- **THEN** the send still continues that session id
- **AND** PI writes a `model_change` entry into the same jsonl

### Requirement: Pending Pi threads cache the native session id

When the first Pi turn starts on a `pi-pending-*` thread, the system MUST remember the native session id as soon as it is known, and later sends on that pending thread MUST continue that id until remap finishes.

#### Scenario: Second send on pi-pending uses the cached id

- **WHEN** the first send on `pi-pending-abc` receives native session id `019ffb7c-805d-7695-b410-3630d16b6ca5`
- **AND** the user sends again before or after remap to `pi:019ffb7c-805d-7695-b410-3630d16b6ca5`
- **THEN** the follow-up send includes `continueSession=true` and that session id
- **AND** the system MUST NOT launch a second `pi --print` without `--session-id`
