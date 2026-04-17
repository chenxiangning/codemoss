## ADDED Requirements

### Requirement: Claude Prompt-Overflow Auto Recovery

For Claude engine threads, the runtime MUST attempt one automatic recovery cycle when a turn fails with a prompt-overflow error (`Prompt is too long`), by issuing `/compact` and retrying the original user request once in the same session.

#### Scenario: trigger one-shot recovery on prompt overflow
- **WHEN** a Claude thread turn fails and error text indicates prompt overflow
- **THEN** runtime SHALL send one `/compact` request for the same thread/session
- **AND** runtime SHALL retry the original request once after compaction

#### Scenario: stop after one retry
- **WHEN** the retried Claude turn still fails
- **THEN** runtime SHALL surface the final turn error to UI
- **AND** runtime SHALL NOT start a second automatic compact-retry cycle for that turn

#### Scenario: compaction request failure keeps clear terminal outcome
- **WHEN** Claude auto-compaction request fails before retry
- **THEN** runtime SHALL emit a failure result for the current turn
- **AND** runtime SHALL keep the error actionable for manual follow-up retry

### Requirement: Claude Compaction Lifecycle Event Mapping

The Claude runtime MUST map Claude CLI compaction lifecycle signals to existing thread compaction events so frontend can reuse current status flow.

#### Scenario: map compacting signal
- **WHEN** Claude stream emits a `system` event with compacting status
- **THEN** runtime SHALL emit `thread/compacting` for the active Claude thread
- **AND** frontend compaction state handler SHALL be able to consume it without protocol changes

#### Scenario: map compact boundary signal to compacted completion
- **WHEN** Claude stream emits `compact_boundary`
- **THEN** runtime SHALL emit `thread/compacted` for the same Claude thread
- **AND** frontend SHALL append the existing `Context compacted.` semantic message through current reducer flow

### Requirement: Claude-Only Boundary Guard

This capability MUST be strictly isolated to Claude engine threads.

#### Scenario: codex threads bypass claude recovery logic
- **WHEN** the active thread is Codex
- **THEN** Claude prompt-overflow auto recovery SHALL NOT execute
- **AND** existing Codex compaction/runtime behavior SHALL remain unchanged

#### Scenario: opencode and gemini threads bypass claude recovery logic
- **WHEN** the active thread is OpenCode or Gemini
- **THEN** Claude prompt-overflow auto recovery SHALL NOT execute
- **AND** existing OpenCode/Gemini error and compaction semantics SHALL remain unchanged

### Requirement: Lightweight Compacting Visibility Hint

The UI SHALL show a lightweight compacting hint for Claude threads while reusing existing state flow and without introducing new heavy UI structures.

#### Scenario: show compacting hint without new panel
- **WHEN** a Claude thread enters compacting state
- **THEN** frontend SHALL be able to render a lightweight compacting hint
- **AND** frontend SHALL NOT require introducing a dedicated new compaction panel
